-- R&J schema v0.2 — local / Prisma migrate
-- Source: docs/architecture/schema.sql
--
-- Vanilla Postgres. No auth schema, no RLS.
-- Do not apply to the live Supabase project (3-table MVP).
-- For a new Supabase project, run docs/architecture/schema.sql instead
-- (profiles.id → auth.users, JWT helpers, RLS).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.next_order_no()
returns text
language plpgsql
as $$
declare
  day_key text := to_char(timezone('Asia/Seoul', now()), 'YYYYMMDD');
  seq int;
begin
  perform pg_advisory_xact_lock(hashtext('order_no:' || day_key));
  select coalesce(max(substring(order_no from 13)::int), 0) + 1
    into seq
  from public.orders
  where order_no like 'RJ-' || day_key || '-%';
  return 'RJ-' || day_key || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- 1. profiles (local: no auth.users FK. App supplies id = auth user id.)
create table public.profiles (
  id uuid primary key,
  email text not null,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));
create unique index profiles_phone_idx on public.profiles (phone) where phone is not null;

comment on table public.profiles is '로그인한 사람. 역할 컬럼 없음. 현상소 권한은 lab_members.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 2. addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  postal_code text not null,
  address1 text not null,
  address2 text,
  memo text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);

comment on table public.addresses is '저장 주소. 주문에는 pickup_* 스냅샷만 남긴다.';

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

create or replace function public.ensure_single_default_address()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id
      and id is distinct from new.id
      and is_default = true;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default
before insert or update of is_default on public.addresses
for each row execute function public.ensure_single_default_address();

-- 3. labs
create table public.labs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  logo_url text,
  hero_image_url text,
  average_turnaround_days int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labs_turnaround_positive check (
    average_turnaround_days is null or average_turnaround_days > 0
  )
);

comment on table public.labs is '현상소 조직. auth.users와 1:1이 아니다.';

create trigger labs_set_updated_at
before update on public.labs
for each row execute function public.set_updated_at();

-- 4. lab_members
create table public.lab_members (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_members_role_check check (role in ('OWNER', 'STAFF')),
  constraint lab_members_unique unique (lab_id, profile_id)
);

create index lab_members_profile_id_idx on public.lab_members (profile_id);

comment on table public.lab_members is '현상소 Admin 권한. OWNER | STAFF.';

create trigger lab_members_set_updated_at
before update on public.lab_members
for each row execute function public.set_updated_at();

-- 5. lab_services
create table public.lab_services (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  film_type text not null,
  process_type text not null,
  scan_type text,
  price_krw int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_services_price_nonnegative check (price_krw >= 0)
);

create unique index lab_services_catalog_idx
  on public.lab_services (lab_id, film_type, process_type, coalesce(scan_type, ''));

create index lab_services_lab_id_idx on public.lab_services (lab_id) where is_active;

comment on table public.lab_services is '실시간 가격표. 결제 후 단가를 바꿔도 과거 order_items는 불변.';

create trigger lab_services_set_updated_at
before update on public.lab_services
for each row execute function public.set_updated_at();

-- 6. orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  lab_id uuid not null references public.labs (id) on delete restrict,
  status text not null default 'PAYMENT_PENDING',
  roll_count int not null,
  subtotal_krw int not null,

  pickup_recipient_name text,
  pickup_phone text,
  pickup_postal_code text,
  pickup_address1 text,
  pickup_address2 text,
  pickup_memo text,

  paid_at timestamptz,
  lab_received_at timestamptz,
  photos_ready_at timestamptz,
  photos_expires_at timestamptz,
  files_deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_roll_count_positive check (roll_count > 0),
  constraint orders_subtotal_nonnegative check (subtotal_krw >= 0),
  constraint orders_status_check check (
    status in (
      'PAYMENT_PENDING',
      'PICKUP_PENDING',
      'IN_TRANSIT',
      'AT_LAB',
      'PROCESSING',
      'RESULTS_READY',
      'CLOSED',
      'CANCELLED'
    )
  ),
  constraint orders_expiry_after_ready check (
    photos_expires_at is null
    or photos_ready_at is not null
  )
);

