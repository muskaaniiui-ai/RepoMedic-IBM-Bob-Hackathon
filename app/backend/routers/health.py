"""Health check router for GET /api/health."""
from fastapi import APIRouter

from backend.models.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Return a simple health-check payload indicating the backend is running."""
    return HealthResponse(
        status="ok",
        service="repomedic-backend",
        version="0.1.0",
    )
