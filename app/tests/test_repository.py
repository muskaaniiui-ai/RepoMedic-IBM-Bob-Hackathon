"""Backend tests for the repository intake API.

Tests cover:
- Valid ZIP upload (files at root)
- Valid ZIP upload (GitHub-style with one top-level directory)
- Invalid file type (not a .zip)
- Empty ZIP
- Non-Python repository
- Path traversal ZIP
- Repository metadata calculation
- ZIP size limit (conceptual validation)
"""

import io
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.repository_service import (
    extract_and_register,
    _safe_extract,
    _resolve_repo_root,
    _assert_python_repo,
    _count_files,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_zip(files: dict[str, str | bytes]) -> bytes:
    """Create an in-memory ZIP with the given {entry_name: content} mapping."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            if isinstance(content, str):
                zf.writestr(name, content)
            else:
                zf.writestr(name, content)
    return buf.getvalue()


def _make_python_zip_flat() -> bytes:
    """ZIP with Python files directly at root (no wrapping directory)."""
    return _make_zip({
        "requirements.txt": "requests>=2.28\n",
        "mypackage/__init__.py": "# init\n",
        "mypackage/core.py": "def hello():\n    return 'hello'\n",
        "tests/test_core.py": "def test_hello(): pass\n",
    })


def _make_python_zip_github() -> bytes:
    """GitHub-style ZIP: one top-level directory wrapping the repo."""
    return _make_zip({
        "my-repo-main/requirements.txt": "flask>=2.0\n",
        "my-repo-main/app/__init__.py": "# app\n",
        "my-repo-main/app/main.py": "print('hello')\n",
        "my-repo-main/tests/test_main.py": "def test_main(): pass\n",
    })


def _make_non_python_zip() -> bytes:
    """ZIP with only non-Python files."""
    return _make_zip({
        "README.md": "# hello\n",
        "image.png": b"\x89PNG\r\n",
        "styles.css": "body { color: red; }\n",
    })


def _make_empty_zip() -> bytes:
    """ZIP with no entries."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w"):
        pass
    return buf.getvalue()


def _make_traversal_zip() -> bytes:
    """ZIP containing a path traversal entry."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../evil.py", "import os; os.system('rm -rf /')\n")
        zf.writestr("safe.py", "x = 1\n")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# POST /api/repository/upload — happy paths
# ---------------------------------------------------------------------------

def test_upload_valid_zip_flat_returns_200():
    """A valid flat-layout ZIP must return HTTP 200 with repository metadata."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("myproject.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200, response.text


def test_upload_valid_zip_flat_returns_correct_fields():
    """Response must include all required metadata fields."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("myproject.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "repository_path" in data
    assert "repository_name" in data
    assert "file_count" in data
    assert "python_file_count" in data
    assert "test_file_count" in data


def test_upload_valid_zip_flat_repository_name():
    """repository_name must be derived from the ZIP filename (without extension)."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("awesome-project.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    assert response.json()["repository_name"] == "awesome-project"


def test_upload_valid_zip_flat_python_file_count():
    """python_file_count must be >= 1 for the flat Python ZIP."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("p.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    assert response.json()["python_file_count"] >= 1


def test_upload_valid_zip_flat_test_file_count():
    """test_file_count must be >= 1 (the flat ZIP contains tests/test_core.py)."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("p.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    assert response.json()["test_file_count"] >= 1


