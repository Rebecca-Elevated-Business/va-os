-- Client agreement RPCs for safe client-side updates

create or replace function public.client_save_agreement_progress(
  agreement_id uuid,
  new_structure jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select id
    into v_client_id
  from clients
  where auth_user_id = auth.uid();

  if v_client_id is null then
    raise exception 'Client not found';
  end if;

  if not client_has_portal_tab('agreements') then
    raise exception 'Agreements portal not enabled';
  end if;

  update client_agreements
  set custom_structure = new_structure,
      last_updated_at = now()
  where id = agreement_id
    and client_id = v_client_id
    and is_locked = false
    and status in ('issued', 'change_submitted', 'in_use');

  if not found then
    raise exception 'Agreement not found or not available for update';
  end if;
end;
$$;

create or replace function public.client_authorise_agreement(
  agreement_id uuid,
  new_structure jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_title text;
begin
  select id
    into v_client_id
  from clients
  where auth_user_id = auth.uid();

  if v_client_id is null then
    raise exception 'Client not found';
  end if;

  if not client_has_portal_tab('agreements') then
    raise exception 'Agreements portal not enabled';
  end if;

  update client_agreements
  set status = 'in_use',
      custom_structure = new_structure,
      last_updated_at = now()
  where id = agreement_id
    and client_id = v_client_id
    and status in ('issued', 'change_submitted')
  returning title into v_title;

  if not found then
    raise exception 'Agreement not found or not available for authorisation';
  end if;

  insert into agreement_logs (
    agreement_id,
    changed_by,
    change_summary,
    snapshot
  ) values (
    agreement_id,
    auth.uid(),
    'Client authorised the agreement',
    new_structure
  );

  if not client_has_portal_tab('requests') then
    raise exception 'Requests portal not enabled';
  end if;

  insert into client_requests (
    client_id,
    type,
    message
  ) values (
    v_client_id,
    'work',
    'WORKFLOW AUTHORISED: ' || coalesce(v_title, 'Agreement')
  );
end;
$$;

create or replace function public.client_request_agreement_changes(
  agreement_id uuid,
  message text,
  new_structure jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_title text;
  v_message text;
begin
  select id
    into v_client_id
  from clients
  where auth_user_id = auth.uid();

  if v_client_id is null then
    raise exception 'Client not found';
  end if;

  if not client_has_portal_tab('agreements') then
    raise exception 'Agreements portal not enabled';
  end if;

  update client_agreements
  set status = 'change_submitted',
      custom_structure = new_structure,
      last_updated_at = now()
  where id = agreement_id
    and client_id = v_client_id
    and is_locked = false
    and status in ('issued', 'change_submitted', 'in_use')
  returning title into v_title;

  if not found then
    raise exception 'Agreement not found or not available for change request';
  end if;

  if not client_has_portal_tab('requests') then
    raise exception 'Requests portal not enabled';
  end if;

  v_message := nullif(btrim(message), '');

  insert into agreement_logs (
    agreement_id,
    changed_by,
    change_summary,
    snapshot
  ) values (
    agreement_id,
    auth.uid(),
    'Client submitted changes',
    new_structure
  );

  insert into client_requests (
    client_id,
    type,
    message
  ) values (
    v_client_id,
    'work',
    case
      when v_message is null then
        'WORKFLOW CHANGES SUBMITTED (' || coalesce(v_title, 'Agreement') || ')'
      else
        'WORKFLOW CHANGES SUBMITTED (' || coalesce(v_title, 'Agreement') || '): ' || v_message
    end
  );
end;
$$;

revoke all on function public.client_save_agreement_progress(uuid, jsonb) from public;
grant execute on function public.client_save_agreement_progress(uuid, jsonb) to authenticated;

revoke all on function public.client_authorise_agreement(uuid, jsonb) from public;
grant execute on function public.client_authorise_agreement(uuid, jsonb) to authenticated;

revoke all on function public.client_request_agreement_changes(uuid, text, jsonb) from public;
grant execute on function public.client_request_agreement_changes(uuid, text, jsonb) to authenticated;
