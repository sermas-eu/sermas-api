FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm run build

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-slim
RUN apt-get update -q && apt-get install -y -q --no-install-recommends sox \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
USER node
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["dist/apps/api/src/main.js"]
