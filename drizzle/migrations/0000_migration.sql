
create extension if not exists btree_gist with schema extensions;

-- ===== ENUMS =====
create type public.app_role as enum ('platform_admin');
create type public.clinic_access_status as enum ('active','suspended');
create type public.membership_role as enum ('owner','staff');
create type public.rental_status as enum ('active','ended','pending');
create type public.appointment_status as enum ('pending','confirmed','in_progress','completed','no_show','cancelled');
create type public.financial_status as enum ('pending','partial','paid','refunded');
create type public.payment_method as enum ('pix','cash','card','transfer','other');

-- ===== PROFILES / ROLES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'platform_admin'));

-- ===== CLINICS =====
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_name text,
  contact_email text,
  phone text,
  address text,
  business_info text,
  timezone text not null default 'America/Sao_Paulo',
  default_duration_min int not null default 60,
  access_status public.clinic_access_status not null default 'active',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.clinics to authenticated;
grant all on public.clinics to service_role;
alter table public.clinics enable row level security;

create table public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role public.membership_role not null default 'owner',
  active boolean not null default true,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, clinic_id)
);
create index on public.clinic_memberships(user_id);
grant select on public.clinic_memberships to authenticated;
grant all on public.clinic_memberships to service_role;
alter table public.clinic_memberships enable row level security;

create or replace function public.is_clinic_member(_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_memberships m
    join public.clinics c on c.id = m.clinic_id
    where m.clinic_id = _clinic_id and m.user_id = auth.uid()
      and m.active and c.access_status = 'active'
  )
$$;

create policy "members see memberships" on public.clinic_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'platform_admin'));

create policy "members read clinic" on public.clinics for select to authenticated
  using (public.has_role(auth.uid(),'platform_admin')
     or exists (select 1 from public.clinic_memberships m where m.clinic_id = id and m.user_id = auth.uid()));
create policy "members update clinic" on public.clinics for update to authenticated
  using (public.is_clinic_member(id)) with check (public.is_clinic_member(id));

-- clinic members cannot change admin-only columns
create or replace function public.protect_clinic_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'platform_admin') then
    new.access_status := old.access_status;
    new.admin_notes := old.admin_notes;
    new.contact_email := old.contact_email;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger clinics_protect before update on public.clinics
  for each row execute function public.protect_clinic_admin_fields();

create policy "profile self" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'platform_admin'));
create policy "profile self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profile self insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- ===== RENTALS =====
create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  equipment text not null,
  starts_on date,
  ends_on date,
  status public.rental_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.rentals(clinic_id);
grant select on public.rentals to authenticated;
grant all on public.rentals to service_role;
alter table public.rentals enable row level security;
create policy "admin reads rentals" on public.rentals for select to authenticated
  using (public.has_role(auth.uid(),'platform_admin'));

-- ===== AUDIT =====
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  clinic_id uuid references public.clinics(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs(clinic_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admin reads audit" on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'platform_admin'));
create policy "clinic reads own audit" on public.audit_logs for select to authenticated
  using (clinic_id is not null and public.is_clinic_member(clinic_id));

create or replace function public.log_audit(_clinic uuid, _action text, _entity text, _entity_id uuid, _meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor_id, clinic_id, action, entity, entity_id, metadata)
  values (auth.uid(), _clinic, _action, _entity, _entity_id, coalesce(_meta,'{}'::jsonb));
$$;
revoke execute on function public.log_audit(uuid,text,text,uuid,jsonb) from public, anon;

-- ===== NEW USER =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  -- bootstrap: first account ever becomes platform admin
  if not exists (select 1 from public.user_roles where role = 'platform_admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'platform_admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== CLIENTS =====
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  phone text not null,
  phone_normalized text not null,
  email text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, phone_normalized)
);
create index on public.clients(clinic_id, full_name);
grant select, insert, update on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "clinic clients" on public.clients for all to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create or replace function public.normalize_client_phone()
returns trigger language plpgsql set search_path = public as $$
begin
  new.phone_normalized := regexp_replace(new.phone, '\D', '', 'g');
  if length(new.phone_normalized) < 10 then raise exception 'Telefone inválido'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger clients_phone before insert or update on public.clients
  for each row execute function public.normalize_client_phone();

-- ===== BLOCKED TIMES =====
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.blocked_times(clinic_id, starts_at);
grant select, insert, update, delete on public.blocked_times to authenticated;
grant all on public.blocked_times to service_role;
alter table public.blocked_times enable row level security;
create policy "clinic blocks" on public.blocked_times for all to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

-- ===== APPOINTMENTS =====
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  starts_at timestamptz not null,
  duration_min int not null check (duration_min between 5 and 720),
  ends_at timestamptz not null,
  areas text[] not null default '{}',
  areas_note text,
  expected_amount numeric(12,2),
  final_amount numeric(12,2),
  internal_notes text,
  session_notes text,
  status public.appointment_status not null default 'pending',
  financial_status public.financial_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    clinic_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled','no_show'))
);
create index on public.appointments(clinic_id, starts_at);
create index on public.appointments(client_id);
grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "clinic appts" on public.appointments for all to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_id uuid,
  kind text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.appointment_events(appointment_id, created_at);
