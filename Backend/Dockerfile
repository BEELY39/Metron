FROM node:20-alpine AS base

# Install dependencies for build
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Google Cloud Run uses PORT env variable
ENV PORT=8080

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 adonisjs

# Copy built application
COPY --from=builder --chown=adonisjs:nodejs /app/build ./
COPY --from=builder /app/node_modules ./node_modules

USER adonisjs

EXPOSE 8080

CMD ["node", "bin/server.js"]
