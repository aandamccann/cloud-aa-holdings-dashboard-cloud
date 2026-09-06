begin;

create table if not exists public.document_number_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in ('estimate','job_card','invoice')),
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_type)
);

alter table public.document_number_sequences enable row level security;

drop policy if exists document_number_sequences_member_read on public.document_number_sequences;
create policy document_number_sequences_member_read
on public.document_number_sequences for select to authenticated
using (organization_id in (select public.current_organization_ids()));

create or replace function public.reserve_garage_document_number(p_document_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization uuid;
  prefix text;
  existing_max bigint;
  reserved_number bigint;
begin
  if p_document_type not in ('estimate','job_card','invoice') then
    raise exception 'Unsupported document type: %', p_document_type using errcode = '22023';
  end if;

  select organization_id into target_organization
  from public.organization_members
  where user_id = auth.uid() and active = true
  order by created_at
  limit 1;

  if target_organization is null then
    raise exception 'No active organization membership found' using errcode = '42501';
  end if;

  prefix := case p_document_type
    when 'estimate' then 'EST'
    when 'job_card' then 'JC'
    when 'invoice' then 'INV'
  end;

  select coalesce(max(substring(document_number from '([0-9]+)$')::bigint), 0)
  into existing_max
  from public.documents
  where organization_id = target_organization
    and document_type = p_document_type
    and document_number ~ '^[A-Za-z]+-[0-9]+$';

  insert into public.document_number_sequences (organization_id, document_type, last_number)
  values (target_organization, p_document_type, existing_max + 1)
  on conflict (organization_id, document_type) do update
  set last_number = greatest(public.document_number_sequences.last_number, existing_max) + 1,
      updated_at = now()
  returning last_number into reserved_number;

  return prefix || '-' || lpad(reserved_number::text, 5, '0');
end;
$$;

revoke all on function public.reserve_garage_document_number(text) from public;
grant execute on function public.reserve_garage_document_number(text) to authenticated;

grant select on public.document_number_sequences to authenticated;

commit;
