-- после migration_5.sql: QR-оплата, чеки, отказ
alter table venues add column if not exists qr text;
create table if not exists receipts(order_id bigint primary key references orders(id) on delete cascade, data text not null, created_at timestamptz default now());
alter table receipts enable row level security;
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check(status in('new','accepted','ready','closed','rejected'));
