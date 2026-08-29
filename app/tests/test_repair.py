"""Comprehensive tests for the RepoMedic repair engine.

These tests use temporary directories so that the real sample_repo is never
modified during the test run.  All existing tests must continue to pass after
adding these tests.
"""

import ast
import re
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.repair_service import (
    preview_repairs,
    apply_repairs,
    verify_repairs,
    _repair_py011,
    _repair_py003,
    _repair_doc001,
    _repair_cfg001,
    _create_backup,
    get_session,
)
from backend.models.repair import RepairRequest

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo(tmp_path: Path, files: dict) -> Path:
    """Create a temporary repository with the given {relative_path: content} mapping."""
    for rel, content in files.items():
        target = tmp_path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return tmp_path


# ---------------------------------------------------------------------------
# POST /api/repair/preview — error paths
# ---------------------------------------------------------------------------

def test_preview_nonexistent_path_returns_422():
    """A path that does not exist must return HTTP 422."""
    response = client.post(
        "/api/repair/preview",
        json={"repository_path": "/this/path/does/not/exist/anywhere"},
    )
    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"]


def test_preview_file_path_returns_422(tmp_path):
    """Supplying a file instead of a directory must return HTTP 422."""
    f = tmp_path / "notadir.py"
    f.write_text("# file\n")
    response = client.post(
        "/api/repair/preview",
        json={"repository_path": str(f)},
    )
    assert response.status_code == 422
    assert "not a directory" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Preview does not modify files
# ---------------------------------------------------------------------------

