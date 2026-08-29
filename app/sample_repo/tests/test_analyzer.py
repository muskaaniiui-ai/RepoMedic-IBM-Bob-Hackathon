"""Sparse tests for SpectralAnalyzer — intentionally incomplete (test gap)."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from spectral.analyzer import SpectralAnalyzer


def test_compute_fft_returns_correct_length():
    """FFT output should have n//2 frequency bins."""
    analyzer = SpectralAnalyzer(sample_rate=100.0)
    signal = [0.0] * 64
    freqs, mags = analyzer.compute_fft(signal)
    assert len(freqs) == 32
    assert len(mags) == 32


def test_find_peaks_zero_mean_sinusoid():
    """A single-frequency sinusoid with zero mean should have one dominant peak."""
    import math
    n = 64
    # Pure 4 Hz sinusoid, zero mean
    signal = [math.sin(2 * math.pi * 4 * t / n) for t in range(n)]
    analyzer = SpectralAnalyzer(sample_rate=64.0)
    peaks = analyzer.find_peaks(signal, threshold=0.05)
    assert len(peaks) >= 1

    # TEST GAP: no test for non-zero-mean signal
    # A constant-offset signal (non-zero mean) triggers Defect 1.
    # The following test case is MISSING from this file — by design.
