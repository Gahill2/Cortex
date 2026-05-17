# Monorepo convenience — same image as backend/Dockerfile when context is backend/:
#   docker build -f backend/Dockerfile backend -t cortex-api
# Railway: set service root to backend/ and use backend/railway.json (not this file).
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/scripts ./scripts

RUN npm run build
RUN npm prune --omit=dev

EXPOSE 4000
CMD ["npm", "run", "start"]
