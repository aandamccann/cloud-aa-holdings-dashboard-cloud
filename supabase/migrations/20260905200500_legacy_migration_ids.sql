begin;

alter table public.customers add column if not exists legacy_source_id text;
alter table public.vehicles add column if not exists legacy_source_id text;

create unique index if not exists customers_organization_legacy_idx
  on public.customers(organization_id, legacy_source_id)
  where legacy_source_id is not null;

create unique index if not exists vehicles_organization_legacy_idx
  on public.vehicles(organization_id, legacy_source_id)
  where legacy_source_id is not null;

commit;