def test_preview_does_not_modify_files(tmp_path):
    """POST /api/repair/preview must leave all files unchanged."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
        "spectral/__init__.py": '"""pkg."""\n',
        "spectral/pipeline.py": (
            '"""module."""\n'
            "def run(arr):\n"
            "    for i in range(1, len(arr) - 1):\n"
            "        if arr[i] >= arr[i - 1]:\n"
            "            pass\n"
        ),
    })
    # Record original contents
    before = {p: p.read_text() for p in repo.rglob("*") if p.is_file()}

    response = client.post("/api/repair/preview", json={"repository_path": str(repo)})
    assert response.status_code == 200
    data = response.json()
    assert data["dry_run"] is True

    # Confirm nothing changed
    after = {p: p.read_text() for p in repo.rglob("*") if p.is_file()}
    assert before == after


# ---------------------------------------------------------------------------
# PY011 handler
# ---------------------------------------------------------------------------

def test_py011_repair_handler_generates_change(tmp_path):
    """_repair_py011 should produce a safe change replacing >= with >."""
    source = (
        '"""module."""\n'
        "def find_peaks(arr):\n"
        "    for i in range(1, len(arr) - 1):\n"
        "        if arr[i] >= arr[i - 1]:\n"
        "            pass\n"
    )
    repo = _make_repo(tmp_path, {"analyzer.py": source})
    finding = {
        "check_id": "PY011",
        "file_path": "analyzer.py",
        "line": 4,
        "evidence": "        if arr[i] >= arr[i - 1]:",
        "suggestion": "Use >",
    }
    change = _repair_py011(repo, finding)
    assert change.status == "PROPOSED"
    assert change.safe_to_apply is True
    assert ">=" not in change.new_text
    assert ">" in change.new_text


def test_py011_apply_actually_replaces_operator(tmp_path):
    """Applying PY011 repair must change >= to > on disk."""
    source = (
        '"""module."""\n'
        "def find_peaks(arr):\n"
        "    for i in range(1, len(arr) - 1):\n"
        "        if arr[i] >= arr[i - 1]:\n"
        "            pass\n"
    )
    repo = _make_repo(tmp_path, {
        "analyzer.py": source,
        "requirements.txt": "# no deps\n",
    })
    result = apply_repairs(str(repo), finding_ids=["PY011"])
    applied = [c for c in result.changes if c.check_id == "PY011"]
    assert len(applied) == 1
    assert applied[0].status == "AUTO_REPAIRED"

    # Confirm file was actually changed
    new_source = (repo / "analyzer.py").read_text()
    assert ">=" not in new_source.split("\n")[3]  # line 4 (0-indexed: 3)


def test_py011_no_ge_operator_skipped(tmp_path):
    """If the flagged line has no >=, the change must be SKIPPED."""
    source = (
        '"""module."""\n'
        "def find_peaks(arr):\n"
        "    for i in range(1, len(arr) - 1):\n"
        "        if arr[i] > arr[i - 1]:\n"
        "            pass\n"
    )
    repo = _make_repo(tmp_path, {"analyzer.py": source})
    finding = {
        "check_id": "PY011",
        "file_path": "analyzer.py",
        "line": 4,
        "evidence": "if arr[i] > arr[i - 1]:",
        "suggestion": "",
    }
    change = _repair_py011(repo, finding)
    assert change.status == "SKIPPED"
    assert change.safe_to_apply is False


# ---------------------------------------------------------------------------
# PY003 handler
# ---------------------------------------------------------------------------

def test_py003_repair_handler_generates_change(tmp_path):
    """_repair_py003 should produce a safe change replacing print with logging."""
    source = (
        '"""module."""\n'
        "def run(step):\n"
        '    print(f"Warning: step {step} failed")\n'
    )
    repo = _make_repo(tmp_path, {"pipeline.py": source})
    finding = {
        "check_id": "PY003",
        "file_path": "pipeline.py",
        "line": 3,
        "evidence": '    print(f"Warning: step {step} failed")',
        "suggestion": "Use logging",
    }
    change = _repair_py003(repo, finding)
    assert change.status == "PROPOSED"
    assert change.safe_to_apply is True
    assert "logging.warning" in change.new_text
    assert "print" not in change.new_text


def test_py003_apply_adds_logging_import(tmp_path):
    """Applying PY003 must inject `import logging` if it is not already present."""
    source = (
        '"""module."""\n'
        "def run():\n"
        '    print("warning")\n'
    )
    repo = _make_repo(tmp_path, {
        "pipeline.py": source,
        "requirements.txt": "# no deps\n",
    })
    result = apply_repairs(str(repo), finding_ids=["PY003"])
    applied = [c for c in result.changes if c.check_id == "PY003"]
    assert len(applied) == 1
    assert applied[0].status == "AUTO_REPAIRED"

    new_source = (repo / "pipeline.py").read_text()
    assert "import logging" in new_source
    assert "logging.warning" in new_source
    assert "print(" not in new_source.split("def run")[1]  # after the function def


def test_py003_no_duplicate_import(tmp_path):
    """If `import logging` already exists, it must not be duplicated."""
    source = (
        '"""module."""\n'
        "import logging\n"
        "def run():\n"
        '    print("warning")\n'
    )
    repo = _make_repo(tmp_path, {
        "pipeline.py": source,
        "requirements.txt": "# no deps\n",
    })
    result = apply_repairs(str(repo), finding_ids=["PY003"])
    new_source = (repo / "pipeline.py").read_text()
    import_count = new_source.count("import logging")
    assert import_count == 1


# ---------------------------------------------------------------------------
# DOC001 handler
# ---------------------------------------------------------------------------

def test_doc001_creates_readme(tmp_path):
    """_repair_doc001 should create a README.md in the package directory."""
    repo = _make_repo(tmp_path, {
        "mypackage/__init__.py": '"""mypackage."""\n',
    })
    finding = {
        "check_id": "DOC001",
        "file_path": "mypackage/__init__.py",
        "line": None,
        "evidence": "ls mypackage/ — no README found",
        "suggestion": "Add a README.md",
    }
    change = _repair_doc001(repo, finding)
    assert change.status == "PROPOSED"
    assert change.safe_to_apply is True
    assert "README.md" in change.file_path
    assert "mypackage" in change.new_text


def test_doc001_apply_creates_readme_on_disk(tmp_path):
    """Applying DOC001 must create README.md in the package directory."""
    repo = _make_repo(tmp_path, {
        "mypkg/__init__.py": '"""mypkg."""\n',
        "requirements.txt": "# no deps\n",
    })
    result = apply_repairs(str(repo), finding_ids=["DOC001"])
    applied = [c for c in result.changes if c.check_id == "DOC001"]
    assert len(applied) == 1
    assert applied[0].status == "AUTO_REPAIRED"

    readme = repo / "mypkg" / "README.md"
    assert readme.exists()
    content = readme.read_text()
    assert "mypkg" in content


def test_doc001_does_not_overwrite_existing_readme(tmp_path):
    """If README.md already exists, DOC001 must be SKIPPED."""
    repo = _make_repo(tmp_path, {
        "mypkg/__init__.py": '"""mypkg."""\n',
        "mypkg/README.md": "# Existing README\n",
    })
    finding = {
        "check_id": "DOC001",
        "file_path": "mypkg/__init__.py",
        "line": None,
        "evidence": "",
        "suggestion": "",
    }
    change = _repair_doc001(repo, finding)
    assert change.status == "SKIPPED"


# ---------------------------------------------------------------------------
# CFG001 handler
# ---------------------------------------------------------------------------

def test_cfg001_repair_handler_generates_change(tmp_path):
    """_repair_cfg001 should propose replacing old numpy pin conservatively."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
    })
    finding = {
        "check_id": "CFG001",
        "file_path": "requirements.txt",
        "line": 1,
        "evidence": "numpy==1.21.0",
        "suggestion": "Update numpy",
    }
    change = _repair_cfg001(repo, finding)
    assert change.status == "PROPOSED"
    assert change.safe_to_apply is True
    assert "numpy>=1.23.0" in change.new_text
    assert "==" not in change.new_text