grant select on public.appointment_events to authenticated;
grant all on public.appointment_events to service_role;
alter table public.appointment_events enable row level security;
create policy "clinic appt events" on public.appointment_events for select to authenticated
  using (public.is_clinic_member(clinic_id));

create or replace function public.appointment_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);
  new.updated_at := now();
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.clinic_id = new.clinic_id) then
    raise exception 'Cliente não pertence a esta clínica';
  end if;
  if new.status not in ('cancelled','no_show') and exists (
    select 1 from public.blocked_times b where b.clinic_id = new.clinic_id
      and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then
    raise exception 'Horário bloqueado na agenda';
  end if;
  if tg_op = 'UPDATE' then
    if new.clinic_id <> old.clinic_id then raise exception 'Operação não permitida'; end if;
    if new.status <> old.status then
      ok := case old.status
        when 'pending' then new.status in ('confirmed','in_progress','cancelled','no_show')
        when 'confirmed' then new.status in ('pending','in_progress','cancelled','no_show')
        when 'in_progress' then new.status in ('completed','confirmed')
        when 'completed' then new.status in ('in_progress')
        when 'no_show' then new.status in ('pending','confirmed')
        when 'cancelled' then new.status in ('pending','confirmed')
      end;
      if not ok then raise exception 'Mudança de status não permitida'; end if;
      if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
      if new.status = 'completed' then new.completed_at := now(); end if;
    end if;
  else
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
create trigger appointments_before before insert or update on public.appointments
  for each row execute function public.appointment_before();

create or replace function public.appointment_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := '{}'; k text;
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_events(appointment_id, clinic_id, actor_id, kind, details)
    values (new.id, new.clinic_id, auth.uid(), 'created', jsonb_build_object('starts_at', new.starts_at, 'duration_min', new.duration_min));
    perform public.log_audit(new.clinic_id, 'appointment.created', 'appointment', new.id, '{}');
    return new;
  end if;
  if new.status <> old.status then
    insert into public.appointment_events(appointment_id, clinic_id, actor_id, kind, details)
    values (new.id, new.clinic_id, auth.uid(), 'status', jsonb_build_object('from', old.status, 'to', new.status));
    k := 'appointment.status.' || new.status;
    perform public.log_audit(new.clinic_id, k, 'appointment', new.id, jsonb_build_object('from', old.status));
  end if;
  if new.starts_at <> old.starts_at or new.duration_min <> old.duration_min then
    insert into public.appointment_events(appointment_id, clinic_id, actor_id, kind, details)
    values (new.id, new.clinic_id, auth.uid(), 'rescheduled', jsonb_build_object('from', old.starts_at, 'to', new.starts_at, 'from_dur', old.duration_min, 'to_dur', new.duration_min));
    perform public.log_audit(new.clinic_id, 'appointment.rescheduled', 'appointment', new.id, '{}');
  end if;
  if new.final_amount is distinct from old.final_amount then
    insert into public.appointment_events(appointment_id, clinic_id, actor_id, kind, details)
    values (new.id, new.clinic_id, auth.uid(), 'final_amount', jsonb_build_object('from', old.final_amount, 'to', new.final_amount));
  end if;
  if new.areas is distinct from old.areas or new.areas_note is distinct from old.areas_note then
    insert into public.appointment_events(appointment_id, clinic_id, actor_id, kind, details)
    values (new.id, new.clinic_id, auth.uid(), 'areas', jsonb_build_object('to', new.areas));
  end if;
  return new;
end $$;
create trigger appointments_after after insert or update on public.appointments
  for each row execute function public.appointment_after();

-- ===== MESSAGE TEMPLATES =====
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  kind text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (clinic_id, kind)
);
grant select, insert, update, delete on public.message_templates to authenticated;
grant all on public.message_templates to service_role;
alter table public.message_templates enable row level security;
create policy "clinic templates" on public.message_templates for all to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

-- ===== ADMIN SUPPORT ACCESS LOG RPC =====
create or replace function public.admin_log_support_access(_clinic uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'platform_admin') then raise exception 'Não autorizado'; end if;
  perform public.log_audit(_clinic, 'admin.support_access', 'clinic', _clinic, jsonb_build_object('reason', left(_reason, 200)));
end $$;
grant execute on function public.admin_log_support_access(uuid,text) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_clinic_member(uuid) to authenticated;
