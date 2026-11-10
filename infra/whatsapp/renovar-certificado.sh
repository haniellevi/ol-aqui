#!/bin/sh
set -eu
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/olaki-whatsapp ]; then
  nginx -t
  systemctl reload nginx
fi
