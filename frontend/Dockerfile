# Build the static frontend
FROM node:26-alpine AS build
WORKDIR /app
# Node 25+ no longer bundles corepack; it provides the Yarn version in package.json
RUN npm install -g corepack && corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
# Shown in the app; CI passes the release ("1.1.0") or the commit ("sha-abc1234").
ARG APP_VERSION=dev
RUN VITE_APP_VERSION=$APP_VERSION yarn build

# Serve it with Caddy, which also proxies /api to the backend
FROM caddy:2-alpine
# Run as an unprivileged user. Binding port 80 doesn't need root: Docker (20.10+) lets
# any user bind low ports inside the container (not with network_mode: host).
# Caddy only writes its state to /data and /config (XDG_DATA_HOME, XDG_CONFIG_HOME):
# they're volumes in the base image, and a new volume copies this ownership.
RUN addgroup -S -g 10002 caddy \
    && adduser -S -D -H -u 10002 -G caddy -s /sbin/nologin caddy \
    && chown -R caddy:caddy /data /config
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER 10002:10002
