-- Run once in the Supabase SQL Editor to enforce the limit across clients.
begin;

create or replace function public.poolpay_validate_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE' then
    if new.group_id is not distinct from old.group_id then
      return new;
    end if;
  end if;

  -- Serialize additions to the same group before counting its members.
  perform id from public.groups where id = new.group_id for update;

  if (select count(*) from public.members where group_id = new.group_id) >= 20 then
    raise exception 'A group can have a maximum of 20 members.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.poolpay_validate_member_limit() from public;

drop trigger if exists poolpay_member_limit on public.members;
create trigger poolpay_member_limit
before insert or update of group_id on public.members
for each row execute function public.poolpay_validate_member_limit();

commit;
