"""The migration that turns common-use medications into essentials, on real data.

Runs against a throwaway database of its own: it migrates down and up, which the
shared test database (used by every other test) must never do.
"""

from collections.abc import Iterator

import pytest
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine, make_url, text

from alembic import command
from app.core.config import settings
from tests.conftest import BACKEND_DIR

BEFORE = "77fb5b607bd3"  # common_use, no essentials
ESSENTIALS = "c4e8a1d2f5b7"


@pytest.fixture
def migration_engine(engine: Engine) -> Iterator[Engine]:
    # `engine` first, so the main test database already exists and the name check ran.
    url = make_url(settings.database_url).set(
        database="medicine_tracker_migrations_test"
    )
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{url.database}"'))

    migration_engine = create_engine(url)
    yield migration_engine

    migration_engine.dispose()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
    admin.dispose()


def migrate(engine: Engine, revision: str, *, down: bool = False) -> None:
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        (command.downgrade if down else command.upgrade)(config, revision)


def add_medication(
    conn: Connection, name: str, common_use: bool, drugs: dict[str, str]
) -> None:
    medication_id = conn.scalar(
        text(
            "INSERT INTO medications (commercial_name, common_use) VALUES (:n, :c) RETURNING id"
        ),
        {"n": name, "c": common_use},
    )
    for drug, dose in drugs.items():
        drug_id = conn.scalar(
            text(
                "INSERT INTO drugs (name) VALUES (:d) "
                "ON CONFLICT (lower(name)) DO UPDATE SET name = drugs.name RETURNING id"
            ),
            {"d": drug},
        )
        conn.execute(
            text(
                "INSERT INTO medication_drugs (medication_id, drug_id, dose) VALUES (:m, :d, :dose)"
            ),
            {"m": medication_id, "d": drug_id, "dose": dose},
        )


def essentials(conn: Connection) -> list[list[tuple[str, str, str]]]:
    """Each essential as its sorted [(drug, dose, dose_key)], sorted."""
    rows = conn.execute(
        text(
            "SELECT ed.essential_id, d.name, ed.dose, ed.dose_key FROM essential_drugs ed "
            "JOIN drugs d ON d.id = ed.drug_id ORDER BY ed.essential_id, d.name"
        )
    ).all()
    grouped: dict[int, list[tuple[str, str, str]]] = {}
    for essential_id, name, dose, key in rows:
        grouped.setdefault(essential_id, []).append((name, dose, key))
    return sorted(grouped.values())


def test_common_use_medications_become_essentials(migration_engine, caplog):
    migrate(migration_engine, BEFORE)
    with migration_engine.begin() as conn:
        # Two brands of the same composition, written differently: one essential.
        add_medication(conn, "Ibupirac 600", True, {"Ibuprofeno": "600mg"})
        add_medication(conn, "Actron 600", True, {"Ibuprofeno": "600 mg"})
        # A combination stays a combination.
        add_medication(
            conn, "Tafirol Plus", True, {"Paracetamol": "500 mg", "Cafeína": "65 mg"}
        )
        # Same drug, other dose: an essential of its own.
        add_medication(conn, "Tafirol 1g", True, {"Paracetamol": "1 g"})
        # Not common use: nothing.
        add_medication(conn, "Ibupirac 400", False, {"Ibuprofeno": "400 mg"})
        # Common use without drugs: can't become an essential, so it's reported.
        add_medication(conn, "Mystery", True, {})

    caplog.set_level("INFO")
    migrate(migration_engine, ESSENTIALS)

    with migration_engine.connect() as conn:
        assert essentials(conn) == [
            [("Cafeína", "65 mg", "65mg"), ("Paracetamol", "500 mg", "500mg")],
            [("Ibuprofeno", "600mg", "600mg")],
            [("Paracetamol", "1 g", "1000mg")],
        ]
        # Every existing dose got its key.
        keys = conn.execute(
            text("SELECT dose, dose_key FROM medication_drugs ORDER BY dose")
        ).all()
        assert ("1 g", "1000mg") in keys and ("600 mg", "600mg") in keys
    assert "('Mystery') is common use but has no drugs" in caplog.text


def test_downgrade_restores_the_previous_schema(migration_engine):
    migrate(migration_engine, BEFORE)
    with migration_engine.begin() as conn:
        add_medication(conn, "Ibupirac 600", True, {"Ibuprofeno": "600mg"})

    migrate(migration_engine, ESSENTIALS)
    migrate(migration_engine, BEFORE, down=True)

    with migration_engine.connect() as conn:
        assert conn.scalar(text("SELECT to_regclass('essentials')")) is None
        # common_use was never touched, so nothing was lost.
        assert conn.execute(
            text("SELECT commercial_name, common_use FROM medications")
        ).all() == [("Ibupirac 600", True)]


def test_dropping_members_refuses_to_lose_rows(migration_engine):
    migrate(migration_engine, ESSENTIALS)
    with migration_engine.begin() as conn:
        conn.execute(text("INSERT INTO members (name) VALUES ('Ana')"))

    with pytest.raises(RuntimeError, match="Refusing to drop members: it has 1 rows"):
        migrate(migration_engine, "head")
