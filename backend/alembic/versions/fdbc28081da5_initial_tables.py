"""initial tables

Revision ID: fdbc28081da5
Revises: 
Create Date: 2026-07-15 16:32:16.567445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdbc28081da5'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('puzzles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('theme', sa.String(), nullable=False),
    sa.Column('grid', sa.JSON(), nullable=False),
    sa.Column('mega_machrozet_cells', sa.JSON(), nullable=False),
    sa.Column('word_cells', sa.JSON(), nullable=False),
    sa.Column('bonus_words', sa.JSON(), nullable=False, server_default='[]'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('daily_schedule',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('puzzle_id', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['puzzle_id'], ['puzzles.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('date')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('daily_schedule')
    op.drop_table('puzzles')
