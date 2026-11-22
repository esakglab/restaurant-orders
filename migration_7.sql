-- после migration_6.sql: скрытие истории у клиента
alter table orders add column if not exists hide_client boolean default false;
