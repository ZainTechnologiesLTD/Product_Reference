# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---- Production Stage ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
