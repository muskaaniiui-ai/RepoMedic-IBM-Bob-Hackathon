"""spectral — FFT-based spectral analysis for time-series signals."""

from spectral.analyzer import SpectralAnalyzer
from spectral.pipeline import Pipeline
from spectral.transforms import normalize, window, resample
from spectral.utils import load_signal, save_results, format_summary

__all__ = [
    "SpectralAnalyzer",
    "Pipeline",
    "normalize",
    "window",
    "resample",
    "load_signal",
    "save_results",
    "format_summary",
]
