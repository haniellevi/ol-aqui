#!/usr/bin/env bash
# Testes de comportamento do banco num Postgres 15+ local (sem Supabase).
# Uso: PGUSER=postgres bash supabase/testes/rodar.sh   (cria/recria o banco "olaki")
# Leia a saída: cada bloco [n] diz o que deve acontecer (erro esperado aparece como ERROR).
set -euo pipefail
cd "$(dirname "$0")"
psql -q -f 00_simula_supabase.sql
for m in ../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d olaki -1 -f "$m"; done
for t in 10_*.sql 20_*.sql 21_*.sql 30_*.sql; do echo "===== $t"; psql -d olaki -f "$t"; done