create index orders_status_created_at_idx on public.orders (status, created_at desc);
create index orders_lab_id_status_idx on public.orders (lab_id, status);
create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index orders_photos_expires_at_idx
  on public.orders (photos_expires_at)
  where files_deleted_at is null and photos_expires_at is not null;

comment on table public.orders is '운영 허브. status는 위치 최소집합. 세부 상태는 shipment/roll/payment/photo/issue.';
comment on column public.orders.roll_count is 'order_items.quantity 합. 리스트용 비정규화.';
comment on column public.orders.status is '운영 위치 최소집합. 세부 상태는 shipment/roll/payment/photo/issue. 소스: state-machines.md';

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- 7. order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  lab_service_id uuid references public.lab_services (id) on delete set null,
  film_type text not null,
  process_type text not null,
  scan_type text,
  quantity int not null,
  unit_price_krw int not null,
  line_total_krw int not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonnegative check (unit_price_krw >= 0),
  constraint order_items_line_total_check check (line_total_krw = quantity * unit_price_krw)
);

create index order_items_order_id_idx on public.order_items (order_id);

comment on table public.order_items is '결제 당시 상품/가격 스냅샷. 결제 후 변경 금지.';

-- 8. payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  method text,
  amount_krw int not null,
  status text not null default 'PENDING',
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_nonnegative check (amount_krw >= 0),
  constraint payments_status_check check (
    status in (
      'PENDING',
      'PROCESSING',
      'PAID',
      'FAILED',
      'PARTIALLY_REFUNDED',
      'REFUNDED'
    )
  )
);

create unique index payments_provider_payment_id_idx
  on public.payments (provider_payment_id)
  where provider_payment_id is not null;

create index payments_order_id_idx on public.payments (order_id);

create unique index payments_one_active_per_order_idx
  on public.payments (order_id)
  where status in ('PENDING', 'PROCESSING');

comment on table public.payments is 'PG 시도. 주문 1:N. 성공 여부는 백엔드가 승인 결과로 확정.';

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- 9. shipments
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  direction text not null default 'INBOUND',
  status text not null default 'PENDING',
  carrier text,
  tracking_no text,
  pickup_scheduled_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_direction_check check (direction in ('INBOUND', 'RETURN')),
  constraint shipments_status_check check (
    status in (
      'PENDING',
      'BOOKED',
      'PICKUP_SCHEDULED',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
      'FAILED',
      'CANCELLED'
    )
  )
);

create index shipments_order_id_idx on public.shipments (order_id);
create index shipments_tracking_no_idx on public.shipments (tracking_no) where tracking_no is not null;

comment on table public.shipments is '실물 이동. 1:N. MVP는 INBOUND. DELIVERED ≠ 입고완료.';

create trigger shipments_set_updated_at
before update on public.shipments
for each row execute function public.set_updated_at();

-- 10. rolls
create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  seq int not null,
  status text not null default 'EXPECTED',

  actual_film_type text,
  actual_process_type text,

  photo_count int not null default 0,

  received_at timestamptz,
  development_started_at timestamptz,
  development_completed_at timestamptz,
  scan_started_at timestamptz,
  scan_completed_at timestamptz,
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rolls_seq_positive check (seq > 0),
  constraint rolls_photo_count_nonnegative check (photo_count >= 0),
  constraint rolls_order_seq unique (order_id, seq),
  constraint rolls_status_check check (
    status in (
      'EXPECTED',
      'RECEIVED',
      'DEVELOPING',
      'DEVELOPED',
      'SCANNING',
      'UPLOADING',
      'READY'
    )
  )
);

create index rolls_order_item_id_idx on public.rolls (order_item_id);
create index rolls_order_id_status_idx on public.rolls (order_id, status);

comment on table public.rolls is '현상 작업이자 갤러리 단위. 결제 직후 quantity만큼 생성.';

create trigger rolls_set_updated_at
before update on public.rolls
for each row execute function public.set_updated_at();

