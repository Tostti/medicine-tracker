# Medicine Tracker

A web app to keep track of the medications at home: what you have, when it expires,
and what to buy. Works on phones, can be installed as an app, and keeps showing the
last data it loaded when the server can't be reached.

- **Catalog** of medications with their drugs and doses, type, function and a picture.
- **Stock**: every box/bottle you have, with its expiration date and a "running low" flag.
- **Home dashboard**: shopping list (out of stock, expired, running low or expiring within
  a month, for medications marked as common use), upcoming expirations, and expired items to throw away.
- **Search** by name, drug, function or type.
- **English and Spanish**, picked from the device's language.

## Stack

| Part         | Technology                                                                    |
| ------------ | ----------------------------------------------------------------------------- |
| Frontend     | React, Mantine, TanStack Query, i18next, Vite+ — served by Caddy              |
| Backend      | FastAPI, SQLAlchemy, Alembic, Pydantic                                        |
| Database     | PostgreSQL                                                                    |
| Pictures     | Any S3-compatible storage (bundled RustFS, AWS S3, MinIO…), optional          |

## Project layout

```
backend/            FastAPI app (app/), database migrations (alembic/)
frontend/           React app, and the Caddyfile that serves it and proxies /api
docker-compose.yml  The whole stack: web, backend, db, pgAdmin, storage
.env.example        Settings template — copy to .env
```

The browser only talks to the `web` container: Caddy serves the app and forwards
`/api/*` to the backend (with the `/api` prefix stripped). Pictures are also served
through `/api/images/...`, so the storage never has to be reachable from outside.

## Getting started

Requirements: Docker with Compose.

```sh
cp .env.example .env    # then set real passwords
docker compose up -d --build
```

Open http://localhost:8090. Database migrations run automatically when the backend starts.

| Service          | Address                                       |
| ---------------- | --------------------------------------------- |
| App              | http://localhost:8090                         |
| API docs         | http://localhost:8090/api/docs                |
| pgAdmin          | http://localhost:5050                         |
| Storage console  | http://localhost:9001 (only with the `storage` profile) |

Everything except the app listens on `127.0.0.1` only.

### Pictures

Picture uploads need an S3-compatible bucket. `.env.example` uses the bundled RustFS
container (`COMPOSE_PROFILES=storage`); its comments explain how to use AWS S3 or
another server instead. Leave `S3_BUCKET` empty to run without pictures.

## Development

Run the stack with Docker as above, then the frontend's dev server for hot reload:

```sh
cd frontend
corepack enable          # provides the Yarn version pinned in package.json
yarn install
yarn dev                 # http://localhost:5173, /api is proxied to localhost:8000
```

Frontend scripts are listed in [frontend/README.md](frontend/README.md); `yarn test`
runs formatting, lint, type checks, unused-code checks, tests and the build.

Backend tests run against a real PostgreSQL, in a separate `medicine_tracker_test` database
that is recreated on every run (the app's data is never touched):

```sh
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
docker compose up -d db  # the tests use the credentials in .env, on localhost
.venv/bin/pytest
```

Backend changes need a rebuild of its container (`docker compose up -d --build backend`).
New migrations: `alembic revision --autogenerate -m "..."` inside `backend/`.

### Pull requests and CI

`main` only changes through pull requests, and a pull request can only be merged
when both test jobs pass ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- **Backend tests**: `pytest` against a PostgreSQL service container.
- **Frontend tests**: `yarn test`.

Pull requests also build both Docker images, without publishing them, so a broken
Dockerfile shows up before merging.

## Installing on a server

The server doesn't need the source code. Every merge into `main` publishes the images
to GitHub's container registry ([`.github/workflows/docker.yml`](.github/workflows/docker.yml)):

- `ghcr.io/tostti/medicine-tracker-backend`
- `ghcr.io/tostti/medicine-tracker-web`

each tagged `latest`, `sha-<commit>`, and the version for tags like `v1.2.0`.
They are built for `linux/amd64`.

On the server, in a folder with just `docker-compose.yml` and a `.env` made from
[`.env.example`](.env.example):

```sh
docker compose pull
docker compose up -d --no-build
```

Run the same two commands to update. `--no-build` uses the published images instead of
looking for the source; set `IMAGE_TAG` in `.env` to pin a version (or roll back to one).

## Releasing

Versions follow [Semantic Versioning](https://semver.org): a fix bumps the patch
(`1.1.1`), a new feature the minor (`1.2.0`), and a change that breaks existing installs
the major (`2.0.0`). Tag the merged commit on `main`:

```sh
git switch main && git pull
git tag -a v1.2.0 -m "Short summary of the release"
git push origin v1.2.0
```

The tag publishes the images as `:1.2.0` and `:1.2`, and creates the GitHub Release with
notes from the merged pull requests. Add upgrade notes to it when a release needs a
manual step (a new `.env` variable, a changed default).

To deploy it, set `IMAGE_TAG=1.2.0` in the server's `.env` and run the two commands
above. To roll back, set the previous version and run them again.

Releases with database migrations need care: the backend migrates the database forward
when it starts, and an older version can't start on a database it doesn't know. Back up
the database before deploying one (`pg_dump`), and to roll back either restore that
backup, or undo the migrations while the new version is still running
(`docker compose exec backend alembic downgrade <revision>`) and then switch versions.

The version running is shown in the app: in the sidebar on a computer, at the bottom
of the home page on a phone.

## Deploying behind HTTPS

The `web` container serves plain HTTP on `WEB_PORT` (8090) and expects a reverse proxy
on the server (nginx, Traefik, Caddy…) to handle HTTPS in front of it. HTTPS is needed
to install the app on a phone, for the offline mode, and for camera access.

- Forward the proxy to `WEB_PORT`, passing the `Host` and `X-Forwarded-Proto` headers
  (Traefik and Caddy do it by default; with nginx add
  `proxy_set_header Host $host;` and `proxy_set_header X-Forwarded-Proto $scheme;`).
- By default the app only listens on this machine (`WEB_BIND=127.0.0.1`), which is
  right when the proxy runs directly on the same host. If the proxy runs in Docker or on
  another machine, set `WEB_BIND=0.0.0.0`, after reading [Security](#security).
- If the proxy is on another machine with a public IP, replace `private_ranges` in
  `frontend/Caddyfile` with its address, so its forwarded headers are trusted.
- Reach pgAdmin and the storage console through an SSH tunnel, e.g.
  `ssh -L 5050:localhost:5050 user@server`.

## Security

**The app has no login.** Anyone who can reach it can read and change everything. Access
control is the network, so:

- **Never expose it to the internet**: no port forwarding on the router, no public
  reverse proxy. Reach it from outside home through a private network such as
  [Tailscale](https://tailscale.com) or a VPN.
- `WEB_BIND` defaults to `127.0.0.1`. Changing it to `0.0.0.0` opens the app to every
  network the server is on: only do it when the proxy needs it, and only on a trusted
  network.
- The database, pgAdmin, the storage console and the backend are only published on
  `127.0.0.1`. Reach them through an SSH tunnel.

The containers are also hardened, so a bug in a dependency (uvicorn, Pillow…) does less
damage: `backend` and `web` run as unprivileged users, with a read-only filesystem
(only `/tmp` is writable), no Linux capabilities, and no way to gain new privileges.

## Credits

Pill icon by Vaadin on [Icon-Icons.com](https://icon-icons.com/authors/353-vaadin),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with its
colors adapted for dark mode.
