FROM python:3.15-slim

# Nothing to write at runtime (pictures go to S3), so no .pyc files either: the code stays
# owned by root, read-only for the app user, and the container can run read_only.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# A fixed, unprivileged user: if uvicorn or Pillow is ever exploited, the attacker isn't
# root inside the container. A fixed UID keeps file ownership predictable across rebuilds.
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
USER 10001:10001

EXPOSE 8000

# --root-path /api: requests reach the app through /api (Caddy, or Vite in dev) with the prefix
# stripped, so URLs the app builds (redirects, the docs' openapi.json) must add it back.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --root-path /api"]