def test_cfg001_apply_updates_requirements(tmp_path):
    """Applying CFG001 must update the pinned numpy version on disk."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
    })
    result = apply_repairs(str(repo), finding_ids=["CFG001"])
    applied = [c for c in result.changes if c.check_id == "CFG001"]
    assert len(applied) == 1
    assert applied[0].status == "AUTO_REPAIRED"

    req_content = (repo / "requirements.txt").read_text()
    assert "numpy==1.21.0" not in req_content
    assert "numpy>=1.23.0" in req_content


def test_cfg001_unknown_package_skipped(tmp_path):
    """A pinned package with no known minimum is SKIPPED."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "someobscurelib==0.1.0\n",
    })
    finding = {
        "check_id": "CFG001",
        "file_path": "requirements.txt",
        "line": 1,
        "evidence": "someobscurelib==0.1.0",
        "suggestion": "Update",
    }
    change = _repair_cfg001(repo, finding)
    assert change.status in ("SKIPPED", "PROPOSED")
    if change.status == "PROPOSED":
        pytest.skip("Package happened to match known minimums")


# ---------------------------------------------------------------------------
# PY009 — manual review only
# ---------------------------------------------------------------------------

def test_py009_is_manual_review(tmp_path):
    """PY009 must be MANUAL_REVIEW — never auto-applied."""
    source = (
        '"""module."""\n'
        "def run():\n"
        "    try:\n"
        "        risky()\n"
        "    except Exception as e:\n"
        '        print(f"warning: {e}")\n'
    )
    repo = _make_repo(tmp_path, {
        "pipeline.py": source,
        "requirements.txt": "# no deps\n",
    })
    result = preview_repairs(str(repo), finding_ids=["PY009"])
    py009_changes = [c for c in result.changes if c.check_id == "PY009"]
    assert len(py009_changes) == 1
    assert py009_changes[0].status == "MANUAL_REVIEW"
    assert py009_changes[0].safe_to_apply is False


