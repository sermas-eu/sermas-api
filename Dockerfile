FROM node:24 AS builder

RUN apt-get update -q && apt-get install -y -q sox && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json .npmrc ./

# Some dependencies run git hooks setup (husky) on install.
RUN mkdir -p .git/hooks && npm ci --no-audit --no-fund

COPY . ./

# No `npm prune --omit=dev`: nestjs-asyncapi's document generator loads ts-node,
# TypeScript and Babel at runtime, so the runtime image needs them.
RUN npm run build

FROM node:24

RUN apt-get update -q && apt-get install -y -q sox && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json

ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT [ "node" ]
CMD [ "dist/apps/api/main.js" ]
