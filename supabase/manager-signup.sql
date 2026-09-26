-- Run in Supabase SQL Editor before enabling the signup page.
-- Phone-only accounts have no email address.
begin;
alter table public.profiles alter column email drop not null;

create or replace function public.poolpay_create_manager_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Public manager registration is intentional. Never copy an arbitrary
  -- role from client metadata; this path can only assign 'manager'.
  if new.raw_user_meta_data ->> 'signup_kind' = 'manager' then
    insert into public.profiles (id, name, email, role)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'PoolPay Manager'),
      new.email,
      'manager'
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      role = excluded.role;
  end if;
  return new;
end;
$$;

revoke all on function public.poolpay_create_manager_profile() from public, anon, authenticated;

-- This runs after existing alphabetically earlier profile-insert triggers.
drop trigger if exists zzzz_poolpay_manager_signup on auth.users;
create trigger zzzz_poolpay_manager_signup
after insert on auth.users
for each row execute function public.poolpay_create_manager_profile();

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
drop policy if exists "PoolPay signup profile read" on public.profiles;
create policy "PoolPay signup profile read"
on public.profiles for select to authenticated
using (id = (select auth.uid()));
commit;
