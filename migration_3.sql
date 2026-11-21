-- Выполнить после migration_2.sql: столы, официанты, закрытие заказа
create table if not exists tables(id bigserial primary key, venue_id bigint references venues(id) on delete cascade, num int not null, zone text default 'Главный зал', unique(venue_id,num));
alter table tables enable row level security;
alter table orders add column if not exists table_id bigint references tables(id) on delete set null;
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check(status in('new','accepted','ready','closed'));
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check(role in('owner','admin','terminal','waiter','customer'));
insert into tables(venue_id,num) select v.id,g from venues v, generate_series(1,12) g on conflict do nothing;
create index if not exists orders_table on orders(table_id);
