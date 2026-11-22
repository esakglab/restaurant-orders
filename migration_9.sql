-- после migration_8.sql: хранилище фото блюд (публичное чтение, запись только через сервер)
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('menu','menu',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