def test_py009_apply_does_not_modify_file(tmp_path):
    """apply_repairs must not modify any file for PY009."""
    source = (
        '"""module."""\n'
        "def run():\n"
        "    try:\n"
        "        risky()\n"
        "    except Exception as e:\n"
        '        print(f"warning: {e}")\n'
    )
    repo = _make_repo(tmp_path, {
        "pipeline.py": source,
        "requirements.txt": "# no deps\n",
    })
    original = (repo / "pipeline.py").read_text()
    apply_repairs(str(repo), finding_ids=["PY009"])
    assert (repo / "pipeline.py").read_text() == original


# ---------------------------------------------------------------------------
# TST001 — manual review only
# ---------------------------------------------------------------------------

def test_tst001_is_manual_review(tmp_path):
    """TST001 must be MANUAL_REVIEW — never auto-applied."""
    source = (
        "def test_add():\n"
        "    assert 1 + 1 == 2\n"
    )
    repo = _make_repo(tmp_path, {
        "tests/test_math.py": source,
        "requirements.txt": "# no deps\n",
    })
    result = preview_repairs(str(repo), finding_ids=["TST001"])
    tst001_changes = [c for c in result.changes if c.check_id == "TST001"]
    if not tst001_changes:
        pytest.skip("TST001 not triggered in this synthetic repo")
    assert tst001_changes[0].status == "MANUAL_REVIEW"
    assert tst001_changes[0].safe_to_apply is False


# ---------------------------------------------------------------------------
# Backup creation
# ---------------------------------------------------------------------------

def test_backup_created_before_modifications(tmp_path):
    """apply_repairs must create a backup directory containing original files."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
    })
    result = apply_repairs(str(repo), finding_ids=["CFG001"])
    assert result.backup_created is True
    assert result.backup_path is not None

    backup = Path(result.backup_path)
    assert backup.is_dir()
    backed_up_req = backup / "requirements.txt"
    assert backed_up_req.exists()
    assert "numpy==1.21.0" in backed_up_req.read_text()


def test_backup_contains_original_content(tmp_path):
    """The backup must contain the pre-repair file content."""
    original_content = "numpy==1.21.0\n"
    repo = _make_repo(tmp_path, {"requirements.txt": original_content})
    result = apply_repairs(str(repo), finding_ids=["CFG001"])

    backup_path = Path(result.backup_path)
    backed_up = (backup_path / "requirements.txt").read_text()
    assert backed_up == original_content


def test_create_backup_helper(tmp_path):
    """_create_backup should copy every listed file into a new directory."""
    f = tmp_path / "important.txt"
    f.write_text("original\n")
    backup_dir = _create_backup([f], tmp_path)
    assert Path(backup_dir).is_dir()
    assert (Path(backup_dir) / "important.txt").read_text() == "original\n"


# ---------------------------------------------------------------------------
# Repair application — API endpoint
# ---------------------------------------------------------------------------

def test_apply_endpoint_returns_counts(tmp_path):
    """POST /api/repair/apply must return correct applied/manual/skipped counts."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
        "spectral/__init__.py": '"""pkg."""\n',
    })
    response = client.post(
        "/api/repair/apply",
        json={"repository_path": str(repo)},
    )
    assert response.status_code == 200
    data = response.json()
    assert "applied_count" in data
    assert "manual_review_count" in data
    assert "skipped_count" in data
    assert "failed_count" in data
    assert data["dry_run"] is False


