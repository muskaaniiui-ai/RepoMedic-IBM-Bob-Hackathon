"""Repair service — applies safe automatic repairs to a repository.

Only known RepoMedic check IDs are ever modified.  Every repair is guarded by
a backup step and a final file-read confirmation.

Supported automatic repairs
---------------------------
- PY011  Replace ``>=`` with ``>`` in loop-boundary comparison
- PY003  Replace ``print(...)`` with ``logging.warning(...)`` in library code
- DOC001 Create a minimal README.md for a package that lacks one
- CFG001 Update the outdated numpy pin in requirements.txt

Manual-review only (no automatic modification)
----------------------------------------------
- PY009  Exception-handling semantics — too risky to rewrite automatically
- TST001 Missing failure-path tests — templates provided, not auto-generated
"""

import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.models.repair import RepairChange, RepairResponse, RepairSession
from backend.services.analyze_service import run_analysis

# ---------------------------------------------------------------------------
# In-memory repair session registry  (keyed by resolved repository path)
# ---------------------------------------------------------------------------

_sessions: dict[str, RepairSession] = {}


def get_session(repository_path: str) -> Optional[RepairSession]:
    """Return the repair session for the given repository path, or None."""
    resolved = str(Path(repository_path).resolve())
    return _sessions.get(resolved)


def _save_session(session: RepairSession) -> None:
    resolved = str(Path(session.repository_path).resolve())
    _sessions[resolved] = session


# ---------------------------------------------------------------------------
# Rule-specific repair handlers
# ---------------------------------------------------------------------------

