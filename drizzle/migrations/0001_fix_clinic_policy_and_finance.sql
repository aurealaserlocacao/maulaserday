
drop policy "members read clinic" on public.clinics;
create policy "members read clinic" on public.clinics for select to authenticated
  using (public.has_role(auth.uid(),'platform_admin')
     or exists (select 1 from public.clinic_memberships m where m.clinic_id = clinics.id and m.user_id = auth.uid()));

create type public.payment_kind as enum ('receipt','refund');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid references public.appointments(id),
  client_id uuid references public.clients(id),
  kind public.payment_kind not null default 'receipt',
  refund_of uuid references public.payments(id),
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null default 'pix',
  paid_on date not null default current_date,
  description text,
  is_no_show_fee boolean not null default false,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payments(clinic_id, paid_on);
create index on public.payments(appointment_id);
grant select, insert, update on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "clinic payments select" on public.payments for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "clinic payments insert" on public.payments for insert to authenticated with check (public.is_clinic_member(clinic_id));
create policy "clinic payments update" on public.payments for update to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create or replace function public.compute_fin_status(_appt uuid, _final numeric)
returns public.financial_status language plpgsql stable security definer set search_path = public as $$
declare rec numeric; ref numeric;
begin
  select coalesce(sum(amount) filter (where kind='receipt'),0), coalesce(sum(amount) filter (where kind='refund'),0)
    into rec, ref from public.payments where appointment_id = _appt;
  if rec - ref <= 0 then
    return case when ref > 0 then 'refunded'::financial_status else 'pending'::financial_status end;
  end if;
  if _final is null or rec - ref >= _final then return 'paid'; end if;
  return 'partial';
end $$;

create or replace function public.payment_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; avail numeric; orig record;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    -- only descriptive fields may change; amounts are corrected via refunds
    if new.amount <> old.amount or new.kind <> old.kind or new.clinic_id <> old.clinic_id
       or new.appointment_id is distinct from old.appointment_id or new.refund_of is distinct from old.refund_of then
      raise exception 'Valor não pode ser alterado; registre um estorno';
    end if;
    return new;
  end if;
  new.created_by := auth.uid();
  if new.appointment_id is not null then
    select clinic_id, client_id into a from public.appointments where id = new.appointment_id;
    if a.clinic_id is distinct from new.clinic_id then raise exception 'Operação não permitida'; end if;
    new.client_id := a.client_id;
  elsif new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and clinic_id = new.clinic_id) then
    raise exception 'Operação não permitida';
  end if;
  if new.kind = 'refund' then
    select * into orig from public.payments where id = new.refund_of and kind = 'receipt' and clinic_id = new.clinic_id;
    if orig.id is null then raise exception 'Estorno precisa referenciar um recebimento'; end if;
    select orig.amount - coalesce(sum(amount),0) into avail from public.payments where refund_of = orig.id;
    if new.amount > avail then raise exception 'Estorno maior que o valor disponível'; end if;
    new.appointment_id := orig.appointment_id;
    new.client_id := orig.client_id;
  else
    new.refund_of := null;
  end if;
  return new;
end $$;
create trigger payments_before before insert or update on public.payments
  for each row execute function public.payment_before();

create or replace function public.payment_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.appointment_id is not null then
    update public.appointments set financial_status = public.compute_fin_status(id, final_amount) where id = new.appointment_id;
    insert into public.appointment_events(appointment_id, clinic_id, actor_id, kind, details)
    values (new.appointment_id, new.clinic_id, auth.uid(), case when tg_op='INSERT' then 'payment_' || new.kind else 'payment_edit' end,
      jsonb_build_object('amount', new.amount, 'method', new.method));
  end if;
  perform public.log_audit(new.clinic_id,
    case when tg_op='UPDATE' then 'payment.updated' when new.kind='refund' then 'payment.refunded' else 'payment.created' end,
    'payment', new.id, jsonb_build_object('amount', new.amount));
  return new;
end $$;
create trigger payments_after after insert or update on public.payments
  for each row execute function public.payment_after();

-- keep financial status in sync when the final amount changes
create or replace function public.appointment_fin_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.final_amount is distinct from old.final_amount then
    new.financial_status := public.compute_fin_status(new.id, new.final_amount);
  end if;
  return new;
end $$;
create trigger appointments_fin_sync before update on public.appointments
  for each row execute function public.appointment_fin_sync();

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);
grant select, insert, delete on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;
alter table public.expense_categories enable row level security;
create policy "clinic categories" on public.expense_categories for all to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default current_date,
  method public.payment_method,
  notes text,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.expenses(clinic_id, spent_on);
grant select, insert, update on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "clinic expenses select" on public.expenses for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "clinic expenses insert" on public.expenses for insert to authenticated with check (public.is_clinic_member(clinic_id));
create policy "clinic expenses update" on public.expenses for update to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create or replace function public.expense_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.clinic_id <> old.clinic_id then raise exception 'Operação não permitida'; end if;
  perform public.log_audit(new.clinic_id,
    case when tg_op='INSERT' then 'expense.created' when new.archived_at is not null and old.archived_at is null then 'expense.removed' else 'expense.updated' end,
    'expense', new.id, jsonb_build_object('amount', new.amount, 'previous_amount', case when tg_op='UPDATE' then old.amount end));
  return new;
end $$;
create or replace function public.expense_before()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger expenses_before before insert or update on public.expenses for each row execute function public.expense_before();
create trigger expenses_after after insert or update on public.expenses for each row execute function public.expense_audit();
