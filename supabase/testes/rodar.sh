#!/usr/bin/env bash
# Testes de comportamento do banco num Postgres 15+ local (sem Supabase).
# Uso: PGUSER=postgres bash supabase/testes/rodar.sh   (cria/recria o banco "olaki")
# Leia a saída: cada bloco [n] diz o que deve acontecer (erro esperado aparece como ERROR).
set -euo pipefail
cd "$(dirname "$0")"
psql -q -f 00_simula_supabase.sql
for m in ../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d olaki -1 -f "$m"; done
# todos os arquivos NN_*.sql em ordem (menos o 00, que monta o banco)
for t in [1-9][0-9]_*.sql; do echo "===== $t"; psql -d olaki -f "$t"; done
