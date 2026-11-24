FROM python:3.15-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# --root-path /api: requests reach the app through /api (Caddy, or Vite in dev) with the prefix
# stripped, so URLs the app builds (redirects, the docs' openapi.json) must add it back.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --root-path /api"]