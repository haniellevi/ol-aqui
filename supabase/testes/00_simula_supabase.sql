drop database if exists olaki; create database olaki;
\c olaki
do $$ begin create role anon nologin; exception when others then null; end $$;
do $$ begin create role authenticated nologin; exception when others then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when others then null; end $$;
create schema auth;
-- Igual ao Supabase: auth.jwt() lê as claims do token; auth.role() lê a claim role.
create function auth.jwt() returns jsonb language sql stable as $f$
  select jsonb_strip_nulls(jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true),''),
                                               'role', nullif(current_setting('request.jwt.claim.role', true),''))) $f$;
create function auth.role() returns text language sql stable as $f$ select auth.jwt()->>'role' $f$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
