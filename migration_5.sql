-- после migration_4.sql: оплата заказов
alter table orders add column if not exists pay_method text check(pay_method in('cash','online')), add column if not exists cash_given numeric(10,2), add column if not exists paid boolean default false, add column if not exists paid_at timestamptz;
