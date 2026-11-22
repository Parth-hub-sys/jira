import argparse
import re
from pathlib import Path

from alembic import command
from alembic.config import Config


_NUMBERED_REVISION = re.compile(r"^(\d+)_")


def next_migration_number(versions_dir: Path) -> int:
    numbers = []
    for path in versions_dir.glob("*.py"):
        match = _NUMBERED_REVISION.match(path.name)
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def number_migration_file(generated_path: Path, number: int) -> Path:
    _, separator, slug = generated_path.name.partition("_")
    if not separator:
        raise ValueError(f"Unexpected Alembic migration filename: {generated_path.name}")

    numbered_path = generated_path.with_name(f"{number:02d}_{slug}")
    if numbered_path.exists():
        raise FileExistsError(f"Migration file already exists: {numbered_path}")
    generated_path.rename(numbered_path)
    return numbered_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a numbered Alembic revision.")
    parser.add_argument("--autogenerate", action="store_true")
    parser.add_argument("-m", "--message", required=True)
    args = parser.parse_args()

    project_dir = Path(__file__).resolve().parents[1]
    config = Config(str(project_dir / "alembic.ini"))
    versions_dir = project_dir / "alembic" / "versions"
    first_number = next_migration_number(versions_dir)

    result = command.revision(
        config,
        message=args.message,
        autogenerate=args.autogenerate,
    )
    if result is None:
        return
    migrations = result if isinstance(result, list) else [result]

    for number, migration in enumerate(migrations, start=first_number):
        if migration is None:
            continue
        generated_path = Path(migration.path)
        numbered_path = number_migration_file(generated_path, number)
        print(f"Renamed migration to {numbered_path.relative_to(project_dir)}")


if __name__ == "__main__":
    main()
