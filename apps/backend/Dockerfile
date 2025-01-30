FROM node:20-alpine3.19 AS base
WORKDIR /app

COPY package*.json ./

FROM base AS prod-deps
RUN npm install

FROM prod-deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000
CMD node ./dist/cmd/server.js