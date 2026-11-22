-- после migration_7.sql: чат, статус "отправлен", столы террасы
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check(status in('new','accepted','ready','sent','closed','rejected'));
create table if not exists messages(id bigserial primary key, order_id bigint references orders(id) on delete cascade, from_client boolean not null, text text not null, read boolean default false, created_at timestamptz default now());
create index if not exists messages_order on messages(order_id);
alter table messages enable row level security;
