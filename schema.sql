-- Выполнить целиком в Supabase → SQL Editor
create extension if not exists pgcrypto;
create table if not exists users(id uuid primary key default gen_random_uuid(), role text not null check(role in('owner','admin','staff','customer')), name text not null, nick text, phone text unique not null, pass_hash text not null, created_at timestamptz default now());
create table if not exists settings(id int primary key default 1 check(id=1), name text default 'Моё заведение', welcome text default 'Добро пожаловать! Выбирайте блюда и оформляйте заказ.', points jsonb default '["Главный зал"]');
insert into settings(id) values(1) on conflict do nothing;
create table if not exists menu(id bigserial primary key, name text not null, category text default 'Основное', price numeric(10,2) not null check(price>=0), photo text);
create table if not exists orders(id bigserial primary key, user_id uuid references users(id), items jsonb not null, total numeric(10,2) not null, type text not null check(type in('takeaway','dinein','delivery')), point text, address text, comment text, status text default 'new' check(status in('new','accepted','ready')), staff_name text, accepted_at timestamptz, ready_at timestamptz, created_at timestamptz default now());
create table if not exists notifs(id bigserial primary key, user_id uuid references users(id) on delete cascade, text text not null, read boolean default false, created_at timestamptz default now());
create index if not exists orders_user on orders(user_id); create index if not exists notifs_user on notifs(user_id);
-- Защита: RLS включён, политик нет → доступ только через наш сервер (service key). Публичный anon-ключ ничего не видит.
alter table users enable row level security; alter table settings enable row level security; alter table menu enable row level security; alter table orders enable row level security; alter table notifs enable row level security;
insert into menu(name,category,price) select * from (values('Плов','Горячее',320),('Лагман','Горячее',280),('Самса','Выпечка',90),('Чай','Напитки',60)) v where not exists(select 1 from menu);
