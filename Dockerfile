FROM node:22-alpine
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

EXPOSE 4000
CMD ["npm", "run", "start"]
