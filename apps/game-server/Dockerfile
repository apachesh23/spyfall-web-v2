# Сборка: контекст = корень монорепозитория (см. fly.toml → build.context).
# Локально: из корня репозитория:
#   fly deploy --config apps/game-server/fly.toml
#
# workspaces: npm ci на корне требует package.json у всех workspace-пакетов.

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/game-server apps/game-server
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src

RUN npm ci && npm run build -w @spyfall/game-server

FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/game-server/package.json apps/game-server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src

RUN npm ci --omit=dev

COPY --from=build /repo/apps/game-server/dist ./apps/game-server/dist

WORKDIR /repo/apps/game-server

# Fly подставляет PORT; локально по умолчанию 2567 (как в index.ts)
ENV PORT=2567
EXPOSE 2567

CMD ["node", "dist/index.js"]
