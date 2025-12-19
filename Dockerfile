FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Database will be stored in /app/data
ENV DATABASE_PATH=/app/data/rss-bot.db

CMD ["bun", "run", "src/index.ts"]
