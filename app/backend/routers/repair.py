"""Router for the repair and verification endpoints."""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.models.repair import RepairRequest, RepairResponse, VerificationResponse, VerificationFindingDetail
from backend.services.repair_service import (
    preview_repairs,
    apply_repairs,
    verify_repairs,
    get_session,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /api/repair/preview
# ---------------------------------------------------------------------------

@router.post("/repair/preview", response_model=RepairResponse)
async def repair_preview(request: RepairRequest) -> RepairResponse:
    """Generate a preview of proposed repairs without modifying any files.

    Returns proposed changes, affected files, old/new text, and
    automatic vs. manual-review counts.  The repository is not modified.
    """
    repo = Path(request.repository_path)
    if not repo.exists():
        raise HTTPException(
            status_code=422,
            detail=f"Repository path does not exist: {request.repository_path}",
        )
    if not repo.is_dir():
        raise HTTPException(
            status_code=422,
            detail=f"Repository path is not a directory: {request.repository_path}",
        )

    try:
        return preview_repairs(request.repository_path, request.finding_ids)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /api/repair/apply
# ---------------------------------------------------------------------------

@router.post("/repair/apply", response_model=RepairResponse)
async def repair_apply(request: RepairRequest) -> RepairResponse:
    """Apply safe automatic repairs to the repository.

    Only findings with a known automatic repair handler are modified.
    Manual-review findings are reported but not changed.
    A backup is created before any modification.
    """
    repo = Path(request.repository_path)
    if not repo.exists():
        raise HTTPException(
            status_code=422,
            detail=f"Repository path does not exist: {request.repository_path}",
        )
    if not repo.is_dir():
        raise HTTPException(
            status_code=422,
            detail=f"Repository path is not a directory: {request.repository_path}",
        )

    try:
        return apply_repairs(request.repository_path, request.finding_ids)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /api/repair/verify
# ---------------------------------------------------------------------------

@router.post("/repair/verify", response_model=VerificationResponse)
async def repair_verify(request: RepairRequest) -> VerificationResponse:
    """Run post-repair verification.

    Executes the repository's pytest suite (if available), re-runs the
    RepoMedic analyzer, compares before/after findings, and returns a
    structured verification result.  Never fabricates test results.
    """
    repo = Path(request.repository_path)
    if not repo.exists():
        raise HTTPException(
            status_code=422,
            detail=f"Repository path does not exist: {request.repository_path}",
        )
    if not repo.is_dir():
        raise HTTPException(
            status_code=422,
            detail=f"Repository path is not a directory: {request.repository_path}",
        )

    try:
        result = verify_repairs(request.repository_path)
        return VerificationResponse(
            repository_path=result["repository_path"],
            tests_passed=result["tests_passed"],
            tests_failed=result["tests_failed"],
            analyzer_before_count=result["analyzer_before_count"],
            analyzer_after_count=result["analyzer_after_count"],
            resolved_count=result["resolved_count"],
            remaining_count=result["remaining_count"],
            regression_detected=result["regression_detected"],
            verification_status=result["verification_status"],
            details=[VerificationFindingDetail(**d) for d in result["details"]],
            test_output=result["test_output"],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
