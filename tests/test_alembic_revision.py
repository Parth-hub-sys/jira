from pathlib import Path

from scripts.alembic_revision import number_migration_file, next_migration_number


def test_next_migration_number_uses_highest_numbered_file(tmp_path: Path) -> None:
    (tmp_path / "01_initial_schema.py").touch()
    (tmp_path / "05_add_tasks.py").touch()
    (tmp_path / "cca7d7f2a116_legacy.py").touch()

    assert next_migration_number(tmp_path) == 6


def test_next_migration_number_starts_at_one(tmp_path: Path) -> None:
    assert next_migration_number(tmp_path) == 1


def test_number_migration_file_keeps_slug_and_moves_file(tmp_path: Path) -> None:
    generated = tmp_path / "abc123_add_tasks.py"
    generated.touch()

    numbered = number_migration_file(generated, 2)

    assert numbered == tmp_path / "02_add_tasks.py"
    assert numbered.exists()
    assert not generated.exists()
