"""Router for POST /api/repository/upload."""

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.models.repository import RepositoryUploadResponse
from backend.services.repository_service import extract_and_register, MAX_ZIP_SIZE_BYTES

router = APIRouter()

_ALLOWED_CONTENT_TYPES = {
    "application/zip",
    "application/x-zip",
    "application/x-zip-compressed",
    "application/octet-stream",  # some browsers send this for .zip
}


@router.post("/repository/upload", response_model=RepositoryUploadResponse)
async def upload_repository(file: UploadFile = File(...)) -> RepositoryUploadResponse:
    """Accept a user-uploaded ZIP archive and extract it as a Python repository.

    Returns the server-side ``repository_path`` suitable for use with
    ``POST /api/analyze``.

    Raises
    ------
    HTTP 415  Unsupported file type (not a ZIP).
    HTTP 413  Payload too large.
    HTTP 422  Invalid archive — empty, no Python files, path traversal, etc.
    """
    # --- Content-type check ---------------------------------------------------
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=415,
            detail="Only .zip files are accepted. Please upload a ZIP archive of your repository.",
        )

    # --- Read the payload -----------------------------------------------------
    raw: bytes = await file.read()

    if len(raw) == 0:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")

    if len(raw) > MAX_ZIP_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"ZIP file too large: {len(raw) // (1024 * 1024)} MB. "
                f"Maximum allowed size is {MAX_ZIP_SIZE_BYTES // (1024 * 1024)} MB."
            ),
        )

    # --- Delegate to the service ----------------------------------------------
    try:
        return extract_and_register(raw, filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during repository extraction: {exc}",
        ) from exc