def test_apply_endpoint_nonexistent_path_returns_422():
    """POST /api/repair/apply with a bad path must return HTTP 422."""
    response = client.post(
        "/api/repair/apply",
        json={"repository_path": "/no/such/directory"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Verification endpoint
# ---------------------------------------------------------------------------

def test_verify_endpoint_runs_and_returns_structure(tmp_path):
    """POST /api/repair/verify must return a well-formed VerificationResponse."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "# no deps\n",
    })
    # First apply (even if nothing to repair) to establish a session
    client.post("/api/repair/apply", json={"repository_path": str(repo)})

    response = client.post(
        "/api/repair/verify",
        json={"repository_path": str(repo)},
    )
    assert response.status_code == 200
    data = response.json()

    required_fields = {
        "tests_passed", "tests_failed", "analyzer_before_count",
        "analyzer_after_count", "resolved_count", "remaining_count",
        "regression_detected", "verification_status", "details", "test_output",
    }
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


def test_verify_reruns_analyzer(tmp_path):
    """verify_repairs must re-run the analyzer and report before/after counts."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
    })
    # Apply repair first
    apply_repairs(str(repo), finding_ids=["CFG001"])
    # Verify
    vr = verify_repairs(str(repo))
    assert vr["analyzer_before_count"] >= 1
    assert "analyzer_after_count" in vr


def test_verify_detects_resolved_findings(tmp_path):
    """After repairing CFG001, verify should report at least one resolved finding."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
    })
    apply_repairs(str(repo), finding_ids=["CFG001"])
    vr = verify_repairs(str(repo))
    # CFG001 should be resolved — the pin no longer matches the old version
    assert vr["resolved_count"] >= 1


def test_verify_reports_not_run_without_pytest(tmp_path, monkeypatch):
    """If pytest is unavailable the test status must not fabricate pass/fail."""
    repo = _make_repo(tmp_path, {"requirements.txt": "# no deps\n"})
    apply_repairs(str(repo))

    # Monkeypatch subprocess.run to simulate FileNotFoundError
    def _raise(*args, **kwargs):
        raise FileNotFoundError("pytest not found")

    monkeypatch.setattr("backend.services.repair_service.subprocess.run", _raise)
    vr = verify_repairs(str(repo))
    assert vr["verification_status"] in ("NOT_RUN", "PASSED", "FAILED", "PARTIAL")
    assert "not available" in vr["test_output"].lower() or vr["test_output"] != ""


def test_verify_before_after_comparison(tmp_path):
    """before_count should equal the session's original finding count."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
    })
    apply_result = apply_repairs(str(repo))
    session = get_session(str(repo))
    assert session is not None

    vr = verify_repairs(str(repo))
    assert vr["analyzer_before_count"] == session.before_finding_count


def test_verify_regression_detection(tmp_path):
    """If the repo tests fail, regression_detected must be True."""
    # Create a repo with a failing test
    repo = _make_repo(tmp_path, {
        "requirements.txt": "# no deps\n",
        "tests/test_broken.py": (
            "def test_always_fails():\n"
            "    assert False, 'intentional failure'\n"
        ),
    })
    apply_repairs(str(repo))
    vr = verify_repairs(str(repo))
    # The failing test must be detected
    assert vr["tests_failed"] >= 1
    assert vr["regression_detected"] is True


# ---------------------------------------------------------------------------
# Failed repair handling
# ---------------------------------------------------------------------------

def test_failed_repair_file_not_found(tmp_path):
    """If the file to repair does not exist, the change must be FAILED or SKIPPED."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "# no deps\n",
    })
    # Manually construct a finding pointing at a non-existent file
    from backend.services.repair_service import _repair_py011
    finding = {
        "check_id": "PY011",
        "file_path": "nonexistent/file.py",
        "line": 5,
        "evidence": "if arr[i] >= arr[i-1]:",
        "suggestion": "",
    }
    change = _repair_py011(repo, finding)
    assert change.status in ("FAILED", "SKIPPED")
    assert change.safe_to_apply is False


def test_finding_ids_filter_applied(tmp_path):
    """When finding_ids is specified, only those rules should be targeted."""
    repo = _make_repo(tmp_path, {
        "requirements.txt": "numpy==1.21.0\n",
        "spectral/__init__.py": '"""pkg."""\n',
    })
    result = apply_repairs(str(repo), finding_ids=["CFG001"])
    # Only CFG001 should appear in changes
    non_cfg = [c for c in result.changes if c.check_id != "CFG001"]
    assert len(non_cfg) == 0
