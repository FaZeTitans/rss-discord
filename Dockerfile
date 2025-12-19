FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 botuser

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=botuser:nodejs . .

# Create data directory for SQLite
RUN mkdir -p /app/data && chown botuser:nodejs /app/data

USER botuser

# Database will be stored in /app/data
ENV DATABASE_PATH=/app/data/rss-bot.db

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
