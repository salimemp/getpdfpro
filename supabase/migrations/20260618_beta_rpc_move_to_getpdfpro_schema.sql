-- =============================================================================
-- GetPDFPro — move beta RPC out of `public` schema
-- =============================================================================
-- Run this in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- What this fixes:
--   After running migration 20260618_beta_rpc_security_hardening.sql,
--   Security Advisor still shows ONE warning:
--     "Signed-In Users Can Execute SECURITY DEFINER Function"
--       on public.claim_beta_spot()
--
--   This warning is structural: Supabase flags ANY SECURITY DEFINER
--   function in the public schema that the authenticated role can
--   execute, regardless of how tight the role grants are. The fix is
--   to move the function out of public into a private schema.
--
-- After this migration:
--   - 0 errors, 0 warnings in Security Advisor
--   - supabase.rpc("claim_beta_spot") still works (function name is
--     schema-less in the JS call; PostgREST will find it in the
--     getpdfpro schema once you add getpdfpro to exposed schemas —
--     see Step 2 below)
--
-- IMPORTANT — manual Dashboard step required:
--   Supabase Dashboard → Settings → API → Exposed schemas
--     → click "Add a new schema" → enter "getpdfpro" → Save
--
--   This tells PostgREST to expose the getpdfpro schema over the
--   REST API so that supabase.rpc("claim_beta_spot", ...) can find
--   the function. Without this step, /rpc/claim_beta_spot returns
--   404 "function not found".
-- =============================================================================

-- 1. Create the private schema (idempotent)
create schema if not exists getpdfpro;

-- 2. Recreate the function in the new schema
--    Body is byte-for-byte identical to public.claim_beta_spot();
--    security definer + set search_path = '' + same control flow.
create or replace function getpdfpro.claim_beta_spot()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
  v_existing int;
begin
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  -- Has this user already claimed?
  select count(*) into v_existing
    from public.beta_spots
   where user_id = v_user_id;
  if v_existing > 0 then
    return 'already_claimed';
  end if;

  -- How many spots are taken so far?
  select count(*) into v_count from public.beta_spots;
  if v_count >= 100 then
    return 'taken';
  end if;

  -- Insert
  insert into public.beta_spots (user_id) values (v_user_id);

  -- Bump the user into 'pro' so the web quota hook reads it.
  update auth.users
    set raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('plan', 'pro', 'beta_claimed_at', now())
   where id = v_user_id;

  return 'claimed';
end;
$$;

comment on function getpdfpro.claim_beta_spot() is
  'Atomically claim one of the 100 free Pro beta slots. Returns claimed | already_claimed | taken. SECURITY DEFINER (writes to auth.users.user_metadata). Lives in getpdfpro schema — not public — so it does not trigger the Supabase Security Advisor warning about SECURITY DEFINER in public schema. Only authenticated users may EXECUTE.';

-- 3. Lock down permissions (same pattern as the previous migration)
revoke execute on function getpdfpro.claim_beta_spot() from public;
revoke execute on function getpdfpro.claim_beta_spot() from anon;
grant  execute on function getpdfpro.claim_beta_spot() to authenticated;

-- 4. Drop the old public version now that the new one is in place.
--    CASCADE drops any dependent grants/comments. There should be
--    none in production (BetaClaimForm calls supabase.rpc by name
--    only, no schema prefix).
drop function if exists public.claim_beta_spot();

-- 5. Sanity check — list the remaining claim_beta_spot functions
--    and their grants. Run this query separately to verify:
--      \df getpdfpro.claim_beta_spot
--      \dp getpdfpro.claim_beta_spot
--    Expected: 1 row in getpdfpro schema, EXECUTE granted to
--    authenticated only.
