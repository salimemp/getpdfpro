-- =============================================================================
-- GetPDFPro — beta RPC security hardening
-- =============================================================================
-- Run this in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- What this fixes:
--   Supabase Security Advisor flags `public.claim_beta_spot()` with two
--   warnings:
--     1. "Public Can Execute SECURITY DEFINER" — Postgres grants EXECUTE
--        to PUBLIC by default on new functions. PUBLIC includes the anon
--        role in Supabase, so anonymous visitors could (in principle)
--        call the function. The function's first line already raises
--        when auth.uid() is null, but defense-in-depth says revoke
--        PUBLIC at the GRANT level too.
--     2. "Signed-In Users Can Execute SECURITY DEFINER" — this warning
--        will always appear for a SECURITY DEFINER function in the
--        public schema, regardless of who has EXECUTE. The function
--        genuinely needs to be callable by authenticated users (it's
--        called from BetaClaimForm after sign-in), so we can't fully
--        silence this one — but we can document the intent with a
--        REVOKE + GRANT pattern that makes the role scope explicit and
--        easy to audit.
--
-- We tighten two things:
--   - `set search_path = ''` (empty search path), so the function can
--     only resolve schema-qualified names. This is the Supabase-
--     recommended hardening for SECURITY DEFINER functions; previously
--     it was `search_path = public` which is OK but not bulletproof.
--   - Explicit REVOKE FROM PUBLIC + GRANT TO authenticated only.
--     `anon` no longer has EXECUTE.
--
-- The function body is unchanged. We recreate the function so the
-- `set search_path = ''` clause takes effect (CREATE OR REPLACE
-- honors new SET clauses).
-- =============================================================================

create or replace function public.claim_beta_spot()
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

comment on function public.claim_beta_spot() is
  'Atomically claim one of the 100 free Pro beta slots. Returns claimed | already_claimed | taken. SECURITY DEFINER: only authenticated users may EXECUTE; anon has been revoked.';

-- Revoke the implicit PUBLIC grant (which includes anon in Supabase).
-- Then explicitly grant to authenticated only. Idempotent.
revoke execute on function public.claim_beta_spot() from public;
revoke execute on function public.claim_beta_spot() from anon;
grant  execute on function public.claim_beta_spot() to authenticated;
