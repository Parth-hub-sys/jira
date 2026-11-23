"""Add timestamps, task numbers, label constraints and indexes for the API."""

import sqlalchemy as sa
from alembic import op


revision = "a802a471cc2f"
down_revision = "212290482558"
branch_labels = None
depends_on = None


INDEXES = (
    ("ix_tasks_project_status", "tasks", ["project_id", "status"]),
    ("ix_comments_task_created", "comments", ["task_id", "created_at"]),
    ("ix_notifications_user_created", "notifications", ["user_id", "created_at"]),
    ("ix_activity_logs_entity_created", "activity_logs", ["entity_type", "entity_id", "created_at"]),
)


def add_timestamp(table: str, name: str) -> None:
    op.add_column(
        table,
        sa.Column(name, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def upgrade() -> None:
    for table in ("users", "tasks"):
        add_timestamp(table, "created_at")
    for table in ("users", "projects", "tasks"):
        add_timestamp(table, "updated_at")
    op.execute("UPDATE projects SET updated_at = created_at")
    op.add_column("projects", sa.Column("created_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_projects_created_by_users", "projects", "users", ["created_by"], ["id"], ondelete="SET NULL"
    )
    op.add_column(
        "projects", sa.Column("next_task_number", sa.BigInteger(), server_default="1", nullable=False)
    )
    op.add_column("tasks", sa.Column("number", sa.BigInteger(), nullable=True))
    op.execute(
        """
        UPDATE tasks SET number = numbered.number
        FROM (
            SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY id) AS number
            FROM tasks
        ) AS numbered
        WHERE tasks.id = numbered.id
        """
    )
    op.execute(
        """
        UPDATE projects SET next_task_number = numbered.next_number
        FROM (
            SELECT project_id, max(number) + 1 AS next_number FROM tasks GROUP BY project_id
        ) AS numbered
        WHERE projects.id = numbered.project_id
        """
    )
    op.alter_column("tasks", "number", nullable=False)
    op.create_unique_constraint("uq_tasks_project_number", "tasks", ["project_id", "number"])
    # Keep existing label IDs and task links if the original schema allowed duplicate names.
    op.execute(
        """
        DO $$
        DECLARE
            duplicate record;
            suffix integer;
            ending text;
            candidate text;
        BEGIN
            FOR duplicate IN
                SELECT id, project_id, name
                FROM (
                    SELECT *, row_number() OVER (PARTITION BY project_id, name ORDER BY id) AS copy
                    FROM labels
                ) AS numbered
                WHERE copy > 1
                ORDER BY project_id, name, id
            LOOP
                suffix := 2;
                LOOP
                    ending := ' (' || suffix || ')';
                    candidate := left(duplicate.name, 50 - char_length(ending)) || ending;
                    EXIT WHEN NOT EXISTS (
                        SELECT 1 FROM labels WHERE project_id = duplicate.project_id AND name = candidate
                    );
                    suffix := suffix + 1;
                END LOOP;
                UPDATE labels SET name = candidate WHERE id = duplicate.id;
            END LOOP;
        END $$;
        """
    )
    op.create_unique_constraint("uq_labels_project_name", "labels", ["project_id", "name"])
    op.alter_column("notifications", "crated_at", new_column_name="created_at")
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns)


def downgrade() -> None:
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
    op.alter_column("notifications", "created_at", new_column_name="crated_at")
    op.drop_constraint("uq_labels_project_name", "labels", type_="unique")
    op.drop_constraint("uq_tasks_project_number", "tasks", type_="unique")
    op.drop_column("tasks", "number")
    op.drop_column("projects", "next_task_number")
    op.drop_constraint("fk_projects_created_by_users", "projects", type_="foreignkey")
    op.drop_column("projects", "created_by")
    for table in ("tasks", "projects", "users"):
        op.drop_column(table, "updated_at")
    for table in ("tasks", "users"):
        op.drop_column(table, "created_at")
