insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('job-attachments','job-attachments',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists job_attachments_member_read on storage.objects;
drop policy if exists job_attachments_member_upload on storage.objects;
drop policy if exists job_attachments_member_update on storage.objects;
drop policy if exists job_attachments_manager_delete on storage.objects;

create policy job_attachments_member_read on storage.objects for select to authenticated
using (bucket_id='job-attachments' and (storage.foldername(name))[1] in (select id::text from public.organizations where id in (select public.current_organization_ids())));
create policy job_attachments_member_upload on storage.objects for insert to authenticated
with check (bucket_id='job-attachments' and (storage.foldername(name))[1] in (select id::text from public.organizations where id in (select public.current_organization_ids())));
create policy job_attachments_member_update on storage.objects for update to authenticated
using (bucket_id='job-attachments' and (storage.foldername(name))[1] in (select id::text from public.organizations where id in (select public.current_organization_ids())))
with check (bucket_id='job-attachments' and (storage.foldername(name))[1] in (select id::text from public.organizations where id in (select public.current_organization_ids())));
create policy job_attachments_manager_delete on storage.objects for delete to authenticated
using (bucket_id='job-attachments' and public.has_organization_role(((storage.foldername(name))[1])::uuid,array['owner','manager']));

notify pgrst, 'reload schema';
