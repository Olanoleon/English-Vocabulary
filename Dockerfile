FROM node:22-slim AS base
WORKDIR /app

# Prisma needs OpenSSL at runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

# Build the application
COPY . .
RUN npm run build

# Production
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
