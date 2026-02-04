-- Update client_agreements status flow and add lock flag

alter table public.client_agreements
  add column if not exists is_locked boolean not null default false;

-- Migrate existing status values to new flow
update public.client_agreements
set status = 'issued'
where status = 'pending_client';

update public.client_agreements
set status = 'in_use'
where status = 'active';

update public.client_agreements
set status = 'change_submitted'
where status = 'change_requested';

-- Allow clients to read agreement logs for their own agreements
-- (So change log can be displayed in the client portal)
create policy if not exists agreement_logs_select_client
  on public.agreement_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_agreements a
      join public.clients c on c.id = a.client_id
      where a.id = agreement_logs.agreement_id
        and c.auth_user_id = auth.uid()
        and client_has_portal_tab('agreements')
    )
  );
