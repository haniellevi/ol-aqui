#!/usr/bin/env python3
import fcntl
import hashlib
from datetime import datetime, timedelta, timezone
from io import BytesIO
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener

PROJECT = "ncrbqqdgweuqpsppxwti"
POOLER = "aws-1-sa-east-1.pooler.supabase.com"
ORIGIN = f"https://{PROJECT}.supabase.co/storage/v1"
CONFIG = Path(os.environ.get("OLAKI_BACKUP_CONFIG", Path.home() / ".config/olaki-backup"))
ARCHIVES = Path(os.environ.get("OLAKI_BACKUP_ARCHIVES", Path.home() / ".local/share/olaki-backup/archives"))
OFFSITE = os.environ.get("OLAKI_BACKUP_OFFSITE")
RETENTION = timedelta(days=14)
KEYRING = ["application", "olaki-backup", "project", PROJECT]
SCHEMAS = ("public", "auth", "storage", "extensions", "supabase_migrations")
STAMP = "%Y-%m-%dT%H%M%SZ"
PACKAGE = ("banco.dump.age", "fotos.tar.age", "snapshot.json")
INVENTORY = """
select jsonb_build_object(
  'objects', coalesce((select jsonb_agg(jsonb_build_object(
    'key', name, 'size', metadata->>'size', 'mime', metadata->>'mimetype',
    'etag', metadata->>'eTag', 'version', version) order by name)
    from storage.objects where bucket_id = 'anuncios'), '[]'::jsonb),
  'refs', coalesce((select jsonb_agg(jsonb_build_object('status', a.status, 'url', f.url))
    from public.anuncios a cross join lateral unnest(a.fotos) as f(url)), '[]'::jsonb),
  'public_bucket', (select public from storage.buckets where id = 'anuncios'),
  'other_buckets', (select count(*) from storage.buckets where id <> 'anuncios')
);
"""


class BackupError(Exception):
    pass


