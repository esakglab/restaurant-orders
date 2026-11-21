-- после migration_3.sql: описание блюд
alter table menu add column if not exists description text;