create or replace function public.assert_roll_belongs_to_order_item()
returns trigger
language plpgsql
as $$
declare
  item_order_id uuid;
begin
  select order_id into item_order_id
  from public.order_items
  where id = new.order_item_id;

  if item_order_id is null or item_order_id <> new.order_id then
    raise exception 'roll.order_id must equal roll.order_item.order_id';
  end if;
  return new;
end;
$$;

create trigger rolls_assert_order_item
before insert or update of order_id, order_item_id on public.rolls
for each row execute function public.assert_roll_belongs_to_order_item();

-- 11. photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.rolls (id) on delete cascade,
  storage_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null,
  width int,
  height int,
  sort_order int not null default 0,
  upload_session_id uuid,
  upload_status text not null default 'PENDING',
  uploaded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photos_file_size_nonnegative check (file_size >= 0),
  constraint photos_upload_status_check check (
    upload_status in ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'DELETED')
  )
);

create index photos_roll_id_sort_order_idx on public.photos (roll_id, sort_order);
create index photos_upload_session_id_idx on public.photos (upload_session_id)
  where upload_session_id is not null;

comment on table public.photos is 'R2 object metadata. Public URL 저장 금지.';
comment on column public.photos.storage_key is 'orders/{orderId}/rolls/{rollId}/photos/{photoId}.jpg';
comment on column public.photos.upload_session_id is 'Batch drop session. No separate sessions table.';

create trigger photos_set_updated_at
before update on public.photos
for each row execute function public.set_updated_at();

-- 12. order_events
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null,
  from_status text,
  to_status text,
  actor_type text not null,
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint order_events_actor_type_check check (
    actor_type in ('USER', 'LAB_MEMBER', 'R&J_ADMIN', 'SYSTEM')
  )
);

create index order_events_order_id_created_at_idx
  on public.order_events (order_id, created_at desc);

comment on table public.order_events is '주문 타임라인. 리스트 보드는 orders.status만 본다.';

-- 13. issues
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  roll_id uuid references public.rolls (id) on delete set null,
  type text not null,
  status text not null default 'OPEN',
  description text,
  reported_by uuid references public.profiles (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint issues_type_check check (
    type in (
      'ROLL_COUNT_MISMATCH',
      'FILM_TYPE_MISMATCH',
      'DAMAGED_FILM',
      'SHIPPING',
      'SCAN',
      'OTHER'
    )
  ),
  constraint issues_status_check check (
    status in ('OPEN', 'WAITING_CUSTOMER', 'WAITING_LAB', 'RESOLVED')
  )
);

create index issues_order_id_status_idx on public.issues (order_id, status);
create index issues_open_idx on public.issues (status) where status <> 'RESOLVED';
create unique index issues_one_open_shipping_per_order
  on public.issues (order_id)
  where type = 'SHIPPING' and status = 'OPEN';

comment on table public.issues is '운영 예외. order_id 필수, roll_id 선택. 주문 status를 대체하지 않는다.';

create or replace function public.assert_issue_roll_belongs_to_order()
returns trigger
language plpgsql
as $$
declare
  roll_order_id uuid;
begin
  if new.roll_id is null then
    return new;
  end if;
  select order_id into roll_order_id from public.rolls where id = new.roll_id;
  if roll_order_id is null or roll_order_id <> new.order_id then
    raise exception 'issue.roll_id must belong to issue.order_id';
  end if;
  return new;
end;
$$;

create trigger issues_assert_roll_order
before insert or update of order_id, roll_id on public.issues
for each row execute function public.assert_issue_roll_belongs_to_order();

-- 14. notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null,
  channel text not null,
  status text not null default 'PENDING',
  title text not null,
  body text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_status_check check (status in ('PENDING', 'SENT', 'FAILED'))
);

create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);
create index notifications_status_scheduled_at_idx
  on public.notifications (status, scheduled_at)
  where sent_at is null;

comment on table public.notifications is 'PHOTOS_READY, FILES_EXPIRE_10_DAYS / 3_DAYS / 1_DAY.';