class CredentialError(BackupError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def connection():
    try:
        if credentials := os.environ.get("CREDENTIALS_DIRECTORY"):
            password = (Path(credentials) / "postgres-password").read_text().removesuffix("\n")
        else:
            password = subprocess.run(["secret-tool", "lookup", *KEYRING], capture_output=True,
                                      check=True, timeout=12).stdout.decode().removesuffix("\n")
    except (subprocess.SubprocessError, OSError) as exc:
        raise CredentialError("Credencial PostgreSQL indisponível.") from exc
    if not password:
        raise CredentialError("Credencial PostgreSQL vazia.")
    env = {**os.environ, "PGPASSWORD": password, "PGOPTIONS": "-c default_transaction_read_only=on"}
    db = (f"host={POOLER} port=5432 dbname=postgres user=postgres.{PROJECT} "
          f"sslmode=verify-full sslrootcert={CONFIG / 'supabase-ca.crt'} connect_timeout=12")
    return db, env


def backup_database(output, recipient):
    db, env = connection()
    with subprocess.Popen(["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", db], env=env,
                          text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL) as session:
        try:
            session.stdin.write(
                "begin isolation level repeatable read read only;\n"
                "select transaction_timestamp(), pg_export_snapshot() "
                "where to_regclass('public.anuncios') is not null;\n" + INVENTORY
            )
            session.stdin.flush()
            point = session.stdout.readline().strip()
            inventory = session.stdout.readline()
            if "|" not in point or not inventory:
                raise BackupError("A conexão PostgreSQL ou a leitura do inventário falhou.")
            captured, snapshot = point.split("|", 1)
            manifest = json.loads(inventory)
            dump_args = ["pg_dump", "-w", "-d", db, "--format=custom", "--lock-wait-timeout=10s",
                         f"--snapshot={snapshot}", *(f"--schema={s}" for s in SCHEMAS)]
            with output.open("xb") as target, subprocess.Popen(
                dump_args, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
            ) as dump:
                encrypted = subprocess.run(["age", "-r", recipient], stdin=dump.stdout, stdout=target)
                dump.stdout.close()
                if dump.wait() or encrypted.returncode:
                    raise BackupError("Falha ao exportar e cifrar o banco.")
        finally:
            session.stdin.close()
    if session.returncode:
        raise BackupError("A sessão que manteve o snapshot não terminou normalmente.")
    manifest["snapshot_utc"] = datetime.fromisoformat(captured).astimezone(timezone.utc).isoformat()
    return manifest


def add_entry(archive, name, size, content):
    entry = tarfile.TarInfo(name)
    entry.size = size
    entry.mode = 0o600
    archive.addfile(entry, content)


def archive_photos(output, manifest, recipient):
    if manifest["public_bucket"] is not True:
        raise BackupError("O bucket de fotos esperado não está público no snapshot.")
    opener = build_opener(NoRedirect)
    urls = set()
    with output.open("xb") as target, subprocess.Popen(
        ["age", "-r", recipient], stdin=subprocess.PIPE, stdout=target
    ) as encrypted:
        try:
            with tarfile.open(fileobj=encrypted.stdin, mode="w|") as archive:
                for i, photo in enumerate(manifest["objects"]):
                    key = photo["key"]
                    if any(part in ("", ".", "..") for part in key.split("/")):
                        raise BackupError("O inventário contém um caminho de foto inválido.")
                    photo["path"] = f"/object/public/anuncios/{quote(key, safe='/')}"
                    url = ORIGIN + photo["path"]
                    request = Request(url, headers={"Accept-Encoding": "identity"})
                    size = int(photo["size"])
                    with opener.open(request, timeout=20) as response, tempfile.TemporaryFile(
                        dir=os.environ["XDG_RUNTIME_DIR"]
                    ) as raw:
                        etag = response.headers.get("ETag", "").strip('"')
                        expected_etag = (photo["etag"] or "").strip('"')
                        if (response.status != 200 or not expected_etag or etag != expected_etag
                                or response.headers.get_content_type() != photo["mime"]):
                            raise BackupError("Uma foto mudou desde o snapshot ou diverge do inventário.")
                        remaining = size
                        digest = hashlib.sha256()
                        while remaining:
                            block = response.read(min(remaining, 1024 * 1024))
                            if not block:
                                raise BackupError("Uma foto chegou incompleta.")
                            digest.update(block)
                            raw.write(block)
                            remaining -= len(block)
                        if response.read(1):
                            raise BackupError("Uma foto chegou maior que o esperado.")
                        photo.update(file=f"foto-{i}.bin", cache=response.headers.get("Cache-Control"),
                                     sha256=digest.hexdigest())
                        raw.seek(0)
                        add_entry(archive, photo["file"], size, raw)
                    urls.add(url)
                manifest["missing_refs"] = sum(ref["url"] not in urls for ref in manifest["refs"])
                manifest["photos_finished_utc"] = datetime.now(timezone.utc).isoformat()
                raw_manifest = json.dumps(manifest).encode()
                add_entry(archive, "manifest.json", len(raw_manifest), BytesIO(raw_manifest))
                checksums = [f"{photo['sha256']}  {photo['file']}\n" for photo in manifest["objects"]]
                checksums.append(f"{hashlib.sha256(raw_manifest).hexdigest()}  manifest.json\n")
                raw_checksums = "".join(checksums).encode()
                add_entry(archive, "SHA256SUMS", len(raw_checksums), BytesIO(raw_checksums))
        finally:
            encrypted.stdin.close()
    if encrypted.returncode:
        raise BackupError("Falha ao cifrar as fotos.")


def expired(name, current, now):
    try:
        captured = datetime.strptime(name, STAMP).replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return name != current and captured.strftime(STAMP) == name and captured < now - RETENTION


def prune(current, now):
    for item in ARCHIVES.iterdir():
        if item.is_symlink() or not item.is_dir() or not expired(item.name, current.name, now):
            continue
        entries = list(item.iterdir())
        if ({f.name for f in entries} == {*PACKAGE, "SHA256SUMS"}
                and all(f.is_file() and not f.is_symlink() for f in entries)):
            shutil.rmtree(item)


def rclone(*args, **options):
    try:
        return subprocess.run(
            ["rclone", "--log-level", "ERROR", "--retries", "2", "--timeout", "45s", *args],
            check=True, stderr=subprocess.DEVNULL, **options
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise BackupError("A cópia local foi preservada. A operação no destino externo falhou.") from exc


def publish_offsite(archive, now):
    root = OFFSITE.rstrip("/")
    prefix = root if root.endswith(":") else f"{root}/"
    remote = prefix + archive.name
    lines = []
    for name in PACKAGE[:2]:
        local = archive / name
        with local.open("rb") as stream:
            expected = hashlib.file_digest(stream, "sha256").hexdigest()
        rclone("copyto", "--immutable", str(local), f"{remote}/{name}")
        with tempfile.TemporaryFile(dir=archive.parent) as downloaded:
            rclone("cat", f"{remote}/{name}", stdout=downloaded)
            downloaded.seek(0)
            if hashlib.file_digest(downloaded, "sha256").hexdigest() != expected:
                raise BackupError("O hash da cópia externa diverge da cópia local.")
        lines.append(f"{expected}  {name}\n")
    marker = "".join(lines).encode()
    with tempfile.TemporaryDirectory(dir=os.environ["XDG_RUNTIME_DIR"]) as staging:
        checksums = Path(staging) / "SHA256SUMS"
        checksums.write_bytes(marker)
        rclone("copyto", "--immutable", str(checksums), f"{remote}/SHA256SUMS")
    if rclone("cat", f"{remote}/SHA256SUMS", stdout=subprocess.PIPE).stdout != marker:
        raise BackupError("O índice de integridade da cópia externa diverge.")
    print(f"Cópia externa verificada por SHA-256: {archive.name}.", flush=True)

    folders = rclone("lsf", root, "--dirs-only", "--max-depth", "1", stdout=subprocess.PIPE,
                     text=True).stdout.splitlines()
    for folder in folders:
        stamp = folder.rstrip("/")
        if not expired(stamp, archive.name, now):
            continue
        destination = prefix + stamp
        names = rclone("lsf", destination, "--max-depth", "1", stdout=subprocess.PIPE,
                       text=True).stdout.splitlines()
        if set(names) <= {*PACKAGE[:2], "SHA256SUMS"}:
            for name in ("SHA256SUMS", *PACKAGE[:2]):
                if name not in names:
                    continue
                rclone("deletefile", f"{destination}/{name}")
            rclone("rmdir", destination)


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run():
    os.umask(0o077)
    ARCHIVES.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ARCHIVES.parent / ".backup.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        recipient = (CONFIG / "recipient").read_text().strip()
        with tempfile.TemporaryDirectory(prefix=".olaki-", dir=ARCHIVES.parent) as staging:
            target = Path(staging)
            manifest = backup_database(target / PACKAGE[0], recipient)
            archive_photos(target / PACKAGE[1], manifest, recipient)
            captured = datetime.fromisoformat(manifest["snapshot_utc"])
            summary = {key: manifest[key] for key in ("snapshot_utc", "photos_finished_utc",
                                                       "missing_refs", "other_buckets")}
            summary.update(project=PROJECT, objects=len(manifest["objects"]), refs=len(manifest["refs"]))
            (target / PACKAGE[2]).write_text(json.dumps(summary) + "\n")
            lines = []
            for name in PACKAGE:
                with (target / name).open("rb") as stream:
                    lines.append(f"{hashlib.file_digest(stream, 'sha256').hexdigest()}  {name}\n")
                    os.fsync(stream.fileno())
            with (target / "SHA256SUMS").open("x") as checksums:
                checksums.writelines(lines)
                checksums.flush()
                os.fsync(checksums.fileno())
            published = ARCHIVES / captured.strftime(STAMP)
            sync_directory(target)
            target.rename(published)
            sync_directory(ARCHIVES)
            sync_directory(ARCHIVES.parent)
        now = datetime.now(timezone.utc)
        prune(published, now)
        if OFFSITE:
            publish_offsite(published, now)
        print(f"Backup concluído em {published.name}. "
              f"Fotos: {summary['objects']}. Referências sem arquivo: {summary['missing_refs']}. "
              f"Outros buckets fora do escopo: {summary['other_buckets']}.")


if __name__ == "__main__":
    try:
        run()
    except CredentialError as exc:
        print(exc, file=sys.stderr)
        sys.exit(3)
    except BackupError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
    except HTTPError as exc:
        print(f"Falha ao ler uma foto no Storage (HTTP {exc.code}).", file=sys.stderr)
        sys.exit(1)
    except (OSError, URLError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        print("Falha ao preparar o pacote de backup. Nenhuma cópia anterior foi substituída.", file=sys.stderr)
        sys.exit(1)
