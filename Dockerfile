FROM node:20-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY src ./src

RUN npm ci || npm install && \
    cp node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs \
       node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs

RUN npm run build

COPY .env* ./

EXPOSE 3000

CMD ["npm", "run", "mint"]