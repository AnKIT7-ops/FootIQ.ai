-- FootIQ migration 0003 — security advisor hardening
-- 1) Trigger functions must not be callable through the Data API RPC surface.
--    handle_new_user is SECURITY DEFINER (needed: inserts into profiles on
--    auth.users insert) — revoke EXECUTE from client roles; the trigger itself
--    runs fine without them.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) Pin search_path on set_updated_at (mutable search_path warning).
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Also keep it out of the RPC surface — it's a trigger helper, not an API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.increment_quota(uuid, text, integer) from public, anon, authenticated;
