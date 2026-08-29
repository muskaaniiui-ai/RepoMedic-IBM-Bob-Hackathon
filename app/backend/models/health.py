"""Health check Pydantic models for the RepoMedic API."""
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response schema for GET /api/health."""

    status: str
    service: str
    version: str
