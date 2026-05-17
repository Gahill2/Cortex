# Production API image.
# Railway (root directory = backend): uses paths below as-is.
# Homelab / monorepo: docker build -f backend/Dockerfile backend
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Platforms often inject NODE_ENV=production during build; devDeps (tsc, prisma) are required here.
ENV NODE_ENV=development

# Bust stale layer cache when Railway reuses an old npm ci layer without devDependencies.
ARG RAILWAY_GIT_COMMIT_SHA=local
RUN echo "builder commit=${RAILWAY_GIT_COMMIT_SHA}"

COPY package*.json ./
RUN npm ci --include=dev && test -x node_modules/.bin/tsc && node_modules/.bin/tsc --version

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
COPY scripts ./scripts

# Invoke tsc by path — do not rely on npm run build or PATH (Railway may cache old package.json).
RUN npx prisma generate && node_modules/.bin/tsc -p tsconfig.json

FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY scripts ./scripts
COPY --from=builder /app/dist ./dist
# prisma generate runs in builder; prod npm ci does not re-run it — copy generated client.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# migrate deploy at container start (prisma is a devDependency; not installed by prod npm ci)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
