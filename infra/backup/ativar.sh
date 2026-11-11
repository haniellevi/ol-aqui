#!/usr/bin/env bash
set -euo pipefail
umask 077

printf 'Senha do PostgreSQL do OLAKI (a digitação fica oculta): ' >/dev/tty
IFS= read -rs password </dev/tty
printf '\n' >/dev/tty
[[ -n "$password" ]] || { echo 'Senha vazia.'; exit 1; }
printf '%s' "$password" | secret-tool store --label='OLAKI: backup PostgreSQL' \
    application olaki-backup project ncrbqqdgweuqpsppxwti
unset password

if ! systemctl --user restart olaki-backup.service; then
    systemctl --user stop olaki-backup.service
    echo 'A cópia inicial falhou. Veja: journalctl --user -u olaki-backup.service -n 12 --no-pager'
    exit 1
fi
systemctl --user enable --now olaki-backup.timer
echo 'Backup inicial concluído e rotina automática ativada.'
systemctl --user list-timers olaki-backup.timer --no-pager
