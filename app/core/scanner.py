"""RepositoryScanner — recursively lists source files, skipping generated dirs."""

from pathlib import Path

# Directories that are never source code and should always be skipped.
IGNORED_DIRS: frozenset = frozenset({
    ".git",
    ".venv",
    "venv",
    ".env",
    "env",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".tox",
    "dist",
    "build",
    ".eggs",
    "*.egg-info",
    ".idea",
    ".vscode",
    "coverage",
    ".coverage",
    "htmlcov",
})


class RepositoryScanner:
    """Scans a repository and collects information about its source files.

    Generated and tooling directories (node_modules, __pycache__, .git, etc.)
    are excluded from the results so that analysis always operates on real
    source code.

    Parameters
    ----------
    repository_path : str or Path
        Root directory of the repository to scan.
    """

    def __init__(self, repository_path):
        self.repository_path = Path(repository_path)

    @staticmethod
    def _is_ignored(path: Path) -> bool:
        """Return True if any path component is in the ignore list."""
        for part in path.parts:
            if part in IGNORED_DIRS or part.endswith(".egg-info"):
                return True
        return False

    def scan(self) -> list:
        """Return all non-ignored source files inside the repository.

        Returns
        -------
        list of Path

        Raises
        ------
        FileNotFoundError
            If the repository path does not exist.
        NotADirectoryError
            If the path exists but is not a directory.
        """
        if not self.repository_path.exists():
            raise FileNotFoundError(
                f"Repository not found: {self.repository_path}"
            )

        if not self.repository_path.is_dir():
            raise NotADirectoryError(
                f"Path is not a directory: {self.repository_path}"
            )

        files = []
        for path in self.repository_path.rglob("*"):
            if not path.is_file():
                continue
            # Compute path relative to repo root for ignore-dir matching
            try:
                rel = path.relative_to(self.repository_path)
            except ValueError:
                continue
            if self._is_ignored(rel):
                continue
            files.append(path)

        return files
