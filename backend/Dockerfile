# Production API image.
# Railway (root directory = backend): uses paths below as-is.
# Homelab / monorepo: docker build -f backend/Dockerfile backend
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Platforms often inject NODE_ENV=production during build; devDeps (tsc, prisma) are required here.
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
COPY scripts ./scripts

RUN npm run build

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

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
