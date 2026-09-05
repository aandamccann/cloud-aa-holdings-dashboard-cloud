create table if not exists public.organization_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, setting_key)
);

alter table public.organization_settings enable row level security;

create policy organization_settings_member_read
on public.organization_settings for select to authenticated
using (organization_id in (select public.current_organization_ids()));

create policy organization_settings_manager_write
on public.organization_settings for insert to authenticated
with check (public.has_organization_role(organization_id, array['owner','manager']));

create policy organization_settings_manager_update
on public.organization_settings for update to authenticated
using (public.has_organization_role(organization_id, array['owner','manager']))
with check (public.has_organization_role(organization_id, array['owner','manager']));

create policy organization_settings_owner_delete
on public.organization_settings for delete to authenticated
using (public.has_organization_role(organization_id, array['owner']));

grant select,insert,update,delete on public.organization_settings to authenticated;

notify pgrst, 'reload schema';
