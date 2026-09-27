-- Proposed fix for an absent owner DELETE policy. Review before running.
-- Does not delete data, change foreign keys, or disable RLS.
-- Owners must already have SELECT access to their groups.
-- Inspect current policies first:
-- select policyname, cmd, roles, qual from pg_policies
-- where schemaname = 'public' and tablename = 'groups';

begin;
grant delete on public.groups to authenticated;

drop policy if exists "PoolPay managers delete own groups" on public.groups;
create policy "PoolPay managers delete own groups"
on public.groups for delete to authenticated
using (
  manager_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and lower(trim(p.role)) = 'manager'
  )
);
commit;
