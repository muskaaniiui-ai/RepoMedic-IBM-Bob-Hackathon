"""Pydantic models for the repair and verification API endpoints."""

from typing import Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Repair request / change models
# ---------------------------------------------------------------------------

class RepairRequest(BaseModel):
    """Request body for POST /api/repair/preview and POST /api/repair/apply."""

    repository_path: str
    finding_ids: Optional[list[str]] = None
    """Optional list of check_id values to target.  If None, all findings are targeted."""
    dry_run: bool = False


class RepairChange(BaseModel):
    """A single proposed or applied file modification."""

    check_id: str
    file_path: str
    line: Optional[int]
    description: str
    old_text: str
    new_text: str
    status: str
    """One of: PROPOSED, AUTO_REPAIRED, MANUAL_REVIEW, SKIPPED, FAILED."""
    safe_to_apply: bool


class RepairResponse(BaseModel):
    """Response body for POST /api/repair/preview and POST /api/repair/apply."""

    repository_path: str
    dry_run: bool
    changes: list[RepairChange]
    applied_count: int
    skipped_count: int
    failed_count: int
    manual_review_count: int
    backup_created: bool
    backup_path: Optional[str]
    message: str


# ---------------------------------------------------------------------------
# Verification models
# ---------------------------------------------------------------------------

class VerificationFindingDetail(BaseModel):
    """Per-finding verification result."""

    check_id: str
    file_path: str
    line: Optional[int]
    title: str
    resolved: bool


class VerificationResponse(BaseModel):
    """Response body for POST /api/repair/verify."""

    repository_path: str
    tests_passed: int
    tests_failed: int
    analyzer_before_count: int
    analyzer_after_count: int
    resolved_count: int
    remaining_count: int
    regression_detected: bool
    verification_status: str
    """One of: PASSED, FAILED, PARTIAL, NOT_RUN."""
    details: list[VerificationFindingDetail]
    test_output: str


# ---------------------------------------------------------------------------
# Repair-session state (stored in memory for the current server session)
# ---------------------------------------------------------------------------

class RepairSession(BaseModel):
    """In-memory record of a repair session — one per repository path."""

    repository_path: str
    original_findings: list[dict]
    proposed_changes: list[dict]
    applied_changes: list[dict]
    manual_findings: list[str]
    backup_path: Optional[str]
    test_result: Optional[str]
    before_finding_count: int
    after_finding_count: Optional[int]
    resolved_finding_ids: list[str]
    remaining_finding_ids: list[str]
