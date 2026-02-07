-- Align client portal setup RPCs with current CRM schema

create or replace function public.get_client_setup_profile(
  client_id uuid
)
returns table (
  first_name text,
  surname text
)
language sql
security definer
set search_path = public
as $$
  select c.first_name, c.surname
  from clients c
  where c.id = client_id
    and c.portal_invite_link is not null
    and c.portal_access_revoked_at is null;
$$;

create or replace function public.link_client_account(
  client_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update clients
  set auth_user_id = auth.uid(),
      portal_access_enabled = true,
      portal_access_revoked_at = null,
      portal_invite_link = null
  where id = client_id
    and portal_invite_link is not null
    and portal_access_revoked_at is null;

  if not found then
    raise exception 'Client not found or portal access not available';
  end if;
end;
$$;

revoke all on function public.get_client_setup_profile(uuid) from public;
grant execute on function public.get_client_setup_profile(uuid) to authenticated;

revoke all on function public.link_client_account(uuid) from public;
grant execute on function public.link_client_account(uuid) to authenticated;
