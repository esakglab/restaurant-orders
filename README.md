# Заказ еды: 4 приложения в одном сервисе
`/` клиенты · `/staff` приём заказов · `/admin` администратор · `/owner` владелец

## Запуск
1. Supabase → SQL Editor → выполнить `schema.sql`. Settings → API → скопировать Project URL и service_role key.
2. Залить папку на GitHub (`.env` и `backup*.json` в .gitignore).
3. Render → New → Blueprint → выбрать репозиторий (`render.yaml`). Заполнить: SUPABASE_URL, SUPABASE_SERVICE_KEY, OWNER_PHONE / OWNER_PASSWORD, ADMIN_PHONE / ADMIN_PASSWORD (пароли от 12 символов).
4. Войти на `/owner` и `/admin`, добавить сотрудников в `/admin`.

## Сохранность данных
Владелец → «Скачать резервную копию» (раз в неделю). Восстановление в новый Supabase: выполнить `schema.sql`, затем `node restore.js backup.json`. Файл содержит хэши паролей — храните закрыто.

## Защита
service_role-ключ только на сервере; RLS включён на всех таблицах; пароли bcrypt; JWT 12 ч; лимиты запросов; helmet/CSP; цены берутся из БД, а не от клиента; весь вывод экранируется.
