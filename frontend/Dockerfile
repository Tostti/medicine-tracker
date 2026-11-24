# Build the static frontend
FROM node:26-alpine AS build
WORKDIR /app
# Node 25+ no longer bundles corepack; it provides the Yarn version in package.json
RUN npm install -g corepack && corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
RUN yarn build

# Serve it with Caddy, which also proxies /api to the backend
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
