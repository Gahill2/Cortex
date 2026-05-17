# Monorepo-root build (Railway service root = repo root).
# Preferred: set Railway root directory to backend/ and use backend/Dockerfile via backend/railway.json.
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=development

ARG RAILWAY_GIT_COMMIT_SHA=local
RUN echo "builder commit=${RAILWAY_GIT_COMMIT_SHA}"

COPY backend/package*.json ./
RUN npm ci --include=dev && test -x node_modules/.bin/tsc && node_modules/.bin/tsc --version

COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/scripts ./scripts

RUN npx prisma generate && node_modules/.bin/tsc -p tsconfig.json

FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/prisma ./prisma
COPY backend/scripts ./scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
