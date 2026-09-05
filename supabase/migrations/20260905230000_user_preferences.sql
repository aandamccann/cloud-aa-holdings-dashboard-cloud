create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preference_key text not null,
  preference_value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, preference_key)
);

alter table public.user_preferences enable row level security;
drop policy if exists user_preferences_own_access on public.user_preferences;
create policy user_preferences_own_access on public.user_preferences for all to authenticated
using (user_id=auth.uid() and organization_id in (select public.current_organization_ids()))
with check (user_id=auth.uid() and organization_id in (select public.current_organization_ids()));
grant select,insert,update,delete on public.user_preferences to authenticated;
notify pgrst, 'reload schema';
