-- ============================================================
-- FASHIONHUB PAYMENT FOUNDATION
-- Safe foundation: NO real payment provider is connected.
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  provider text not null default 'internal'
    check (provider in ('internal', 'mtn', 'airtel', 'card')),

  method text not null
    check (method in ('mobile_money', 'cash_on_delivery', 'card')),

  amount numeric(12,2) not null
    check (amount >= 0),

  currency text not null default 'UGX'
    check (currency = 'UGX'),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled',
        'refunded'
      )
    ),

  provider_reference text,
  phone_number text,
  failure_reason text,

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_id_idx
  on public.payments(order_id);

create index if not exists payments_user_id_idx
  on public.payments(user_id);

create index if not exists payments_status_idx
  on public.payments(status);

create index if not exists payments_provider_reference_idx
  on public.payments(provider_reference);

-- ------------------------------------------------------------
-- Automatic updated_at
-- ------------------------------------------------------------

create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_updated_at on public.payments;

create trigger payments_updated_at
before update on public.payments
for each row
execute function public.set_payments_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.payments enable row level security;

drop policy if exists "users can view own payments"
on public.payments;

create policy "users can view own payments"
on public.payments
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Users can create their own pending payment record.
-- Provider-side status changes must eventually happen server-side.
drop policy if exists "users can create own pending payments"
on public.payments;

create policy "users can create own pending payments"
on public.payments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
);

-- Users cannot directly mark payments as paid.
-- Do NOT create a client-side UPDATE policy.

-- ------------------------------------------------------------
-- Safe helper for payment creation
-- ------------------------------------------------------------

create or replace function public.create_pending_payment(
  p_order_id uuid,
  p_method text,
  p_amount numeric,
  p_phone_number text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin

  if p_method not in (
    'mobile_money',
    'cash_on_delivery',
    'card'
  ) then
    raise exception 'Invalid payment method';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Invalid payment amount';
  end if;

  if not exists (
    select 1
    from public.orders
    where id = p_order_id
      and buyer_id = auth.uid()
  ) then
    raise exception 'Order does not belong to current user';
  end if;

  insert into public.payments (
    order_id,
    user_id,
    provider,
    method,
    amount,
    currency,
    status,
    phone_number
  )
  values (
    p_order_id,
    auth.uid(),
    case
      when p_method = 'mobile_money' then 'internal'
      when p_method = 'card' then 'card'
      else 'internal'
    end,
    p_method,
    p_amount,
    'UGX',
    'pending',
    nullif(trim(p_phone_number), '')
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.create_pending_payment(
  uuid,
  text,
  numeric,
  text
) from public;

grant execute on function public.create_pending_payment(
  uuid,
  text,
  numeric,
  text
) to authenticated;

-- ------------------------------------------------------------
-- Payment status helper
-- Only trusted server-side code should use this later.
-- ------------------------------------------------------------

create or replace function public.mark_payment_processing(
  p_payment_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin

  update public.payments
  set
    status = 'processing',
    updated_at = now()
  where id = p_payment_id
    and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment not found or cannot be processed';
  end if;

  return v_payment;
end;
$$;

revoke all on function public.mark_payment_processing(uuid)
from public;

-- ------------------------------------------------------------
-- Comments/documentation
-- ------------------------------------------------------------

comment on table public.payments is
'FashionHub payment records. Real provider confirmation must happen server-side.';

comment on column public.payments.provider_reference is
'Reference returned by the eventual payment provider.';

comment on column public.payments.status is
'Payment lifecycle: pending, processing, paid, failed, cancelled, refunded.';

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payments'
order by ordinal_position;

select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'payments'
order by policyname;