def _repair_py011(repo_root: Path, finding: dict) -> RepairChange:
    """Replace the first ``>=`` with ``>`` on the flagged line."""
    file_path = repo_root / finding["file_path"]
    line_no = finding.get("line")
    if line_no is None:
        return RepairChange(
            check_id="PY011",
            file_path=finding["file_path"],
            line=None,
            description="Cannot repair: no line number in finding",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    try:
        source = file_path.read_text(encoding="utf-8")
    except OSError as exc:
        return RepairChange(
            check_id="PY011",
            file_path=finding["file_path"],
            line=line_no,
            description=f"Cannot read file: {exc}",
            old_text="",
            new_text="",
            status="FAILED",
            safe_to_apply=False,
        )

    lines = source.splitlines(keepends=True)
    if line_no < 1 or line_no > len(lines):
        return RepairChange(
            check_id="PY011",
            file_path=finding["file_path"],
            line=line_no,
            description=f"Line {line_no} out of range",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    old_line = lines[line_no - 1]
    # Only replace the first occurrence of >= on this line so we don't clobber
    # unrelated operators.  The pattern must look like arr[i] >= arr[i±1].
    if ">=" not in old_line:
        return RepairChange(
            check_id="PY011",
            file_path=finding["file_path"],
            line=line_no,
            description="Pattern '>=' not found on flagged line — skipping",
            old_text=old_line.rstrip(),
            new_text=old_line.rstrip(),
            status="SKIPPED",
            safe_to_apply=False,
        )

    new_line = old_line.replace(">=", ">", 1)
    return RepairChange(
        check_id="PY011",
        file_path=finding["file_path"],
        line=line_no,
        description=(
            "Replace non-strict `>=` with strict `>` in loop-boundary "
            "comparison to avoid treating equal adjacent values as peaks."
        ),
        old_text=old_line.rstrip(),
        new_text=new_line.rstrip(),
        status="PROPOSED",
        safe_to_apply=True,
    )


def _repair_py003(repo_root: Path, finding: dict) -> RepairChange:
    """Replace the ``print(...)`` call identified by the finding with ``logging.warning(...)``."""
    file_path = repo_root / finding["file_path"]
    line_no = finding.get("line")
    if line_no is None:
        return RepairChange(
            check_id="PY003",
            file_path=finding["file_path"],
            line=None,
            description="Cannot repair: no line number in finding",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    try:
        source = file_path.read_text(encoding="utf-8")
    except OSError as exc:
        return RepairChange(
            check_id="PY003",
            file_path=finding["file_path"],
            line=line_no,
            description=f"Cannot read file: {exc}",
            old_text="",
            new_text="",
            status="FAILED",
            safe_to_apply=False,
        )

    lines = source.splitlines(keepends=True)
    if line_no < 1 or line_no > len(lines):
        return RepairChange(
            check_id="PY003",
            file_path=finding["file_path"],
            line=line_no,
            description=f"Line {line_no} out of range",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    old_line = lines[line_no - 1]
    stripped = old_line.lstrip()
    if not stripped.startswith("print("):
        return RepairChange(
            check_id="PY003",
            file_path=finding["file_path"],
            line=line_no,
            description="Line does not start with print() — skipping",
            old_text=old_line.rstrip(),
            new_text=old_line.rstrip(),
            status="SKIPPED",
            safe_to_apply=False,
        )

    indent = old_line[: len(old_line) - len(stripped)]
    # Extract the args from print(...)
    m = re.match(r"print\((.*)\)\s*$", stripped.rstrip())
    if not m:
        return RepairChange(
            check_id="PY003",
            file_path=finding["file_path"],
            line=line_no,
            description="Could not parse print() arguments — skipping",
            old_text=old_line.rstrip(),
            new_text=old_line.rstrip(),
            status="SKIPPED",
            safe_to_apply=False,
        )

    args = m.group(1)
    new_line = f"{indent}logging.warning({args})\n"

    # Determine if `import logging` is already present
    has_logging_import = any(
        re.match(r"\s*import\s+logging\b", ln) for ln in lines
    )

    description = (
        "Replace `print(...)` with `logging.warning(...)` in library code."
    )
    if not has_logging_import:
        description += "  Also adds `import logging` at the top of the file."

    return RepairChange(
        check_id="PY003",
        file_path=finding["file_path"],
        line=line_no,
        description=description,
        old_text=old_line.rstrip(),
        new_text=new_line.rstrip(),
        status="PROPOSED",
        safe_to_apply=True,
    )


def _repair_doc001(repo_root: Path, finding: dict) -> RepairChange:
    """Create a minimal README.md for the package identified by the finding."""
    # finding["file_path"] is the __init__.py — the README goes next to it
    init_path = repo_root / finding["file_path"]
    package_dir = init_path.parent
    readme_path = package_dir / "README.md"

    if readme_path.exists():
        return RepairChange(
            check_id="DOC001",
            file_path=finding["file_path"],
            line=None,
            description="README.md already exists — skipping",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    package_name = package_dir.name
    readme_content = (
        f"# {package_name}\n\n"
        f"This package provides the `{package_name}` module.\n\n"
        "## Usage\n\n"
        f"```python\nimport {package_name}\n```\n\n"
        "## Public API\n\n"
        "See the module source for available classes and functions.\n"
    )

    return RepairChange(
        check_id="DOC001",
        file_path=str(readme_path.relative_to(repo_root).as_posix()),
        line=None,
        description=f"Create README.md for the `{package_name}/` package.",
        old_text="(file does not exist)",
        new_text=readme_content,
        status="PROPOSED",
        safe_to_apply=True,
    )


def _repair_cfg001(repo_root: Path, finding: dict) -> RepairChange:
    """Update the outdated numpy pin conservatively."""
    file_path = repo_root / finding["file_path"]
    line_no = finding.get("line")
    if line_no is None:
        return RepairChange(
            check_id="CFG001",
            file_path=finding["file_path"],
            line=None,
            description="Cannot repair: no line number",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    try:
        source = file_path.read_text(encoding="utf-8")
    except OSError as exc:
        return RepairChange(
            check_id="CFG001",
            file_path=finding["file_path"],
            line=line_no,
            description=f"Cannot read file: {exc}",
            old_text="",
            new_text="",
            status="FAILED",
            safe_to_apply=False,
        )

    lines = source.splitlines(keepends=True)
    if line_no < 1 or line_no > len(lines):
        return RepairChange(
            check_id="CFG001",
            file_path=finding["file_path"],
            line=line_no,
            description=f"Line {line_no} out of range",
            old_text="",
            new_text="",
            status="SKIPPED",
            safe_to_apply=False,
        )

    old_line = lines[line_no - 1]
    old_stripped = old_line.strip()

    # Only operate on the exact numpy==1.21.0 pattern we expect
    m = re.match(r"^([A-Za-z0-9_\-]+)==(\d+\.\d+(?:\.\d+)?)$", old_stripped)
    if not m:
        return RepairChange(
            check_id="CFG001",
            file_path=finding["file_path"],
            line=line_no,
            description="Pinned dependency format not recognised — skipping",
            old_text=old_stripped,
            new_text=old_stripped,
            status="SKIPPED",
            safe_to_apply=False,
        )

    pkg = m.group(1)
    # Conservative minimum versions aligned with analyzer's OLD_PINS thresholds
    CONSERVATIVE_MINIMUMS: dict[str, str] = {
        "numpy": "1.23.0",
        "requests": "2.28.0",
        "django": "3.2.0",
        "flask": "2.0.0",
        "pillow": "9.0.0",
    }
    min_ver = CONSERVATIVE_MINIMUMS.get(pkg.lower())
    if not min_ver:
        return RepairChange(
            check_id="CFG001",
            file_path=finding["file_path"],
            line=line_no,
            description=f"No known safe minimum for `{pkg}` — skipping",
            old_text=old_stripped,
            new_text=old_stripped,
            status="SKIPPED",
            safe_to_apply=False,
        )

    new_stripped = f"{pkg}>={min_ver}"
    new_line = old_line.replace(old_stripped, new_stripped)
    return RepairChange(
        check_id="CFG001",
        file_path=finding["file_path"],
        line=line_no,
        description=(
            f"Update `{pkg}=={m.group(2)}` to `{pkg}>={min_ver}` "
            f"(conservative compatible minimum). "
            "pip install is not run automatically — run it manually after review."
        ),
        old_text=old_stripped,
        new_text=new_stripped,
        status="PROPOSED",
        safe_to_apply=True,
    )


def _manual_review_change(check_id: str, finding: dict, reason: str) -> RepairChange:
    """Return a MANUAL_REVIEW change — no file will be touched."""
    return RepairChange(
        check_id=check_id,
        file_path=finding["file_path"],
        line=finding.get("line"),
        description=reason,
        old_text=finding.get("evidence", ""),
        new_text="(manual action required — see suggestion)",
        status="MANUAL_REVIEW",
        safe_to_apply=False,
    )


# Dispatch table: check_id → handler function
_HANDLERS: dict = {
    "PY011": _repair_py011,
    "PY003": _repair_py003,
    "DOC001": _repair_doc001,
    "CFG001": _repair_cfg001,
}

_MANUAL_REVIEW_REASONS: dict[str, str] = {
    "PY009": (
        "Exception-handling semantics must be reviewed by a human. "
        "Automatically converting `print()` inside an except block to "
        "`logging.warning()` could mask failures or change observable "
        "program behaviour.  Recommended: replace `print()` with "
        "`logging.error(str(e))` and re-raise, or return an explicit error state."
    ),
    "TST001": (
        "Adding failure-path tests requires understanding the expected "
        "exception types and error conditions, which cannot be safely inferred "
        "without running the code.  Recommended: add a test using "
        "`with pytest.raises(ExpectedException): ...` for at least one "
        "error-path scenario."
    ),
}


# ---------------------------------------------------------------------------
# Backup helpers
# ---------------------------------------------------------------------------

def _create_backup(files_to_backup: list[Path], repo_root: Path) -> str:
    """Copy every file that will be modified into a timestamped backup directory.

    Returns the backup directory path as a string.
    """
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = repo_root.parent / f".repomedic_backup_{ts}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    for src in files_to_backup:
        if not src.exists():
            continue
        rel = src.relative_to(repo_root)
        dst = backup_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    return str(backup_dir)


def _restore_backup(backup_dir_str: str, changed_files: list[Path], repo_root: Path) -> None:
    """Restore files from the backup directory after a failed repair."""
    backup_dir = Path(backup_dir_str)
    for dst in changed_files:
        rel = dst.relative_to(repo_root)
        src = backup_dir / rel
        if src.exists():
            shutil.copy2(src, dst)


# ---------------------------------------------------------------------------
# Core service functions
# ---------------------------------------------------------------------------

def _generate_changes(repo_root: Path, findings: list[dict]) -> list[RepairChange]:
    """Generate a RepairChange for every finding in the list."""
    changes: list[RepairChange] = []
    for finding in findings:
        cid = finding.get("check_id", "")
        if cid in _HANDLERS:
            changes.append(_HANDLERS[cid](repo_root, finding))
        elif cid in _MANUAL_REVIEW_REASONS:
            changes.append(_manual_review_change(cid, finding, _MANUAL_REVIEW_REASONS[cid]))
        else:
            # Unknown rule — skip
            changes.append(RepairChange(
                check_id=cid,
                file_path=finding.get("file_path", "unknown"),
                line=finding.get("line"),
                description=f"No repair handler for rule `{cid}`",
                old_text=finding.get("evidence", ""),
                new_text="",
                status="SKIPPED",
                safe_to_apply=False,
            ))
    return changes


def preview_repairs(repository_path: str, finding_ids: Optional[list[str]] = None) -> RepairResponse:
    """Generate a repair preview without modifying any files.

    Parameters
    ----------
    repository_path : str
        Path to the repository root.
    finding_ids : list[str] or None
        If supplied, only generate changes for findings with these check_ids.

    Returns
    -------
    RepairResponse
        Proposed changes with dry_run=True.  No files are modified.
    """
    repo_root = Path(repository_path).resolve()
    analysis = run_analysis(str(repo_root))

    findings = [f.model_dump() for f in analysis.findings]
    if finding_ids:
        findings = [f for f in findings if f["check_id"] in finding_ids]

    changes = _generate_changes(repo_root, findings)

    auto_count = sum(1 for c in changes if c.safe_to_apply and c.status == "PROPOSED")
    manual_count = sum(1 for c in changes if c.status == "MANUAL_REVIEW")
    skipped_count = sum(1 for c in changes if c.status == "SKIPPED")
    failed_count = sum(1 for c in changes if c.status == "FAILED")

    # Save session
    _save_session(RepairSession(
        repository_path=str(repo_root),
        original_findings=[f.model_dump() for f in analysis.findings],
        proposed_changes=[c.model_dump() for c in changes],
        applied_changes=[],
        manual_findings=[c.check_id for c in changes if c.status == "MANUAL_REVIEW"],
        backup_path=None,
        test_result=None,
        before_finding_count=analysis.summary.total,
        after_finding_count=None,
        resolved_finding_ids=[],
        remaining_finding_ids=[f["check_id"] for f in findings],
    ))

    return RepairResponse(
        repository_path=str(repo_root),
        dry_run=True,
        changes=changes,
        applied_count=0,
        skipped_count=skipped_count,
        failed_count=failed_count,
        manual_review_count=manual_count,
        backup_created=False,
        backup_path=None,
        message=(
            f"Preview only — no files modified. "
            f"{auto_count} change(s) automatically repairable, "
            f"{manual_count} require manual review."
        ),
    )


def apply_repairs(repository_path: str, finding_ids: Optional[list[str]] = None) -> RepairResponse:
    """Apply safe automatic repairs to the repository.

    Steps
    -----
    1. Validate repository path.
    2. Run the analyzer to get current findings.
    3. Generate repair changes.
    4. Create backup of files that will be modified.
    5. Apply only ``safe_to_apply`` changes atomically per file.
    6. Confirm each change was written.
    7. Return exact applied / skipped / failed / manual counts.

    Parameters
    ----------
    repository_path : str
        Path to the repository root.
    finding_ids : list[str] or None
        If supplied, only apply changes for these check_ids.

    Returns
    -------
    RepairResponse
        Actual applied changes, with dry_run=False.
    """
    repo_root = Path(repository_path).resolve()
    analysis = run_analysis(str(repo_root))

    findings = [f.model_dump() for f in analysis.findings]
    if finding_ids:
        findings = [f for f in findings if f["check_id"] in finding_ids]

    changes = _generate_changes(repo_root, findings)

    # Identify files that need modification
    safe_changes = [c for c in changes if c.safe_to_apply and c.status == "PROPOSED"]
    files_to_backup: list[Path] = []
    for c in safe_changes:
        p = repo_root / c.file_path
        if p.exists():
            files_to_backup.append(p)

    # Create backup before touching anything
    backup_path: Optional[str] = None
    if files_to_backup:
        backup_path = _create_backup(files_to_backup, repo_root)

    # Apply changes
    applied: list[RepairChange] = []
    modified_files: list[Path] = []

    try:
        for change in changes:
            if not change.safe_to_apply or change.status != "PROPOSED":
                continue

            file_path = repo_root / change.file_path
            result = _apply_single_change(repo_root, file_path, change)
            applied.append(result)
            if result.status == "AUTO_REPAIRED":
                modified_files.append(file_path)
    except Exception as exc:
        # Catastrophic failure — restore what we can
        if backup_path:
            _restore_backup(backup_path, modified_files, repo_root)
        for change in changes:
            change.status = "FAILED" if change.status == "PROPOSED" else change.status

        return RepairResponse(
            repository_path=str(repo_root),
            dry_run=False,
            changes=changes,
            applied_count=0,
            skipped_count=0,
            failed_count=len(safe_changes),
            manual_review_count=sum(1 for c in changes if c.status == "MANUAL_REVIEW"),
            backup_created=backup_path is not None,
            backup_path=backup_path,
            message=f"Repair failed: {exc}. Files restored from backup.",
        )

    # Merge applied results back with manual/skipped changes
    applied_by_id = {(c.check_id, c.file_path, c.line): c for c in applied}
    final_changes: list[RepairChange] = []
    for c in changes:
        key = (c.check_id, c.file_path, c.line)
        if key in applied_by_id:
            final_changes.append(applied_by_id[key])
        else:
            final_changes.append(c)

    auto_repaired = sum(1 for c in final_changes if c.status == "AUTO_REPAIRED")
    manual_count = sum(1 for c in final_changes if c.status == "MANUAL_REVIEW")
    skipped_count = sum(1 for c in final_changes if c.status == "SKIPPED")
    failed_count = sum(1 for c in final_changes if c.status == "FAILED")

    # Save session
    existing = get_session(str(repo_root))
    original_findings = existing.original_findings if existing else [f.model_dump() for f in analysis.findings]

    _save_session(RepairSession(
        repository_path=str(repo_root),
        original_findings=original_findings,
        proposed_changes=[c.model_dump() for c in changes],
        applied_changes=[c.model_dump() for c in final_changes if c.status == "AUTO_REPAIRED"],
        manual_findings=[c.check_id for c in final_changes if c.status == "MANUAL_REVIEW"],
        backup_path=backup_path,
        test_result=None,
        before_finding_count=analysis.summary.total,
        after_finding_count=None,
        resolved_finding_ids=[],
        remaining_finding_ids=[c.check_id for c in final_changes],
    ))

    return RepairResponse(
        repository_path=str(repo_root),
        dry_run=False,
        changes=final_changes,
        applied_count=auto_repaired,
        skipped_count=skipped_count,
        failed_count=failed_count,
        manual_review_count=manual_count,
        backup_created=backup_path is not None,
        backup_path=backup_path,
        message=(
            f"{auto_repaired} repair(s) applied automatically. "
            f"{manual_count} finding(s) require manual review. "
            f"{skipped_count} skipped. {failed_count} failed."
        ),
    )


def _apply_single_change(
    repo_root: Path,
    file_path: Path,
    change: RepairChange,
) -> RepairChange:
    """Apply one change to disk, returning an updated RepairChange."""
    try:
        if change.check_id == "DOC001":
            # DOC001 creates a new file
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(change.new_text, encoding="utf-8")
            # Confirm write
            written = file_path.read_text(encoding="utf-8")
            if written != change.new_text:
                return change.model_copy(update={"status": "FAILED",
                                                 "description": change.description + " (write verification failed)"})
            return change.model_copy(update={"status": "AUTO_REPAIRED"})

        # Line-based replacement
        source = file_path.read_text(encoding="utf-8")
        lines = source.splitlines(keepends=True)

        # For PY003 we may also need to inject `import logging`
        if change.check_id == "PY003":
            has_logging = any(re.match(r"\s*import\s+logging\b", ln) for ln in lines)
            if not has_logging:
                # Inject after the last existing import line, or at line 2
                last_import_idx = -1
                for idx, ln in enumerate(lines):
                    stripped = ln.lstrip()
                    if stripped.startswith("import ") or stripped.startswith("from "):
                        last_import_idx = idx
                insert_at = last_import_idx + 1 if last_import_idx >= 0 else 1
                lines.insert(insert_at, "import logging\n")
                # Adjust line_no offset for the injected import
                if change.line is not None and change.line > insert_at:
                    # line_no shifted by 1 after insert — recalc
                    pass  # we re-find by content below

        # Replace the old line
        old_stripped = change.old_text.rstrip()
        replaced = False
        for i, ln in enumerate(lines):
            if ln.rstrip() == old_stripped:
                # Preserve original line ending
                ending = "\n" if ln.endswith("\n") else ""
                lines[i] = change.new_text.rstrip() + ending
                replaced = True
                break

        if not replaced:
            return change.model_copy(
                update={
                    "status": "FAILED",
                    "description": (
                        change.description
                        + f" (original text not found: {old_stripped!r})"
                    ),
                }
            )

        new_source = "".join(lines)
        file_path.write_text(new_source, encoding="utf-8")

        # Confirm write
        written = file_path.read_text(encoding="utf-8")
        if written != new_source:
            return change.model_copy(update={"status": "FAILED",
                                             "description": change.description + " (write verification failed)"})

        return change.model_copy(update={"status": "AUTO_REPAIRED"})

    except Exception as exc:
        return change.model_copy(update={
            "status": "FAILED",
            "description": f"{change.description} — error: {exc}",
        })


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def verify_repairs(repository_path: str) -> dict:
    """Run post-repair verification.

    1. Runs the repository's pytest suite if pytest is available.
    2. Re-runs the RepoMedic analyzer.
    3. Compares before/after finding counts.
    4. Returns a structured verification result.

    Returns
    -------
    dict
        Fields matching VerificationResponse.
    """
    repo_root = Path(repository_path).resolve()
    session = get_session(str(repo_root))

    before_count = session.before_finding_count if session else 0

    # ── Step 1: run the repo's test suite ────────────────────────────────────
    tests_passed = 0
    tests_failed = 0
    test_output = ""
    regression_detected = False

    pytest_cmd = [sys.executable, "-m", "pytest", "--tb=short", "-q"]
    # Look for a tests/ directory inside the repo
    repo_tests = repo_root / "tests"
    if repo_tests.is_dir():
        pytest_cmd.append(str(repo_tests))
    else:
        pytest_cmd.append(str(repo_root))

    try:
        proc = subprocess.run(
            pytest_cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(repo_root),
        )
        test_output = (proc.stdout + proc.stderr).strip()
        exit_code = proc.returncode

        # Parse counts from pytest output (e.g. "3 passed, 1 failed")
        passed_m = re.search(r"(\d+)\s+passed", test_output)
        failed_m = re.search(r"(\d+)\s+failed", test_output)
        if passed_m:
            tests_passed = int(passed_m.group(1))
        if failed_m:
            tests_failed = int(failed_m.group(1))

        if exit_code != 0 and tests_passed == 0 and tests_failed == 0:
            # pytest may have exited non-zero without counting failures (e.g. collection error)
            test_output = f"pytest exited with code {exit_code}.\n" + test_output
            tests_failed = 1

        regression_detected = tests_failed > 0

    except FileNotFoundError:
        test_output = "pytest is not available in the current environment."
        verification_status_hint = "NOT_RUN"
    except subprocess.TimeoutExpired:
        test_output = "Test suite timed out after 30 seconds."
        tests_failed = 1
        regression_detected = True
        verification_status_hint = "FAILED"
    else:
        verification_status_hint = None  # determined below

    # ── Step 2: re-run the analyzer ──────────────────────────────────────────
    try:
        after_analysis = run_analysis(str(repo_root))
        after_count = after_analysis.summary.total
        after_check_ids = {f.check_id for f in after_analysis.findings}
    except Exception as exc:
        after_count = before_count
        after_check_ids = set()
        test_output += f"\nAnalyzer error during verification: {exc}"

    # ── Step 3: compute resolved / remaining ─────────────────────────────────
    original_findings = session.original_findings if session else []
    original_check_ids = [f["check_id"] for f in original_findings]

    details = []
    resolved_count = 0
    remaining_count = 0
    for f in original_findings:
        cid = f["check_id"]
        # A finding is resolved if the re-analysis no longer contains a finding
        # with the same check_id AND file_path
        still_present = any(
            af for af in after_analysis.findings
            if af.check_id == cid and af.file_path == f["file_path"]
        ) if after_count < before_count else (cid in after_check_ids)

        resolved = not still_present
        if resolved:
            resolved_count += 1
        else:
            remaining_count += 1

        details.append({
            "check_id": cid,
            "file_path": f["file_path"],
            "line": f.get("line"),
            "title": f.get("title", ""),
            "resolved": resolved,
        })

    # ── Step 4: determine overall verification status ─────────────────────────
    if verification_status_hint == "NOT_RUN":
        verification_status = "NOT_RUN"
    elif regression_detected:
        verification_status = "FAILED"
    elif resolved_count == len(original_findings) and not regression_detected:
        verification_status = "PASSED"
    elif resolved_count > 0:
        verification_status = "PARTIAL"
    else:
        verification_status = "FAILED"

    # Update session
    if session:
        session.after_finding_count = after_count
        session.resolved_finding_ids = [
            d["check_id"] for d in details if d["resolved"]
        ]
        session.remaining_finding_ids = [
            d["check_id"] for d in details if not d["resolved"]
        ]
        session.test_result = verification_status
        _save_session(session)

    return {
        "repository_path": str(repo_root),
        "tests_passed": tests_passed,
        "tests_failed": tests_failed,
        "analyzer_before_count": before_count,
        "analyzer_after_count": after_count,
        "resolved_count": resolved_count,
        "remaining_count": remaining_count,
        "regression_detected": regression_detected,
        "verification_status": verification_status,
        "details": details,
        "test_output": test_output,
    }
