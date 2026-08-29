"""Unit tests for the RepoMedic repository analyzer."""

from pathlib import Path
import pytest

from core.analyzer import (
    RepositoryAnalyzer,
    check_bare_except,
    check_broad_exception_suppressed,
    check_print_in_library,
    check_missing_module_docstring,
    check_mutable_default_argument,
    check_unused_imports,
    check_todo_fixme_comments,
    check_pinned_old_dependency,
    check_exception_logged_not_raised,
    check_unreferenced_module_functions,
    check_loop_boundary_ge_comparison,
    check_test_file_no_failure_path,
)
from core.finding import Finding
import ast


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse(source: str) -> ast.Module:
    return ast.parse(source)


def _check(fn, source: str, filename: str = "module.py") -> list:
    path = Path(filename)
    tree = _parse(source) if filename.endswith(".py") else None
    return fn(path, source, tree, filename)


# ---------------------------------------------------------------------------
# check_bare_except  (PY001)
# ---------------------------------------------------------------------------

def test_bare_except_detected():
    source = "try:\n    pass\nexcept:\n    pass\n"
    findings = _check(check_bare_except, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY001"
    assert findings[0].severity == "MEDIUM"
    assert findings[0].line == 3


def test_bare_except_specific_exception_not_flagged():
    source = "try:\n    pass\nexcept ValueError:\n    pass\n"
    findings = _check(check_bare_except, source)
    assert findings == []


def test_bare_except_multiple_handlers():
    source = (
        "try:\n    pass\nexcept:\n    pass\n"
        "try:\n    pass\nexcept:\n    pass\n"
    )
    findings = _check(check_bare_except, source)
    assert len(findings) == 2


# ---------------------------------------------------------------------------
# check_broad_exception_suppressed  (PY002)
# ---------------------------------------------------------------------------

def test_silent_exception_swallow_detected():
    source = (
        "try:\n"
        "    risky()\n"
        "except Exception as e:\n"
        "    pass\n"
    )
    findings = _check(check_broad_exception_suppressed, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY002"
    assert findings[0].severity == "HIGH"


def test_exception_with_print_not_flagged():
    source = (
        "try:\n"
        "    risky()\n"
        "except Exception as e:\n"
        "    print(e)\n"
    )
    findings = _check(check_broad_exception_suppressed, source)
    assert findings == []


def test_exception_with_reraise_not_flagged():
    source = (
        "try:\n"
        "    risky()\n"
        "except Exception:\n"
        "    raise\n"
    )
    findings = _check(check_broad_exception_suppressed, source)
    assert findings == []


# ---------------------------------------------------------------------------
# check_print_in_library  (PY003)
# ---------------------------------------------------------------------------

def test_print_in_library_flagged():
    source = 'def run():\n    print("warning")\n'
    findings = _check(check_print_in_library, source, "pipeline.py")
    assert len(findings) == 1
    assert findings[0].check_id == "PY003"


def test_print_in_test_file_not_flagged():
    source = 'def test_foo():\n    print("debug")\n'
    findings = _check(check_print_in_library, source, "test_pipeline.py")
    assert findings == []


# ---------------------------------------------------------------------------
# check_missing_module_docstring  (PY004)
# ---------------------------------------------------------------------------

def test_missing_module_docstring_flagged():
    source = "import os\n"
    findings = _check(check_missing_module_docstring, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY004"


def test_module_with_docstring_not_flagged():
    source = '"""This module does things."""\nimport os\n'
    findings = _check(check_missing_module_docstring, source)
    assert findings == []


def test_test_file_module_docstring_not_checked():
    source = "import os\n"
    findings = _check(check_missing_module_docstring, source, "test_foo.py")
    assert findings == []


# ---------------------------------------------------------------------------
# check_mutable_default_argument  (PY006)
# ---------------------------------------------------------------------------

def test_mutable_list_default_flagged():
    source = "def foo(items=[]):\n    return items\n"
    findings = _check(check_mutable_default_argument, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY006"


def test_mutable_dict_default_flagged():
    source = "def bar(cfg={}):\n    return cfg\n"
    findings = _check(check_mutable_default_argument, source)
    assert len(findings) == 1


def test_none_default_not_flagged():
    source = "def baz(items=None):\n    return items\n"
    findings = _check(check_mutable_default_argument, source)
    assert findings == []


# ---------------------------------------------------------------------------
# check_unused_imports  (PY007)
# ---------------------------------------------------------------------------

def test_unused_import_flagged():
    source = "import os\nimport math\n\ndef foo():\n    return math.pi\n"
    findings = _check(check_unused_imports, source)
    ids = [f.check_id for f in findings]
    assert "PY007" in ids
    unused_names = [f.evidence for f in findings if f.check_id == "PY007"]
    assert any("os" in e for e in unused_names)


def test_used_import_not_flagged():
    source = "import math\n\ndef area(r):\n    return math.pi * r * r\n"
    findings = _check(check_unused_imports, source)
    assert all(f.check_id != "PY007" for f in findings)


# ---------------------------------------------------------------------------
# check_todo_fixme_comments  (PY008)
# ---------------------------------------------------------------------------

def test_todo_comment_flagged():
    source = "x = 1  # TODO: fix this\n"
    findings = _check(check_todo_fixme_comments, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY008"


def test_fixme_comment_flagged():
    source = "# FIXME: broken\npass\n"
    findings = _check(check_todo_fixme_comments, source)
    assert len(findings) == 1


def test_normal_comment_not_flagged():
    source = "# This is a normal comment\npass\n"
    findings = _check(check_todo_fixme_comments, source)
    assert findings == []


# ---------------------------------------------------------------------------
# check_pinned_old_dependency  (CFG001)
# ---------------------------------------------------------------------------

def test_old_numpy_pin_flagged():
    source = "numpy==1.21.0\n"
    findings = _check(check_pinned_old_dependency, source, "requirements.txt")
    assert len(findings) == 1
    assert findings[0].check_id == "CFG001"
    assert findings[0].severity == "MEDIUM"


def test_recent_numpy_not_flagged():
    source = "numpy==1.26.0\n"
    findings = _check(check_pinned_old_dependency, source, "requirements.txt")
    assert findings == []


def test_pinned_dep_in_non_requirements_not_flagged():
    source = "numpy==1.21.0\n"
    findings = _check(check_pinned_old_dependency, source, "setup.cfg")
    assert findings == []


# ---------------------------------------------------------------------------
# Integration: RepositoryAnalyzer against a synthetic repo
# ---------------------------------------------------------------------------

def test_analyzer_raises_on_missing_path():
    with pytest.raises(FileNotFoundError):
        RepositoryAnalyzer("/does/not/exist").analyze()


def test_analyzer_raises_on_file_not_dir(tmp_path):
    f = tmp_path / "notadir.txt"
    f.write_text("hello")
    with pytest.raises(NotADirectoryError):
        RepositoryAnalyzer(f).analyze()


def test_analyzer_returns_list_of_findings(tmp_path):
    """End-to-end: analyzer on a tiny synthetic repo returns Finding objects."""
    (tmp_path / "lib.py").write_text(
        "import os\n"
        "def run(items=[]):\n"
        "    try:\n"
        "        pass\n"
        "    except:\n"
        "        pass\n"
    )
    (tmp_path / "requirements.txt").write_text("numpy==1.21.0\n")

    findings = RepositoryAnalyzer(tmp_path).analyze()
    assert isinstance(findings, list)
    assert len(findings) > 0
    assert all(isinstance(f, Finding) for f in findings)

    check_ids = {f.check_id for f in findings}
    assert "PY001" in check_ids   # bare except
    assert "PY006" in check_ids   # mutable default
    assert "CFG001" in check_ids  # old numpy pin


def test_analyzer_ignores_pycache(tmp_path):
    """__pycache__ files must not appear in findings."""
    pycache = tmp_path / "__pycache__"
    pycache.mkdir()
    (pycache / "lib.cpython-311.pyc").write_bytes(b"\x00\x00")
    (tmp_path / "lib.py").write_text('"""Docstring."""\n')

    findings = RepositoryAnalyzer(tmp_path).analyze()
    for f in findings:
        assert "__pycache__" not in f.file_path


def test_analyzer_on_sample_repo():
    """Analyzer must find at least one finding in the bundled sample_repo."""
    sample_repo = Path(__file__).parent.parent / "sample_repo"
    if not sample_repo.exists():
        pytest.skip("sample_repo not present")
    findings = RepositoryAnalyzer(sample_repo).analyze()
    assert len(findings) > 0, "Expected at least one finding in sample_repo"
    check_ids = {f.check_id for f in findings}
    assert "PY003" in check_ids, "Expected PY003 (print in library) from pipeline.py"
    assert "CFG001" in check_ids, "Expected CFG001 (old numpy pin) from requirements.txt"
    assert "PY009" in check_ids, "Expected PY009 (exception logged not raised) from pipeline.py"
    assert "PY011" in check_ids, "Expected PY011 (loop boundary >=) from analyzer.py"
    assert "TST001" in check_ids, "Expected TST001 (no failure-path tests) from sample_repo/tests/"


# ---------------------------------------------------------------------------
# check_exception_logged_not_raised  (PY009)
# ---------------------------------------------------------------------------

def test_py009_exception_print_no_raise_flagged():
    """except + print only, no re-raise => PY009."""
    source = (
        "try:\n"
        "    risky()\n"
        "except Exception as e:\n"
        "    print(f'warning: {e}')\n"
    )
    findings = _check(check_exception_logged_not_raised, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY009"
    assert findings[0].severity == "HIGH"
    assert findings[0].line == 3


def test_py009_exception_print_with_reraise_not_flagged():
    """except + print + reraise is acceptable => no PY009."""
    source = (
        "try:\n"
        "    risky()\n"
        "except Exception as e:\n"
        "    print(e)\n"
        "    raise\n"
    )
    findings = _check(check_exception_logged_not_raised, source)
    assert findings == []


def test_py009_exception_logging_not_flagged():
    """except + logging.warning (not print) => no PY009."""
    source = (
        "import logging\n"
        "try:\n"
        "    risky()\n"
        "except Exception as e:\n"
        "    logging.warning(str(e))\n"
    )
    findings = _check(check_exception_logged_not_raised, source)
    assert findings == []


def test_py009_completely_silent_not_flagged_by_py009():
    """A completely silent handler has no print => PY009 does not fire (PY002 would)."""
    source = (
        "try:\n"
        "    risky()\n"
        "except Exception:\n"
        "    pass\n"
    )
    findings = _check(check_exception_logged_not_raised, source)
    assert findings == []


def test_py009_named_exception_type_shown_in_title():
    """The exception type name should appear in the finding title."""
    source = (
        "try:\n"
        "    risky()\n"
        "except ValueError as e:\n"
        "    print(e)\n"
    )
    findings = _check(check_exception_logged_not_raised, source)
    assert len(findings) == 1
    assert "ValueError" in findings[0].title


# ---------------------------------------------------------------------------
# check_unreferenced_module_functions  (PY010)
# ---------------------------------------------------------------------------

def test_py010_unreferenced_function_flagged(tmp_path):
    """A module-level function never called anywhere in its own file => PY010."""
    source = (
        '"""Module docstring."""\n'
        "def used():\n"
        "    return 1\n"
        "\n"
        "def dead():\n"
        "    return 2\n"
        "\n"
        "x = used()\n"
    )
    findings = _check(check_unreferenced_module_functions, source, "utils.py")
    check_ids = [f.check_id for f in findings]
    titles = [f.title for f in findings]
    assert "PY010" in check_ids
    assert any("dead" in t for t in titles)
    assert not any("used" in t for t in titles)


def test_py010_all_functions_unreferenced_no_finding():
    """Pure-API file (no function calls itself) => PY010 suppressed."""
    source = (
        '"""Pure API module."""\n'
        "def alpha():\n"
        "    return 1\n"
        "\n"
        "def beta():\n"
        "    return 2\n"
    )
    findings = _check(check_unreferenced_module_functions, source, "api.py")
    assert all(f.check_id != "PY010" for f in findings)


def test_py010_init_py_not_checked():
    """__init__.py is always excluded from PY010."""
    source = "def unused():\n    return 1\n"
    findings = _check(check_unreferenced_module_functions, source, "__init__.py")
    assert all(f.check_id != "PY010" for f in findings)


def test_py010_test_file_not_checked():
    """test_ files are excluded from PY010 (pytest calls them)."""
    source = "def test_foo():\n    assert True\n"
    findings = _check(check_unreferenced_module_functions, source, "test_utils.py")
    assert all(f.check_id != "PY010" for f in findings)


def test_py010_private_function_not_flagged():
    """Functions starting with _ are private helpers — not flagged."""
    source = (
        '"""Module."""\n'
        "def public():\n"
        "    return _helper()\n"
        "\n"
        "def _helper():\n"
        "    return 42\n"
    )
    findings = _check(check_unreferenced_module_functions, source, "utils.py")
    assert all(f.check_id != "PY010" for f in findings)


# ---------------------------------------------------------------------------
# check_loop_boundary_ge_comparison  (PY011)
# ---------------------------------------------------------------------------

def test_py011_ge_against_prev_neighbour_flagged():
    """arr[i] >= arr[i-1] inside a for loop => PY011."""
    source = (
        "def find_peaks(arr):\n"
        "    peaks = []\n"
        "    for i in range(1, len(arr) - 1):\n"
        "        if arr[i] >= arr[i - 1]:\n"
        "            peaks.append(i)\n"
        "    return peaks\n"
    )
    findings = _check(check_loop_boundary_ge_comparison, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY011"
    assert findings[0].severity == "MEDIUM"


def test_py011_ge_against_next_neighbour_flagged():
    """arr[i] >= arr[i+1] inside a for loop => PY011."""
    source = (
        "def scan(arr):\n"
        "    for i in range(len(arr) - 1):\n"
        "        if arr[i] >= arr[i + 1]:\n"
        "            pass\n"
    )
    findings = _check(check_loop_boundary_ge_comparison, source)
    assert len(findings) == 1
    assert findings[0].check_id == "PY011"


def test_py011_strict_gt_not_flagged():
    """arr[i] > arr[i-1] is correct strict comparison — not flagged."""
    source = (
        "def find_peaks(arr):\n"
        "    for i in range(1, len(arr) - 1):\n"
        "        if arr[i] > arr[i - 1]:\n"
        "            pass\n"
    )
    findings = _check(check_loop_boundary_ge_comparison, source)
    assert all(f.check_id != "PY011" for f in findings)


def test_py011_different_arrays_not_flagged():
    """arr[i] >= other[i-1] — different arrays — not flagged."""
    source = (
        "def compare(arr, other):\n"
        "    for i in range(1, len(arr)):\n"
        "        if arr[i] >= other[i - 1]:\n"
        "            pass\n"
    )
    findings = _check(check_loop_boundary_ge_comparison, source)
    assert all(f.check_id != "PY011" for f in findings)


# ---------------------------------------------------------------------------
# check_test_file_no_failure_path  (TST001)
# ---------------------------------------------------------------------------

def test_tst001_happy_path_only_flagged():
    """Test file with no raises/try/except => TST001."""
    source = (
        "def test_add():\n"
        "    assert 1 + 1 == 2\n"
        "\n"
        "def test_sub():\n"
        "    assert 3 - 1 == 2\n"
    )
    findings = _check(check_test_file_no_failure_path, source, "test_math.py")
    assert len(findings) == 1
    assert findings[0].check_id == "TST001"
    assert findings[0].severity == "MEDIUM"


def test_tst001_file_with_pytest_raises_not_flagged():
    """Test file that uses pytest.raises => no TST001."""
    source = (
        "import pytest\n"
        "def test_add():\n"
        "    assert 1 + 1 == 2\n"
        "\n"
        "def test_bad_input():\n"
        "    with pytest.raises(ValueError):\n"
        "        int('abc')\n"
    )
    findings = _check(check_test_file_no_failure_path, source, "test_math.py")
    assert all(f.check_id != "TST001" for f in findings)


def test_tst001_file_with_try_except_not_flagged():
    """Test file containing a try/except => no TST001."""
    source = (
        "def test_something():\n"
        "    try:\n"
        "        int('abc')\n"
        "    except ValueError:\n"
        "        pass\n"
    )
    findings = _check(check_test_file_no_failure_path, source, "test_x.py")
    assert all(f.check_id != "TST001" for f in findings)


def test_tst001_non_test_file_not_checked():
    """TST001 only fires on files named test_*.py."""
    source = (
        "def run():\n"
        "    assert 1 == 1\n"
    )
    findings = _check(check_test_file_no_failure_path, source, "utils.py")
    assert findings == []


def test_tst001_no_test_functions_not_flagged():
    """A test file with no test_ functions produces no TST001."""
    source = (
        "def helper():\n"
        "    return 1\n"
    )
    findings = _check(check_test_file_no_failure_path, source, "test_helpers.py")
    assert findings == []
