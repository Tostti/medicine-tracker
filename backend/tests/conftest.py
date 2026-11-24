"""Shared test setup.

The tests run against a real PostgreSQL (the app relies on unaccent, lower() indexes
and ILIKE), in a database of its own that is dropped and recreated on every run.
Each test runs inside a transaction that is rolled back at the end, so tests never
see each other's data.

Locally, start the database with `docker compose up -d db` and run `pytest` from
backend/. The credentials come from the repo's .env (or the environment, in CI).
"""

import os

# Must happen before importing the app: the settings and the engine are created at import.
os.environ["POSTGRES_DB"] = os.environ.get("TEST_POSTGRES_DB", "medicine_tracker_test")
# .env points at the `db` container, which is only resolvable inside Docker.
os.environ.setdefault("POSTGRES_HOST", "localhost")
# No real storage in tests: the `fake_storage` fixture replaces it where needed.
os.environ["S3_BUCKET"] = ""
os.environ["S3_CREATE_BUCKET"] = "false"

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import settings
from app.db.database import engine as app_engine
from app.db.database import get_db
from app.main import app
from app.services import storage

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _recreate_database() -> None:
    url = make_url(settings.database_url)
    # Safety net: this drops the database, so never let it touch a real one.
    if not url.database.endswith("_test"):
        raise RuntimeError(
            f"Refusing to recreate {url.database!r}: name must end in _test"
        )

    # CREATE/DROP DATABASE can't run inside a transaction, nor while connected to that database.
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()


def _run_migrations() -> None:
    # Built in code instead of from alembic.ini: loading the .ini would also reconfigure
    # logging and silence the app's loggers, which some tests check.
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """A fresh database with every migration applied, once per test run."""
    _recreate_database()
    _run_migrations()
    yield app_engine
    app_engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """A session whose changes are all undone after the test.

    The outer transaction is never committed. `create_savepoint` turns the app's own
    commit()/rollback() calls into savepoints inside it, so the code under test
    behaves as usual (including rolling back after an error).
    """
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    """An HTTP client for the app, using the test session instead of a new one per request."""
    app.dependency_overrides[get_db] = lambda: db
    # `with` runs the app's startup and shutdown (lifespan), like uvicorn does.
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def create_medication(client: TestClient) -> Callable[..., dict]:
    """POST a medication; defaults to one drug, override any field with keywords."""

    def _create(**fields) -> dict:
        payload = {
            "commercial_name": "Ibupirac 400",
            "drugs": [{"name": "Ibuprofeno", "dose": "400 mg"}],
            **fields,
        }
        response = client.post("/medications/", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _create


@pytest.fixture
def fake_storage(monkeypatch: pytest.MonkeyPatch) -> dict[str, tuple[bytes, str]]:
    """Replace the S3 calls with a dict {key: (data, content_type)}, and mark storage as configured."""
    objects: dict[str, tuple[bytes, str]] = {}

    def put_object(key: str, data: bytes, content_type: str) -> None:
        objects[key] = (data, content_type)

    def get_object(key: str) -> storage.StoredObject:
        if key not in objects:
            raise storage.ObjectNotFoundError(key)
        data, content_type = objects[key]
        return storage.StoredObject(
            chunks=iter([data]), content_type=content_type, content_length=len(data)
        )

    def delete_object(key: str) -> None:
        objects.pop(key, None)

    monkeypatch.setattr(settings, "S3_BUCKET", "test-bucket")
    monkeypatch.setattr(storage, "put_object", put_object)
    monkeypatch.setattr(storage, "get_object", get_object)
    monkeypatch.setattr(storage, "delete_object", delete_object)
    return objects
