-- Run in Supabase SQL Editor. Requires owners to be able to read their groups and members.
-- Adds scoped policies; existing policies are not removed.
begin;

alter table public.payments enable row level security;
grant select, insert, update on public.payments to authenticated;

drop policy if exists "PoolPay owners select payments" on public.payments;
create policy "PoolPay owners select payments" on public.payments
for select to authenticated
using (exists (
    select 1 from public.groups g
    where g.id = payments.group_id
      and g.manager_id = (select auth.uid())
  ));

drop policy if exists "PoolPay owners insert payments" on public.payments;
create policy "PoolPay owners insert payments" on public.payments
for insert to authenticated
with check (exists (
    select 1 from public.groups g
    where g.id = payments.group_id
      and g.manager_id = (select auth.uid())
  ) and exists (
    select 1 from public.members m
    where m.id = payments.member_id and m.group_id = payments.group_id
  ));

drop policy if exists "PoolPay owners update payments" on public.payments;
create policy "PoolPay owners update payments" on public.payments
for update to authenticated
using (exists (
    select 1 from public.groups g
    where g.id = payments.group_id
      and g.manager_id = (select auth.uid())
  ))
with check (exists (
    select 1 from public.groups g
    where g.id = payments.group_id
      and g.manager_id = (select auth.uid())
  ) and exists (
    select 1 from public.members m
    where m.id = payments.member_id and m.group_id = payments.group_id
  ));

alter table public.transactions enable row level security;
grant select, insert on public.transactions to authenticated;

drop policy if exists "PoolPay owners select transactions" on public.transactions;
create policy "PoolPay owners select transactions" on public.transactions
for select to authenticated
using (exists (
    select 1 from public.groups g
    where g.id = transactions.group_id
      and g.manager_id = (select auth.uid())
  ));

drop policy if exists "PoolPay owners insert transactions" on public.transactions;
create policy "PoolPay owners insert transactions" on public.transactions
for insert to authenticated
with check (exists (
    select 1 from public.groups g
    where g.id = transactions.group_id
      and g.manager_id = (select auth.uid())
  ) and exists (
    select 1 from public.members m
    where m.id = transactions.member_id and m.group_id = transactions.group_id
  ));

commit;
