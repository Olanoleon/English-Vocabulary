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
RUN npx prisma generate
RUN npm run build

# Production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD timeout 35 npx prisma db push --skip-generate --accept-data-loss || echo "db push skipped" ; npm start