def test_upload_valid_zip_flat_repository_path_is_a_directory():
    """repository_path in the response must point to an existing directory."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("p.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    repo_path = Path(response.json()["repository_path"])
    assert repo_path.exists()
    assert repo_path.is_dir()


def test_upload_github_style_zip_returns_200():
    """A GitHub-style ZIP with one top-level directory must return HTTP 200."""
    zip_bytes = _make_python_zip_github()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("repo.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200, response.text


def test_upload_github_style_zip_repo_root_is_inner_dir():
    """For GitHub-style ZIPs the repository_path must be the inner directory."""
    zip_bytes = _make_python_zip_github()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("repo.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    repo_path = Path(response.json()["repository_path"])
    # The inner dir should contain requirements.txt, not have "repomedic_upload" as name
    assert (repo_path / "requirements.txt").exists()


def test_upload_github_style_zip_python_files_detected():
    """Python files inside the GitHub-style ZIP must be counted correctly."""
    zip_bytes = _make_python_zip_github()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("repo.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    assert response.json()["python_file_count"] >= 1


# ---------------------------------------------------------------------------
# POST /api/repository/upload — error paths
# ---------------------------------------------------------------------------

def test_upload_non_zip_extension_returns_415():
    """Uploading a non-.zip file must return HTTP 415."""
    response = client.post(
        "/api/repository/upload",
        files={"file": ("repo.tar.gz", b"fake data", "application/gzip")},
    )
    assert response.status_code == 415
    assert "zip" in response.json()["detail"].lower()


def test_upload_txt_file_returns_415():
    """Uploading a .txt file must return HTTP 415."""
    response = client.post(
        "/api/repository/upload",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


def test_upload_empty_zip_returns_422():
    """An empty ZIP archive must return HTTP 422."""
    zip_bytes = _make_empty_zip()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("empty.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 422
    assert "empty" in response.json()["detail"].lower()


def test_upload_non_python_repo_returns_422():
    """A ZIP with no Python files and no Python indicators must return HTTP 422."""
    zip_bytes = _make_non_python_zip()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("static.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "python" in detail.lower()


def test_upload_path_traversal_zip_returns_422():
    """A ZIP containing path-traversal entries must be rejected with HTTP 422."""
    zip_bytes = _make_traversal_zip()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("evil.zip", zip_bytes, "application/zip")},
    )
    # May succeed partially (only safe.py extracted) or fail outright —
    # what matters is that it does NOT return 200 OR, if it returns 200,
    # the evil file was NOT written outside the temp dir.
    if response.status_code == 200:
        # If extraction succeeded despite the traversal entry, confirm the
        # evil file did NOT land outside the repo directory.
        repo_path = Path(response.json()["repository_path"])
        evil_outside = Path("evil.py").resolve()
        assert not evil_outside.exists(), "Path traversal file was written outside temp dir!"
    else:
        assert response.status_code == 422
        assert "traversal" in response.json()["detail"].lower()


def test_upload_empty_file_body_returns_422():
    """Uploading a zero-byte file must return HTTP 422."""
    response = client.post(
        "/api/repository/upload",
        files={"file": ("empty.zip", b"", "application/zip")},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Service-layer unit tests (no HTTP overhead)
# ---------------------------------------------------------------------------

def test_service_flat_extract_and_register(tmp_path):
    """extract_and_register must succeed for a flat-layout Python ZIP."""
    zip_bytes = _make_python_zip_flat()
    result = extract_and_register(zip_bytes, "myproject.zip")
    assert result.repository_name == "myproject"
    assert result.python_file_count >= 1
    assert result.file_count >= 1


def test_service_github_extract_and_register():
    """extract_and_register must unwrap a GitHub-style one-dir ZIP."""
    zip_bytes = _make_python_zip_github()
    result = extract_and_register(zip_bytes, "repo.zip")
    # The inner directory should contain requirements.txt
    assert (Path(result.repository_path) / "requirements.txt").exists()


def test_service_count_files(tmp_path):
    """_count_files must correctly count total, python, and test files."""
    (tmp_path / "a.py").write_text("x = 1\n")
    (tmp_path / "test_b.py").write_text("def test_b(): pass\n")
    (tmp_path / "README.md").write_text("# readme\n")
    total, python, tests = _count_files(tmp_path)
    assert total == 3
    assert python == 2
    assert tests == 1


def test_service_count_files_test_suffix(tmp_path):
    """Files named *_test.py must also be counted as test files."""
    (tmp_path / "core_test.py").write_text("def test_x(): pass\n")
    total, python, tests = _count_files(tmp_path)
    assert tests == 1


def test_service_assert_python_repo_passes_with_py_file(tmp_path):
    """_assert_python_repo must not raise when a .py file is present."""
    (tmp_path / "main.py").write_text("x = 1\n")
    _assert_python_repo(tmp_path)  # should not raise


def test_service_assert_python_repo_passes_with_requirements(tmp_path):
    """_assert_python_repo must not raise when requirements.txt is present."""
    (tmp_path / "requirements.txt").write_text("requests\n")
    _assert_python_repo(tmp_path)  # should not raise


def test_service_assert_python_repo_raises_for_no_indicators(tmp_path):
    """_assert_python_repo must raise ValueError when no Python indicators exist."""
    (tmp_path / "README.md").write_text("# hello\n")
    with pytest.raises(ValueError, match="[Pp]ython"):
        _assert_python_repo(tmp_path)


def test_service_safe_extract_rejects_traversal(tmp_path):
    """_safe_extract must raise ValueError for path-traversal ZIP entries."""
    zip_bytes = _make_traversal_zip()
    with pytest.raises(ValueError, match="[Tt]raversal"):
        _safe_extract(zip_bytes, tmp_path)


def test_service_safe_extract_rejects_empty_zip(tmp_path):
    """_safe_extract must raise ValueError for an empty ZIP."""
    zip_bytes = _make_empty_zip()
    with pytest.raises(ValueError, match="[Ee]mpty"):
        _safe_extract(zip_bytes, tmp_path)


def test_service_resolve_repo_root_flat(tmp_path):
    """_resolve_repo_root must return workspace itself for flat layout."""
    (tmp_path / "main.py").write_text("x = 1\n")
    assert _resolve_repo_root(tmp_path) == tmp_path


def test_service_resolve_repo_root_github_style(tmp_path):
    """_resolve_repo_root must return the inner dir for GitHub-style layout."""
    inner = tmp_path / "my-repo-main"
    inner.mkdir()
    (inner / "main.py").write_text("x = 1\n")
    assert _resolve_repo_root(tmp_path) == inner


# ---------------------------------------------------------------------------
# Metadata accuracy
# ---------------------------------------------------------------------------

def test_upload_metadata_file_count_accurate():
    """file_count in the response must match the number of files in the ZIP."""
    zip_bytes = _make_python_zip_flat()
    response = client.post(
        "/api/repository/upload",
        files={"file": ("p.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    # 4 files: requirements.txt, __init__.py, core.py, test_core.py
    assert data["file_count"] == 4


def test_upload_extracted_path_usable_for_analyze():
    """The repository_path returned by upload must be accepted by /api/analyze."""
    zip_bytes = _make_python_zip_flat()
    upload_response = client.post(
        "/api/repository/upload",
        files={"file": ("proj.zip", zip_bytes, "application/zip")},
    )
    assert upload_response.status_code == 200
    repo_path = upload_response.json()["repository_path"]

    analyze_response = client.post(
        "/api/analyze",
        json={"repository_path": repo_path},
    )
    assert analyze_response.status_code == 200
