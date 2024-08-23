FROM node:18 AS builder

RUN apt update -q && apt install -y sox

WORKDIR /app
ADD package.json ./

# fix husky error in minio-client
RUN mkdir -p .git/hooks
RUN npm install husky -g

RUN npm i

ADD . ./

RUN npm run build

# ENTRYPOINT [ "npm" ]
# CMD [ "run", "start:debug" ]

FROM node:18

RUN apt update -q && apt install -y sox

WORKDIR /app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENTRYPOINT [ "node" ]
CMD [ "dist/apps/api/main.js" ]