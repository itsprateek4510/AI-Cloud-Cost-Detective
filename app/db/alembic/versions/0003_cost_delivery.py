"""Cached cost history and deduplicated weekly deliveries.

Revision ID: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("cost_cache",
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("aws_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_arn", sa.String(2048), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table("weekly_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("aws_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scan_id", sa.Integer(), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("account_id", "week_start"),
        sa.CheckConstraint("status IN ('pending', 'running', 'sent', 'failed')", name="status"),
    )
    op.create_index("ix_weekly_deliveries_account_id", "weekly_deliveries", ["account_id"])


def downgrade():
    op.drop_index("ix_weekly_deliveries_account_id", table_name="weekly_deliveries")
    op.drop_table("weekly_deliveries")
    op.drop_table("cost_cache")
