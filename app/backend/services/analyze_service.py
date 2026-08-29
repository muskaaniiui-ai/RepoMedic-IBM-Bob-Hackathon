"""Analysis service — thin bridge between the API layer and core.analyzer."""
from pathlib import Path

from core.analyzer import RepositoryAnalyzer
from backend.models.analyze import AnalyzeResponse, AnalysisSummary, FindingOut


def run_analysis(repository_path: str) -> AnalyzeResponse:
    """Run the repository analyzer and return a structured response.

    Parameters
    ----------
    repository_path : str
        Path to the repository root directory.  The caller is responsible for
        validating existence and type before calling this function.

    Returns
    -------
    AnalyzeResponse
        Structured findings and summary.
    """
    analyzer = RepositoryAnalyzer(repository_path)
    findings = analyzer.analyze()

    findings_out = [
        FindingOut(
            check_id=f.check_id,
            severity=f.severity,
            file_path=f.file_path,
            line=f.line,
            title=f.title,
            explanation=f.explanation,
            evidence=f.evidence,
            suggestion=f.suggestion,
        )
        for f in findings
    ]

    summary = AnalysisSummary(
        total=len(findings),
        high=sum(1 for f in findings if f.severity == "HIGH"),
        medium=sum(1 for f in findings if f.severity == "MEDIUM"),
        low=sum(1 for f in findings if f.severity == "LOW"),
    )

    return AnalyzeResponse(
        repository_path=str(Path(repository_path).resolve()),
        summary=summary,
        findings=findings_out,
    )
