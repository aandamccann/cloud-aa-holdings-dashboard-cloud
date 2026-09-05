create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_source_id text not null, name text not null, definition jsonb not null default '{}'::jsonb, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id, legacy_source_id)
);
create table if not exists public.checklist_results (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade, local_job_key text not null, template_id uuid references public.checklist_templates(id) on delete set null,
  results jsonb not null default '{}'::jsonb, status text not null default 'in_progress' check(status in ('in_progress','completed','reviewed')),
  completed_by uuid references public.profiles(id), completed_at timestamptz, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id, local_job_key)
);
alter table public.checklist_templates enable row level security;
alter table public.checklist_results enable row level security;
create policy checklist_templates_member_access on public.checklist_templates for all to authenticated using (organization_id in (select public.current_organization_ids())) with check (organization_id in (select public.current_organization_ids()));
create policy checklist_results_member_access on public.checklist_results for all to authenticated using (organization_id in (select public.current_organization_ids())) with check (organization_id in (select public.current_organization_ids()));
grant select,insert,update,delete on public.checklist_templates,public.checklist_results to authenticated;
