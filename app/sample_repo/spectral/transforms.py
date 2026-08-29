"""transforms — signal pre-processing utilities."""

import math


def normalize(signal: list) -> list:
    """Scale signal so that maximum absolute value equals 1.0.

    Parameters
    ----------
    signal : list of float

    Returns
    -------
    list of float
    """
    if not signal:
        return []
    max_val = max(abs(x) for x in signal)
    if max_val == 0.0:
        return list(signal)
    return [x / max_val for x in signal]


def window(signal: list, window_type: str = "hann") -> list:
    """Apply a window function to reduce spectral leakage.

    Parameters
    ----------
    signal : list of float
    window_type : str
        Currently supports 'hann' only.

    Returns
    -------
    list of float
    """
    n = len(signal)
    if n == 0:
        return []
    if window_type == "hann":
        return [
            signal[i] * 0.5 * (1 - math.cos(2 * math.pi * i / (n - 1)))
            for i in range(n)
        ]
    raise ValueError(f"Unknown window type: {window_type}")


def resample(signal: list, factor: int) -> list:
    """Downsample signal by an integer factor (take every nth sample).

    Parameters
    ----------
    signal : list of float
    factor : int
        Downsample factor. Must be a positive integer.

    Returns
    -------
    list of float
    """
    if factor < 1:
        raise ValueError("Resample factor must be >= 1")
    return signal[::factor]
