import os
from io import StringIO

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy import create_engine, inspect

from app.db.models import Base


def test_migration_can_generate_postgresql_sql_offline():
    output = StringIO()
    config = Config("alembic.ini", output_buffer=output)
    config.set_main_option("sqlalchemy.url", "postgresql+psycopg://unused:unused@localhost/unused")
    command.upgrade(config, "head", sql=True)
    assert "CREATE TABLE aws_accounts" in output.getvalue()
    assert "CREATE TABLE reports" in output.getvalue()


def test_initial_migration_upgrade_schema_and_downgrade(tmp_path):
    # An explicit, disposable PostgreSQL database may be supplied for integration testing.
    url = os.environ.get("TEST_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'migration.db'}")
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    engine = create_engine(url)
    try:
        assert set(inspect(engine).get_table_names()) == {
            "alembic_version", "users", "aws_accounts", "scans", "findings", "reports", "cost_cache", "weekly_deliveries",
        }
        with engine.connect() as connection:
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
        command.downgrade(config, "base")
        assert inspect(engine).get_table_names() == ["alembic_version"]
        command.upgrade(config, "head")
    finally:
        engine.dispose()
