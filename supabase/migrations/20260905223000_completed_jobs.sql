create table if not exists public.completed_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_source_id text not null,
  record jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_source_id)
);

alter table public.completed_jobs enable row level security;
drop policy if exists completed_jobs_member_access on public.completed_jobs;
create policy completed_jobs_member_access on public.completed_jobs for all to authenticated
using (organization_id in (select public.current_organization_ids()))
with check (organization_id in (select public.current_organization_ids()));
grant select,insert,update,delete on public.completed_jobs to authenticated;
notify pgrst, 'reload schema';
