FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci

# Copy source + prisma
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Build
RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
