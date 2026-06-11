-- =============================================================================
-- GetPDFPro — beta launch schema (first 100 users)
-- =============================================================================
-- Run this in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- What this creates:
--   1. A `beta_spots` table that holds the 100 unique user IDs that
--      successfully claim a beta spot. The first 100 wins; everyone
--      after that gets a "taken" response.
--   2. A `claim_beta_spot()` RPC that atomically checks capacity,
--      inserts the user, and sets their user_metadata.plan to 'pro'
--      (so the quota hook immediately gives them the 1,000/day limit).
--   3. RLS so users can only see/insert their own row, and the count
--      is read-only via the public RPC.
-- =============================================================================

-- 1. The table
create table if not exists public.beta_spots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  -- Source so we can attribute (landing page, direct link, etc.)
  source text default 'web'
);

comment on table public.beta_spots is 'First 100 users who claimed a free Pro beta slot. One row per user.';

alter table public.beta_spots enable row level security;

-- Users can read their own row (used to detect "already_claimed")
drop policy if exists "beta_spots read own" on public.beta_spots;
create policy "beta_spots read own" on public.beta_spots
  for select using (auth.uid() = user_id);

-- No direct insert/update/delete — must go through the RPC

-- 2. The RPC
create or replace function public.claim_beta_spot()
returns text
language plpgsql
security definer
set search_path = public
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
  'Atomically claim one of the 100 free Pro beta slots. Returns claimed | already_claimed | taken.';

-- 3. Grant execute on the RPC to authenticated users
grant execute on function public.claim_beta_spot() to authenticated;
