#!/usr/bin/env bash
set -euo pipefail
umask 077

server=srv2031318.hstgr.cloud
project_dir=/srv/olaki/whatsapp
config_dir=/etc/olaki-backup
state_dir=/var/lib/olaki-backup
app_dir=/opt/olaki-backup
service=olaki-backup-vps
drive_folder=1spCs4-nGX2ro3aA4DcRoA6yOZDMs6s3E

preflight() {
    [[ $(id -u) -eq 0 ]] || { echo 'Execute em sessão administrativa na VPS.'; exit 1; }
    [[ $(hostname -s) == "${server%%.*}" && -d "$project_dir" ]] ||
        { echo 'Servidor ou diretório do OLAKI divergente.'; exit 1; }
    for tool in psql pg_dump python3 age rclone systemctl; do
        command -v "$tool" >/dev/null || { echo "Dependência ausente: $tool"; exit 1; }
    done
    python3 - <<'PY'
import re
import subprocess
import sys
version = subprocess.check_output(["pg_dump", "--version"], text=True)
if sys.version_info < (3, 11) or int(re.search(r"\) (\d+)", version)[1]) < 17:
    raise SystemExit("Requer Python 3.11+ e pg_dump 17+.")
PY
}

stage() {
    local source
    source=$(cd -- "$(dirname -- "$0")" && pwd -P)
    for file in olaki-backup.py olaki-backup-vps.service olaki-backup-vps.timer supabase-ca.crt recipient; do
        [[ -f "$source/$file" ]] || { echo "Arquivo ausente no pacote: $file"; exit 1; }
    done
    if ! id olaki-backup >/dev/null 2>&1; then
        useradd --system --user-group --no-create-home --home-dir "$state_dir" --shell /usr/sbin/nologin olaki-backup
    fi
    install -d -m 755 "$config_dir" "$app_dir"
    install -d -m 700 -o olaki-backup -g olaki-backup "$state_dir"
    install -m 644 "$source/supabase-ca.crt" "$source/recipient" "$config_dir/"
    install -m 644 "$source/olaki-backup.py" "$app_dir/"
    install -m 700 "$source/instalar-vps.sh" "$app_dir/"
    install -m 644 "$source/olaki-backup-vps.service" "$source/olaki-backup-vps.timer" /etc/systemd/system/
    systemd-analyze verify "/etc/systemd/system/$service.service" "/etc/systemd/system/$service.timer"
    systemctl daemon-reload
    echo 'Serviço preparado. A ativação depende da credencial dedicada do Drive.'
}

activate() {
    local drive_conf password secret
    drive_conf="$state_dir/rclone.conf"
    [[ -r "$drive_conf" ]] || { echo "Configuração dedicada do Drive ausente em $drive_conf."; exit 1; }
    python3 - "$drive_conf" "$drive_folder" <<'PY'
import configparser
import sys
cfg = configparser.ConfigParser(interpolation=None)
cfg.read(sys.argv[1])
if cfg.sections() != ["olaki-drive"]:
    raise SystemExit("A configuração deve conter somente o destino olaki-drive.")
drive = cfg["olaki-drive"]
if (drive.get("type"), drive.get("scope"), drive.get("root_folder_id")) != ("drive", "drive.file", sys.argv[2]):
    raise SystemExit("A autorização deve usar drive.file e apontar para a pasta dedicada.")
PY
    chown olaki-backup:olaki-backup "$drive_conf"
    chmod 600 "$drive_conf"
    runuser -u olaki-backup -- rclone --config "$drive_conf" --log-level ERROR \
        lsf olaki-drive: --dirs-only --max-depth 1 >/dev/null
    if [[ ! -s "$config_dir/postgres-password" ]]; then
        printf 'Senha do PostgreSQL do OLAKI (digitação oculta): ' >/dev/tty
        IFS= read -rs password </dev/tty
        printf '\n' >/dev/tty
        [[ -n "$password" ]] || { echo 'Senha vazia.'; exit 1; }
        secret=$(mktemp "$config_dir/.postgres-password.XXXXXX")
        printf '%s' "$password" > "$secret"
        unset password
        mv -T -- "$secret" "$config_dir/postgres-password"
    fi
    [[ ! -L "$config_dir/postgres-password" && $(stat -c '%u:%a' "$config_dir/postgres-password") == 0:600 ]] ||
        { echo 'A senha deve ficar em arquivo exclusivo de root com modo 600.'; exit 1; }

    if ! systemctl start "$service.service"; then
        systemctl stop "$service.service"
        journalctl -u "$service.service" -n 12 --no-pager
        exit 1
    fi
    systemctl enable --now "$service.timer"
    journalctl -u "$service.service" -n 12 --no-pager
    systemctl list-timers "$service.timer" --no-pager
}

case "${1:-}" in
    stage) preflight; stage ;;
    activate) preflight; activate ;;
    *) echo 'Uso: instalar-vps.sh stage|activate'; exit 2 ;;
esac
