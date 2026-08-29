"""Repository intake service.

Handles safe ZIP extraction, path-traversal prevention, and Python-repository
detection.  Never executes uploaded code.

Safety limits
-------------
MAX_ZIP_SIZE_BYTES  : 100 MB — reject ZIPs larger than this
MAX_FILE_COUNT      : 5 000 — reject archives with more than this many files
MAX_SINGLE_FILE_MB  : 20 MB — skip individual files larger than this
"""

import os
import zipfile
from pathlib import Path

from backend.models.repository import RepositoryUploadResponse

# ---------------------------------------------------------------------------
# Safety limits
# ---------------------------------------------------------------------------

MAX_ZIP_SIZE_BYTES: int = 100 * 1024 * 1024   # 100 MB
MAX_FILE_COUNT: int = 5_000
MAX_SINGLE_FILE_BYTES: int = 20 * 1024 * 1024  # 20 MB

# Indicators that a directory is the root of a Python repository
_PYTHON_REPO_INDICATORS: tuple[str, ...] = (
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_and_register(zip_bytes: bytes, original_filename: str) -> RepositoryUploadResponse:
    """Extract a ZIP, validate it as a Python repository, and return metadata.

    Parameters
    ----------
    zip_bytes:
        Raw bytes of the uploaded ZIP file.
    original_filename:
        The client-supplied filename (used only to derive ``repository_name``).

    Returns
    -------
    RepositoryUploadResponse
        Metadata about the extracted repository.

    Raises
    ------
    ValueError
        For any invalid or unsafe input — the message is safe to surface to
        the HTTP caller.
    """
    _validate_size(zip_bytes)

    import io
    import tempfile

    # Derive a friendly name from the uploaded filename
    stem = Path(original_filename).stem
    repository_name = stem if stem else "uploaded-repo"

    # Create a persistent temp directory (not deleted on exit so the
    # backend can serve the path to subsequent requests).
    workspace = Path(tempfile.mkdtemp(prefix="repomedic_upload_"))

    try:
        _safe_extract(zip_bytes, workspace)
    except Exception:
        # Clean up on extraction failure
        import shutil
        shutil.rmtree(workspace, ignore_errors=True)
        raise

    repo_root = _resolve_repo_root(workspace)
    _assert_python_repo(repo_root)

    file_count, python_file_count, test_file_count = _count_files(repo_root)

    return RepositoryUploadResponse(
        repository_path=str(repo_root.resolve()),
        repository_name=repository_name,
        file_count=file_count,
        python_file_count=python_file_count,
        test_file_count=test_file_count,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_size(zip_bytes: bytes) -> None:
    """Raise ValueError if the payload exceeds MAX_ZIP_SIZE_BYTES."""
    if len(zip_bytes) > MAX_ZIP_SIZE_BYTES:
        raise ValueError(
            f"ZIP file too large: {len(zip_bytes) // (1024 * 1024)} MB "
            f"(maximum {MAX_ZIP_SIZE_BYTES // (1024 * 1024)} MB)."
        )


def _safe_extract(zip_bytes: bytes, dest: Path) -> None:
    """Extract *zip_bytes* into *dest*, enforcing path-traversal protection.

    Each entry is resolved against ``dest``; if the resolved path does not
    start with ``dest``, extraction is aborted and a ValueError is raised.
    """
    import io

    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        members = zf.infolist()

        if len(members) == 0:
            raise ValueError("The uploaded ZIP archive is empty.")

        if len(members) > MAX_FILE_COUNT:
            raise ValueError(
                f"ZIP contains {len(members)} entries; "
                f"maximum allowed is {MAX_FILE_COUNT}."
            )

        resolved_dest = dest.resolve()

        extracted = 0
        for member in members:
            # Reject path traversal: normalise the name and check it stays
            # within dest.
            member_path = (resolved_dest / member.filename).resolve()
            if not str(member_path).startswith(str(resolved_dest) + os.sep) and \
               member_path != resolved_dest:
                raise ValueError(
                    f"Path traversal detected in ZIP entry: {member.filename!r}"
                )

            # Skip oversized individual files
            if member.file_size > MAX_SINGLE_FILE_BYTES:
                continue

            # Skip directory entries — they will be created implicitly
            if member.filename.endswith("/"):
                member_path.mkdir(parents=True, exist_ok=True)
                continue

            member_path.parent.mkdir(parents=True, exist_ok=True)
            data = zf.read(member.filename)
            member_path.write_bytes(data)
            extracted += 1

    if extracted == 0:
        raise ValueError("No files could be extracted from the ZIP archive.")


def _resolve_repo_root(workspace: Path) -> Path:
    """Detect the repository root inside the extraction workspace.

    Supports two common ZIP layouts:

    A) Files directly at ZIP root → repository root = workspace
    B) GitHub-style: one top-level subdirectory → use that subdirectory
    """
    children = [p for p in workspace.iterdir() if not p.name.startswith(".")]

    if len(children) == 1 and children[0].is_dir():
        # GitHub-style: repo-main/ wrapping
        return children[0]

    # Files directly at ZIP root
    return workspace


def _assert_python_repo(repo_root: Path) -> None:
    """Raise ValueError if the directory does not look like a Python repo."""
    # Check for indicator files
    for indicator in _PYTHON_REPO_INDICATORS:
        if (repo_root / indicator).exists():
            return

    # Check for any .py files
    for _ in repo_root.rglob("*.py"):
        return

    raise ValueError(
        "The uploaded archive does not appear to contain a Python repository. "
        "Expected to find at least one of: requirements.txt, pyproject.toml, "
        "setup.py, setup.cfg, or any .py file."
    )


def _count_files(repo_root: Path) -> tuple[int, int, int]:
    """Return (total_files, python_files, test_files) for *repo_root*."""
    total = 0
    python = 0
    tests = 0

    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue
        total += 1
        if path.suffix == ".py":
            python += 1
            name = path.name
            if name.startswith("test_") or name.endswith("_test.py"):
                tests += 1

    return total, python, tests
