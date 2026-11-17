-- REVIEW BEFORE APPLYING. Follow-up to 20261117000000_lock_down_security_definer_functions.sql.
--
-- Why: four helper functions (is_admin, is_blocked_between, can_see_checkin,
-- can_add_to_group) are used inside row-level security policies, so they could not
-- simply be locked down. While they sit in the public schema, anyone can call them
-- through /rest/v1/rpc. Policies and other functions refer to a function by its
-- internal ID, so moving it to a schema the API does not expose keeps every policy
-- working while removing the public endpoint.
--
-- What this does:
--   1. Creates a `private` schema (not exposed by the API; roles may use objects in
--      it but cannot reach it over HTTP).
--   2. Moves the four helpers there. They keep their existing grants.
--   3. Rewrites the functions that call them by the old name (public.is_admin() etc.)
--      to use private.*.
--
-- To undo: move the four functions back with ALTER FUNCTION ... SET SCHEMA public and
-- rewrite the callers back to public.*.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_blocked_between(uuid, uuid) set schema private;
alter function public.is_admin() set schema private;
alter function public.can_see_checkin(uuid, uuid) set schema private;
alter function public.can_add_to_group(uuid, uuid) set schema private;

do $rewrite$
declare
  r record;
  def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and p.prosrc ~ 'public\.(is_admin|is_blocked_between|can_see_checkin|can_add_to_group)\('
  loop
    def := pg_get_functiondef(r.oid);
    def := regexp_replace(def, 'public\.(is_admin|is_blocked_between|can_see_checkin|can_add_to_group)\(', 'private.\1(', 'g');
    execute def;
  end loop;
end
$rewrite$;
