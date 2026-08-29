"""Router for POST /api/analyze."""
from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.models.analyze import AnalyzeRequest, AnalyzeResponse
from backend.services.analyze_service import run_analysis

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_repository(request: AnalyzeRequest) -> AnalyzeResponse:
    """Run the RepoMedic analyzer against a local repository path.

    Returns a structured list of findings and a severity summary.
    Raises HTTP 422 for paths that do not exist or are not directories.
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

    return run_analysis(request.repository_path)

@router.get("/sample-repository")
async def get_sample_repository():
    """Return the built-in sample repository path."""

    sample_repo = Path(__file__).resolve().parents[2] / "sample_repo"

    if not sample_repo.exists() or not sample_repo.is_dir():
        raise HTTPException(
            status_code=500,
            detail="Built-in sample repository is not available.",
        )

    return {
        "repository_path": str(sample_repo),
        "repository_name": "sample_repo",
    }