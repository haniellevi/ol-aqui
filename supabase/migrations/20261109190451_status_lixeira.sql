-- O novo valor precisa estar confirmado antes de ser usado na próxima migração.
alter type public.status_anuncio add value if not exists 'excluido';
