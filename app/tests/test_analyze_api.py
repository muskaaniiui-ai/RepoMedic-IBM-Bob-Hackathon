"""Backend integration tests for POST /api/analyze."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

# Absolute path to the bundled sample repository
SAMPLE_REPO = str(Path(__file__).parent.parent / "sample_repo")


# ---------------------------------------------------------------------------
# POST /api/analyze — happy-path tests
# ---------------------------------------------------------------------------

def test_analyze_valid_path_returns_200():
    """A valid repository path must return HTTP 200."""
    response = client.post("/api/analyze", json={"repository_path": SAMPLE_REPO})
    assert response.status_code == 200


def test_analyze_sample_repo_returns_seven_findings():
    """The bundled sample_repo must produce exactly 7 findings."""
    response = client.post("/api/analyze", json={"repository_path": SAMPLE_REPO})
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total"] == 7


def test_analyze_summary_counts_are_correct():
    """Summary counts must match the known sample_repo findings distribution."""
    response = client.post("/api/analyze", json={"repository_path": SAMPLE_REPO})
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["total"] == 7
    assert summary["high"] == 1
    assert summary["medium"] == 4
    assert summary["low"] == 2


def test_analyze_response_contains_findings_list():
    """Response must include a 'findings' list with one entry per finding."""
    response = client.post("/api/analyze", json={"repository_path": SAMPLE_REPO})
    assert response.status_code == 200
    data = response.json()
    findings = data["findings"]
    assert isinstance(findings, list)
    assert len(findings) == 7


def test_analyze_each_finding_has_required_fields():
    """Every finding must carry all required fields."""
    response = client.post("/api/analyze", json={"repository_path": SAMPLE_REPO})
    assert response.status_code == 200
    required = {"check_id", "severity", "file_path", "title", "explanation", "evidence", "suggestion"}
    for finding in response.json()["findings"]:
        for field in required:
            assert field in finding, f"Missing field '{field}' in finding"


def test_analyze_response_contains_repository_path():
    """Response must echo back the (resolved) repository path."""
    response = client.post("/api/analyze", json={"repository_path": SAMPLE_REPO})
    assert response.status_code == 200
    assert "repository_path" in response.json()


# ---------------------------------------------------------------------------
# POST /api/analyze — error-path tests
# ---------------------------------------------------------------------------

def test_analyze_nonexistent_path_returns_422():
    """A path that does not exist on disk must return HTTP 422."""
    response = client.post(
        "/api/analyze",
        json={"repository_path": "/this/path/does/not/exist/anywhere"},
    )
    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"]


def test_analyze_file_path_returns_422(tmp_path):
    """Supplying a file path instead of a directory must return HTTP 422."""
    f = tmp_path / "notadir.py"
    f.write_text("# not a directory\n")
    response = client.post("/api/analyze", json={"repository_path": str(f)})
    assert response.status_code == 422
    assert "not a directory" in response.json()["detail"]


def test_analyze_missing_body_field_returns_422():
    """Omitting the required 'repository_path' field must return HTTP 422."""
    response = client.post("/api/analyze", json={})
    assert response.status_code == 422


def test_analyze_empty_repo_returns_zero_findings(tmp_path):
    """An empty directory has no source files and must return 0 findings."""
    response = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total"] == 0
    assert data["findings"] == []
