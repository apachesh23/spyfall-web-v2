# Spyfall (v2) — монорепозиторий

- **`apps/web`** — Next.js (App Router), features-based UI, тонкие `page.tsx`.
- **`apps/game-server`** — Colyseus + Express (`/health`).
- **`packages/shared`** — общие константы и типы для клиента и сервера.

## Запуск локально

Из корня репозитория:

```bash
npm install
```

Одной командой (web + Colyseus, `Ctrl+C` останавливает оба):

```bash
npm run dev
```

Или по отдельности:

```bash
npm run dev:server
npm run dev:web
```

Открой [http://localhost:3000](http://localhost:3000) — будет редирект на `/create` (как в старом проекте). Проверка Colyseus: вручную открой `/play/dev-session` (сервер на `NEXT_PUBLIC_COLYSEUS_URL`, по умолчанию `http://localhost:2567`).

Скопируй `apps/web/.env.example` в `apps/web/.env.local`: для экранов **Create / Invite** нужны `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` (те же, что в старом проекте). Статика (аватары, звуки, видео фона, lottie, курсоры, языки) при миграции копируется из `spyfall-game/public` в `apps/web/public`, если старый проект лежит рядом по пути из скрипта.

**Step 1 (Create/Invite):** после входа редирект на `/lobby/[code]` (не `/room/`). В TopBar «активная комната» ведёт в `/lobby/…` или `/play/…`. Модалка правил упрощена (без превью игровых виджетов) — полную версию можно вернуть на шаге с игрой.

## Скрипты

| Команда | Описание |
|--------|----------|
| `npm run dev:web` | Next dev |
| `npm run dev:server` | Colyseus + tsx watch |
| `npm run build` | Сборка всех workspace с полем `build` |

Продакшен-сервер игры: `npm run build --workspace=@spyfall/game-server` затем `npm run start --workspace=@spyfall/game-server` (слушает `PORT`, по умолчанию `2567`).
