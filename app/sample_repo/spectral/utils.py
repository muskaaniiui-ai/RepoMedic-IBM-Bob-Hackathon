"""utils — I/O and formatting helpers for spectral results."""

import json
from pathlib import Path


def load_signal(path: str) -> list:
    """Load a signal from a JSON file containing a list of floats.

    Parameters
    ----------
    path : str
        Path to a JSON file whose top-level value is a list of numbers.

    Returns
    -------
    list of float
    """
    with open(path) as f:
        data = json.load(f)
    return [float(x) for x in data]


def save_results(results: dict, path: str) -> None:
    """Persist analysis results to a JSON file.

    Parameters
    ----------
    results : dict
        Serialisable results dictionary.
    path : str
        Destination file path. Parent directories must already exist.
    """
    Path(path).write_text(json.dumps(results, indent=2))


def format_summary(results: dict) -> str:
    """Format analysis results as a human-readable summary string.

    INTENTIONAL MAINTAINABILITY ISSUE: this function is defined and exported
    but is never called anywhere in the codebase. It is dead code.

    Parameters
    ----------
    results : dict

    Returns
    -------
    str
    """
    lines = ["=== Spectral Analysis Summary ==="]
    for key, value in results.items():
        lines.append(f"  {key}: {value}")
    return "\n".join(lines)
