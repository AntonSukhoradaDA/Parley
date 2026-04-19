FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm install --no-audit --no-fund
RUN npx prisma generate

COPY . .

RUN npm run build

# ─── Production ───────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/prisma ./prisma/

RUN npm install --no-audit --no-fund --omit=dev --ignore-scripts=false
RUN npx prisma generate

COPY --from=builder /app/dist ./dist/

RUN mkdir -p /var/parley/files

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
