"""The migrations and the models must describe the same database.

The image runs `alembic upgrade head`, never the models, so a model changed without
a migration would only break in production. These fail first.
"""

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db.database import Base
from app.models import Drug


def test_models_match_the_migrations(engine):
    with engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection), Base.metadata)

    assert diff == [], (
        "Models changed without a migration: run `alembic revision --autogenerate`"
    )


def test_unaccent_extension_is_installed(db):
    assert db.scalar(text("SELECT unaccent('Analgésico')")) == "Analgesico"


def test_drug_names_are_unique_ignoring_case(db):
    db.add_all([Drug(name="Ibuprofeno"), Drug(name="IBUPROFENO")])

    with pytest.raises(IntegrityError):
        db.flush()
