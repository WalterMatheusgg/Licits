-- Private Storage buckets and tenant-aware object policies.
insert into storage.buckets (id, name, public)
values
  ('contracts', 'contracts', false),
  ('fiscal-records', 'fiscal-records', false),
  ('occurrences', 'occurrences', false),
  ('generated-documents', 'generated-documents', false),
  ('organization-assets', 'organization-assets', false)
on conflict (id) do update set public = false;

create policy tenant_storage_select
on storage.objects for select
to authenticated
using (
  bucket_id in (
    'contracts',
    'fiscal-records',
    'occurrences',
    'generated-documents',
    'organization-assets'
  )
  and public.storage_path_has_read_access(name)
);

create policy tenant_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id in (
    'contracts',
    'fiscal-records',
    'occurrences',
    'generated-documents',
    'organization-assets'
  )
  and public.storage_path_has_write_access(bucket_id, name)
  and owner_id = auth.uid()::text
);

create policy tenant_storage_update
on storage.objects for update
to authenticated
using (
  bucket_id in (
    'contracts',
    'fiscal-records',
    'occurrences',
    'generated-documents',
    'organization-assets'
  )
  and public.storage_path_has_write_access(bucket_id, name)
)
with check (
  bucket_id in (
    'contracts',
    'fiscal-records',
    'occurrences',
    'generated-documents',
    'organization-assets'
  )
  and public.storage_path_has_write_access(bucket_id, name)
);

create policy tenant_storage_delete
on storage.objects for delete
to authenticated
using (
  bucket_id in (
    'contracts',
    'fiscal-records',
    'occurrences',
    'generated-documents',
    'organization-assets'
  )
  and public.storage_path_has_write_access(bucket_id, name)
);
