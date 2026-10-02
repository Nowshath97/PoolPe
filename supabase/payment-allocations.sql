-- Apply in Supabase SQL Editor before using multi-month payments.
-- Uses existing payments and transactions; no new columns or tables.
begin;
create or replace function public.save_allocated_payment(
  p_group uuid, p_member uuid, p_payment uuid, p_receipt uuid,
  p_allocations jsonb, p_balances jsonb, p_amount numeric,
  p_date date, p_mode text, p_reference text, p_notes text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  original jsonb := '[]'::jsonb;
  receipt_row public.transactions%rowtype;
  payment_row public.payments%rowtype;
  item jsonb; ym date; actual_paid numeric; restored numeric;
  allocated numeric; obligation numeric; result_paid numeric;
  affected date[] := '{}'::date[];
  start_month date; duration_months integer;
begin
  -- Serialize all allocation changes for a member, including months with no row.
  perform 1 from public.groups where id = p_group and manager_id = auth.uid();
  if not found then raise exception 'Group unavailable'; end if;
  perform 1 from public.members where id = p_member and group_id = p_group for update;
  if not found then raise exception 'Member unavailable'; end if;
  if exists(select 1 from public.groups where id=p_group and lower(status)='inactive') then
    raise exception 'Group has not started';
  end if;
  select date_trunc('month', start::date)::date, coalesce(duration,20) into start_month, duration_months
    from public.groups where id = p_group;
  if p_payment is not null and p_receipt is not null then raise exception 'Select one payment to edit'; end if;
  if p_amount <= 0 or p_amount is null or coalesce(p_mode,'') = '' or p_date is null
    or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Invalid payment';
  end if;
  if exists(select 1 from jsonb_array_elements(p_allocations) a where a->>'month' is null or a->>'amount' is null) then
    raise exception 'Missing allocation month or amount';
  end if;
  if (select sum((a->>'amount')::numeric) from jsonb_array_elements(p_allocations) a) <> p_amount
    or exists(select 1 from jsonb_array_elements(p_allocations) a where (a->>'amount')::numeric <= 0)
    or (select count(*) from jsonb_array_elements(p_allocations)) <>
       (select count(distinct a->>'month') from jsonb_array_elements(p_allocations) a) then
    raise exception 'Invalid allocation total';
  end if;
  if p_receipt is not null then
    select * into receipt_row from public.transactions
      where id = p_receipt and group_id = p_group and member_id = p_member for update;
    if not found then raise exception 'Receipt unavailable'; end if;
    original := to_jsonb(receipt_row.allocations);
  elsif p_payment is not null then
    select * into payment_row from public.payments
      where id = p_payment and group_id = p_group and member_id = p_member for update;
    if not found then raise exception 'Payment unavailable'; end if;
    original := jsonb_build_array(jsonb_build_object('month',to_char(payment_row.month::date,'YYYY-MM'),'amount',payment_row.amount_paid));
  end if;
  if jsonb_typeof(original) <> 'array' then raise exception 'Receipt has no allocations'; end if;
  -- Require a snapshot for every affected month and reject stale balances.
  for item in select value from jsonb_array_elements(p_allocations || original) loop
    ym := ((item->>'month') || '-01')::date;
    if not (ym = any(affected)) then affected := array_append(affected,ym); end if;
  end loop;
  foreach ym in array affected loop
    if ym < start_month or ym >= start_month + make_interval(months => duration_months)
      or ym > date_trunc('month',current_date)::date then raise exception 'Invalid contribution month'; end if;
    perform 1 from public.payments where group_id=p_group and member_id=p_member and month=ym for update;
    select coalesce(sum(amount_paid),0) into actual_paid from public.payments
      where group_id=p_group and member_id=p_member and month=ym;
    select value into item from jsonb_array_elements(p_balances)
      where value->>'month'=to_char(ym,'YYYY-MM');
    if item is null or actual_paid <> (item->>'paid')::numeric then
      raise exception 'Balances changed. Reload before saving';
    end if;
    select amount_due into obligation from public.payments
      where group_id=p_group and member_id=p_member and month=ym order by id limit 1;
    obligation := coalesce(obligation,(item->>'due')::numeric);
    if obligation < 0 or obligation is null then raise exception 'Invalid obligation'; end if;
    select coalesce(sum((a->>'amount')::numeric),0) into restored from jsonb_array_elements(original) a
      where left(a->>'month',7)=to_char(ym,'YYYY-MM');
    select coalesce(sum((a->>'amount')::numeric),0) into allocated from jsonb_array_elements(p_allocations) a
      where a->>'month'=to_char(ym,'YYYY-MM');
    result_paid := actual_paid - restored + allocated;
    if result_paid < 0 or (allocated > 0 and result_paid > obligation) then
      raise exception 'Allocation exceeds available balance';
    end if;
    -- Consolidate duplicate monthly rows without counting receipts twice.
    select * into payment_row from public.payments
      where group_id=p_group and member_id=p_member and month=ym order by id limit 1;
    if found then
      update public.payments set amount_paid=0, status='pending'
        where group_id=p_group and member_id=p_member and month=ym and id<>payment_row.id;
      update public.payments set amount_paid=result_paid, amount_due=obligation,
        status=case when result_paid>=obligation then 'paid' when result_paid>0 then 'partial' else 'pending' end,
        date=p_date, mode=p_mode, reference=p_reference, notes=p_notes where id=payment_row.id;
    else
      insert into public.payments(group_id,member_id,month,amount_due,amount_paid,status,date,mode,reference,notes)
      values(p_group,p_member,ym,obligation,result_paid,
        case when result_paid>=obligation then 'paid' when result_paid>0 then 'partial' else 'pending' end,
        p_date,p_mode,p_reference,p_notes);
    end if;
  end loop;
  if p_receipt is not null then
    update public.transactions set amount=p_amount,date=p_date,mode=p_mode,reference=p_reference,
      notes=p_notes,allocations=p_allocations where id=p_receipt returning * into receipt_row;
  elsif p_payment is not null then
    -- Legacy records are cumulative monthly balances, not individual receipts.
    -- Reallocation does not fabricate a second receipt for money already received.
    return jsonb_build_object('payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.payments p
      where group_id=p_group and member_id=p_member and month=any(affected)), 'receipt',null);
  else
    insert into public.transactions(group_id,member_id,amount,date,mode,reference,notes,allocations)
      values(p_group,p_member,p_amount,p_date,p_mode,p_reference,p_notes,p_allocations) returning * into receipt_row;
  end if;
  return jsonb_build_object('payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.payments p
    where group_id=p_group and member_id=p_member and month=any(affected)), 'receipt',to_jsonb(receipt_row));
end;
$$;
revoke all on function public.save_allocated_payment(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,date,text,text,text) from public;
grant execute on function public.save_allocated_payment(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,date,text,text,text) to authenticated;
commit;
