# Database migrations

Create numbered Alembic migrations with:

```bash
uv run python scripts/alembic_revision.py --autogenerate -m "add tasks"
```

The helper assigns the next filename prefix (`02_`, `03_`, and so on) while
leaving Alembic's unique revision IDs unchanged. Use this helper instead of
`uv run alembic revision` when you want numbered filenames.