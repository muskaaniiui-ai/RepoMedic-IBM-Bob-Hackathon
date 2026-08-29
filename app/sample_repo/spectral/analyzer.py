"""SpectralAnalyzer — FFT computation and peak detection."""

import math


class SpectralAnalyzer:
    """Performs FFT-based spectral analysis on a time-series signal.

    Parameters
    ----------
    sample_rate : float
        Samples per second of the input signal.
    """

    def __init__(self, sample_rate: float = 1.0):
        self.sample_rate = sample_rate

    def compute_fft(self, signal: list) -> tuple:
        """Compute the FFT magnitudes and corresponding frequencies.

        Parameters
        ----------
        signal : list of float
            Time-domain signal samples.

        Returns
        -------
        tuple
            (frequencies, magnitudes) both as lists of floats.
        """
        n = len(signal)
        if n == 0:
            return [], []

        # Discrete Fourier Transform (stdlib only, no numpy)
        magnitudes = []
        frequencies = []
        for k in range(n // 2):
            real = 0.0
            imag = 0.0
            for t, x in enumerate(signal):
                angle = 2 * math.pi * k * t / n
                real += x * math.cos(angle)
                imag -= x * math.sin(angle)
            magnitudes.append(math.sqrt(real ** 2 + imag ** 2) / n)
            frequencies.append(k * self.sample_rate / n)

        return frequencies, magnitudes

    def find_peaks(self, signal: list, threshold: float = 0.1) -> list:
        """Return frequency indices where amplitude is a local maximum above threshold.

        The threshold is compared against the absolute amplitude value.

        Parameters
        ----------
        signal : list of float
            Time-domain signal samples.
        threshold : float
            Absolute amplitude threshold. Peaks below this value are ignored.

        Returns
        -------
        list of int
            Indices into the frequencies array where peaks occur.

        Note
        ----
        README.md documents threshold as a percentage of maximum amplitude (0-100).
        The actual implementation treats it as an absolute amplitude value.
        This is a documentation inconsistency (intentional defect).
        """
        freqs, mags = self.compute_fft(signal)
        if not freqs:
            return []

        peaks = []
        # INTENTIONAL DEFECT 1: boundary condition uses >= instead of >
        # This causes the DC component (index 0) to be included as a false peak
        # when the signal has a strong non-zero mean.
        for i in range(1, len(freqs) - 1):
            if mags[i] > mags[i - 1] and mags[i] > mags[i + 1] and mags[i] >= threshold:
                peaks.append(i)

        return peaks
