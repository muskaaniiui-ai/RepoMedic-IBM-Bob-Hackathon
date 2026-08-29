"""Finding — structured result type returned by all analyzer checks."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Finding:
    """A single analysable problem found in a repository.

    Attributes
    ----------
    check_id : str
        Unique identifier for the rule that raised this finding
        (e.g. ``"PY001"``).
    severity : str
        One of ``"LOW"``, ``"MEDIUM"``, or ``"HIGH"``.
    file_path : str
        Repository-relative path to the file containing the problem.
    line : Optional[int]
        1-based line number where the problem occurs, or None if not applicable.
    title : str
        Short one-line description of the problem.
    explanation : str
        Detailed explanation of why this is a problem.
    evidence : str
        Exact code snippet or fact that triggered this finding.
    suggestion : str
        Concrete recommended fix.
    """

    check_id: str
    severity: str
    file_path: str
    line: Optional[int]
    title: str
    explanation: str
    evidence: str
    suggestion: str

    # Optional extra context for richer output
    extra: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        """Serialise to a plain dictionary for JSON output."""
        return {
            "check_id": self.check_id,
            "severity": self.severity,
            "file_path": self.file_path,
            "line": self.line,
            "title": self.title,
            "explanation": self.explanation,
            "evidence": self.evidence,
            "suggestion": self.suggestion,
            "extra": self.extra,
        }
