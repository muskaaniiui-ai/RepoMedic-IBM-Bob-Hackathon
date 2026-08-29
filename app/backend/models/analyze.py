"""Pydantic models for POST /api/analyze."""
from typing import Optional
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    """Request body for POST /api/analyze."""

    repository_path: str


class FindingOut(BaseModel):
    """Serialised representation of a single analyzer Finding."""

    check_id: str
    severity: str
    file_path: str
    line: Optional[int]
    title: str
    explanation: str
    evidence: str
    suggestion: str


class AnalysisSummary(BaseModel):
    """Aggregate counts across all findings."""

    total: int
    high: int
    medium: int
    low: int


class AnalyzeResponse(BaseModel):
    """Response body for POST /api/analyze."""

    repository_path: str
    summary: AnalysisSummary
    findings: list[FindingOut]
