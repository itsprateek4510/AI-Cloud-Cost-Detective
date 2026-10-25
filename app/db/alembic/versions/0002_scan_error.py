"""Store a safe terminal scan error.

Revision ID: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("scans", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("scans", "error_message")
