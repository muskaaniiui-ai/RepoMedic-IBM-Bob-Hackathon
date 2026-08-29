"""Pydantic models for the repository intake API."""
from pydantic import BaseModel


class RepositoryUploadResponse(BaseModel):
    """Response body for POST /api/repository/upload.

    Returns the server-side path that can be fed directly to /api/analyze.
    """

    repository_path: str
    """Absolute path to the extracted repository root on the server."""

    repository_name: str
    """Derived from the uploaded ZIP filename (without extension)."""

    file_count: int
    """Total number of files extracted."""

    python_file_count: int
    """Number of ``.py`` files found under the repository root."""

    test_file_count: int
    """Number of test files (files whose name starts with ``test_`` or ends
    with ``_test.py``)."""
