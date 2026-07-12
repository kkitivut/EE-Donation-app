-- ระบบบริหารจัดการเงินบริจาค ภาควิชาวิศวกรรมไฟฟ้า (DDEE)
-- รันไฟล์นี้ทั้งไฟล์ใน Supabase SQL Editor ครั้งเดียว

-- ===== ตารางอ้างอิง =====

create table purposes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table fd13_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== ใบเสร็จบริจาค =====

create table donations (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  donor_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  receipt_date date not null,            -- เกณฑ์แยกปี (ปี พ.ศ. ของวันที่นี้)
  donated_date date,                     -- วันที่โอนเงินจริง
  purpose_id uuid references purposes(id),
  fd13_id uuid references fd13_codes(id),
  channel text,                          -- ช่องทางบริจาค เช่น โอนเงิน
  account text,                          -- ข้อมูลบัญชี เช่น EDONATION, กสิกรไทย
  category_id uuid references categories(id),
  drive_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index donations_receipt_date_idx on donations (receipt_date);
create index donations_purpose_idx on donations (purpose_id);
create index donations_category_idx on donations (category_id);

-- ===== รายจ่าย =====

create table expenses (
  id uuid primary key default gen_random_uuid(),
  doc_no text,                           -- เลขที่ส่งออก เช่น ท.13/69
  paid_date date not null,
  description text not null,
  total_amount numeric(14,2) not null check (total_amount > 0),
  drive_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_paid_date_idx on expenses (paid_date);

-- ===== การตัดเงิน: รายจ่าย 1 รายการ ตัดจากหลายใบเสร็จได้ =====

create table expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  donation_id uuid not null references donations(id),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (expense_id, donation_id)
);

create index expense_allocations_donation_idx on expense_allocations (donation_id);

-- ===== View ยอดคงเหลือต่อใบเสร็จ =====

create view donation_balances
with (security_invoker = true) as
select
  d.id as donation_id,
  d.amount,
  coalesce(sum(a.amount), 0)::numeric(14,2) as allocated,
  (d.amount - coalesce(sum(a.amount), 0))::numeric(14,2) as balance
from donations d
left join expense_allocations a on a.donation_id = d.id
group by d.id, d.amount;

-- ===== Trigger กันตัดเงินเกินยอดใบเสร็จ =====

create or replace function check_allocation_not_exceed()
returns trigger language plpgsql as $$
declare
  total_allocated numeric;
  donation_amount numeric;
begin
  select amount into donation_amount from donations where id = new.donation_id;
  select coalesce(sum(amount), 0) into total_allocated
    from expense_allocations
    where donation_id = new.donation_id
      and id is distinct from new.id;
  if total_allocated + new.amount > donation_amount then
    raise exception 'ยอดตัดเงินรวม (%.2f) เกินยอดใบเสร็จ (%.2f)',
      total_allocated + new.amount, donation_amount;
  end if;
  return new;
end $$;

create trigger allocation_not_exceed
  before insert or update on expense_allocations
  for each row execute function check_allocation_not_exceed();

-- กันแก้ยอดใบเสร็จให้ต่ำกว่าที่ตัดไปแล้ว
create or replace function check_donation_amount_not_below_allocated()
returns trigger language plpgsql as $$
declare
  total_allocated numeric;
begin
  select coalesce(sum(amount), 0) into total_allocated
    from expense_allocations where donation_id = new.id;
  if new.amount < total_allocated then
    raise exception 'ยอดใบเสร็จ (%.2f) ต่ำกว่ายอดที่ตัดจ่ายไปแล้ว (%.2f)',
      new.amount, total_allocated;
  end if;
  return new;
end $$;

create trigger donation_amount_not_below_allocated
  before update of amount on donations
  for each row execute function check_donation_amount_not_below_allocated();

-- ===== updated_at อัตโนมัติ =====

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger donations_updated_at before update on donations
  for each row execute function set_updated_at();
create trigger expenses_updated_at before update on expenses
  for each row execute function set_updated_at();

-- ===== Row Level Security: ต้อง login เท่านั้น =====

alter table purposes enable row level security;
alter table fd13_codes enable row level security;
alter table categories enable row level security;
alter table donations enable row level security;
alter table expenses enable row level security;
alter table expense_allocations enable row level security;

create policy "authenticated full access" on purposes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on fd13_codes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on categories
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on donations
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on expenses
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on expense_allocations
  for all to authenticated using (true) with check (true);

-- ===== RPC: บันทึกรายจ่าย + การตัดเงิน แบบ atomic =====

create or replace function save_expense(
  p_expense_id uuid,        -- null = สร้างใหม่, มีค่า = แก้ไข
  p_doc_no text,
  p_paid_date date,
  p_description text,
  p_total_amount numeric,
  p_drive_url text,
  p_note text,
  p_allocations jsonb       -- [{"donation_id": "...", "amount": 123.45}, ...]
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_sum numeric;
begin
  select coalesce(sum((a->>'amount')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_allocations) a;

  if v_sum <> p_total_amount then
    raise exception 'ผลรวมการตัดเงิน (%) ไม่เท่ากับยอดจ่าย (%)', v_sum, p_total_amount;
  end if;

  if p_expense_id is null then
    insert into expenses (doc_no, paid_date, description, total_amount, drive_url, note)
    values (p_doc_no, p_paid_date, p_description, p_total_amount, p_drive_url, p_note)
    returning id into v_id;
  else
    v_id := p_expense_id;
    update expenses
      set doc_no = p_doc_no,
          paid_date = p_paid_date,
          description = p_description,
          total_amount = p_total_amount,
          drive_url = p_drive_url,
          note = p_note
      where id = v_id;
    delete from expense_allocations where expense_id = v_id;
  end if;

  insert into expense_allocations (expense_id, donation_id, amount)
  select v_id, (a->>'donation_id')::uuid, (a->>'amount')::numeric
  from jsonb_array_elements(p_allocations) a;

  return v_id;
end $$;

-- ===== RPC: ยอดสะสมทั้งหมด (สำหรับ dashboard) =====

create or replace function overall_summary()
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'total_donated', coalesce((select sum(amount) from donations), 0),
    'total_allocated', coalesce((select sum(amount) from expense_allocations), 0),
    'donation_count', (select count(*) from donations)
  );
$$;

-- ===== RPC: สรุปยอดรายปี (สำหรับกราฟเปรียบเทียบรายปีบน dashboard) =====

create or replace function yearly_summary()
returns table(year int, received numeric, spent numeric)
language sql
security invoker
as $$
  select
    coalesce(d.y, a.y) as year,
    coalesce(d.received, 0) as received,
    coalesce(a.spent, 0) as spent
  from
    (select (extract(year from receipt_date)::int + 543) as y, sum(amount) as received
     from donations group by 1) d
  full outer join
    (select (extract(year from e.paid_date)::int + 543) as y, sum(ea.amount) as spent
     from expense_allocations ea join expenses e on e.id = ea.expense_id
     group by 1) a
  on d.y = a.y
  order by 1;
$$;

-- ===== ข้อมูลอ้างอิงเริ่มต้น (จาก Sheet1 ของ ข้อมูลบริจาค.xlsx) =====

insert into purposes (name, sort_order) values
  ('ข้อ 1', 1),
  ('ข้อ 2', 2),
  ('ข้อ 3', 3),
  ('ข้อ พรก.', 4),
  ('ข้อไม่ระบุวัตถุประสงค์', 5),
  ('ข้อ อื่นๆ', 6);

insert into fd13_codes (code) values
  ('N0008'), ('N0015'), ('N5555'), ('N0023'), ('N0026'), ('N0045'), ('N0142');

insert into categories (name) values
  ('ภาควิชา'), ('E-LU Lab');
