# DataGuard API — build context is the repo root (needs db/ for migrations).
FROM node:20-alpine AS build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:20-alpine AS run
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
COPY db /app/db
EXPOSE 4000
# Apply migrations, then start (migrate is idempotent).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
