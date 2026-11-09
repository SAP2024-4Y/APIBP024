FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY docs ./docs
RUN npm run build

# ── UI builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS ui-builder

WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui ./
RUN npm run build

# ── production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docs ./docs
COPY --from=ui-builder /ui/dist ./ui/dist

RUN mkdir -p /app/data

ENV NODE_ENV=development
ENV PORT=8080
ENV DATA_DIR=/app/data
ENV JWT_SECRET=super-secret-jwt-key-for-events-ticketing-2026

EXPOSE 8080

CMD ["node", "dist/server.js"]
