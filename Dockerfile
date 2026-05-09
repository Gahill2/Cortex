FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy source + prisma
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Build
RUN npm run build
RUN ls -la dist/ && test -f dist/server.js

EXPOSE 4000
CMD ["npm", "run", "start"]
