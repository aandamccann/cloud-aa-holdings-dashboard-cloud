create table if not exists public.rental_safety_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_source_id text not null,
  pair_id text,
  direction text not null check (direction in ('out','in')),
  registration text not null,
  inspection_date date,
  record jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_source_id)
);

alter table public.rental_safety_checks enable row level security;
drop policy if exists rental_safety_checks_member_access on public.rental_safety_checks;
create policy rental_safety_checks_member_access on public.rental_safety_checks for all to authenticated
using (organization_id in (select public.current_organization_ids()))
with check (organization_id in (select public.current_organization_ids()));
grant select,insert,update,delete on public.rental_safety_checks to authenticated;
notify pgrst, 'reload schema';
