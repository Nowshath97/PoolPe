-- Run once in Supabase SQL Editor. Existing duplicate allocations cause
-- the transaction to fail; review those records rather than deleting winners.
begin;
drop trigger if exists poolpay_validate_bid on public.auctions;

-- Derive the cycle number for existing records from their calendar month.
update public.auctions a
set lift_month =
  (extract(year from (left(a.month::text, 7) || '-01')::date)::integer
   - extract(year from g.start::date)::integer) * 12
  + extract(month from (left(a.month::text, 7) || '-01')::date)::integer
  - extract(month from g.start::date)::integer + 1
from public.groups g where g.id = a.group_id;

create unique index if not exists poolpay_one_bid_per_cycle_month
on public.auctions (group_id, lift_month);
create unique index if not exists poolpay_one_bid_per_member
on public.auctions (group_id, winner_member_id);

create or replace function public.poolpay_validate_bid()
returns trigger language plpgsql set search_path = '' as $$
declare
  pool public.groups%rowtype;
  bid_month date;
  current_month date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  cycle_number integer;
begin
  if TG_OP = 'UPDATE' then
    raise exception 'An allotted bid cannot be changed.';
  end if;
  select * into pool from public.groups where id = new.group_id;
  if not found or pool.manager_id is distinct from auth.uid() then
    raise exception 'Only the group manager can allot a bid.';
  end if;
  bid_month := (left(new.month::text, 7) || '-01')::date;
  if bid_month is null or bid_month <> current_month then
    raise exception 'Bids can only be allotted for the current running month.';
  end if;
  cycle_number := (extract(year from bid_month)::integer - extract(year from pool.start::date)::integer) * 12
    + extract(month from bid_month)::integer - extract(month from pool.start::date)::integer + 1;
  if cycle_number is null or pool.duration is null or cycle_number < 1 or cycle_number > pool.duration then
    raise exception 'Bidding is only allowed within the group cycle.';
  end if;
  if not exists (select 1 from public.members where id = new.winner_member_id and group_id = new.group_id) then
    raise exception 'The recipient must belong to this group.';
  end if;
  if new.payout_amount is null or new.payout_amount <= 0 then
    raise exception 'Enter a positive payout.';
  end if;
  new.lift_month := cycle_number;
  return new;
end;
$$;

drop trigger if exists poolpay_validate_bid on public.auctions;
create trigger poolpay_validate_bid before insert or update on public.auctions
for each row execute function public.poolpay_validate_bid();

alter table public.auctions enable row level security;
grant select, insert on public.auctions to authenticated;
drop policy if exists "PoolPay owners allot bids" on public.auctions;
create policy "PoolPay owners allot bids" on public.auctions
for insert to authenticated with check (
  exists (select 1 from public.groups g where g.id = group_id and g.manager_id = (select auth.uid()))
);
drop policy if exists "PoolPay owners read bids" on public.auctions;
create policy "PoolPay owners read bids" on public.auctions
for select to authenticated using (
  exists (select 1 from public.groups g where g.id = group_id and g.manager_id = (select auth.uid()))
);
commit;
