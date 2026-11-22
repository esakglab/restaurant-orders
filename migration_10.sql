-- после migration_9.sql: разрешить GIF в хранилище фото блюд
update storage.buckets set file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'] where id='menu';
