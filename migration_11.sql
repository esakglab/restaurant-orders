-- после migration_10.sql: гости без регистрации, отмена клиентом, дозаказ
alter table venues add column if not exists cancel_min int default 3;
alter table orders add column if not exists edited_at timestamptz;
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check(status in('new','accepted','ready','sent','closed','rejected','cancelled'));
