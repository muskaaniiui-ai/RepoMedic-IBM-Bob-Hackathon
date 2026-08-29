# spectral

A small Python library for FFT-based spectral analysis of time-series signals.

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

```python
from spectral import SpectralAnalyzer

analyzer = SpectralAnalyzer(sample_rate=1000.0)
freqs, mags = analyzer.compute_fft(signal)
peaks = analyzer.find_peaks(signal, threshold=25)
```

## API Reference

### `SpectralAnalyzer.find_peaks(signal, threshold=0.1)`

Returns frequency indices where amplitude is a local maximum above `threshold`.

**Parameters:**

- `threshold` — percentage of maximum amplitude (0–100). Peaks below this
  percentage are filtered out.

> **Note:** This documents threshold as a percentage (0-100), but the actual
> implementation treats it as an absolute amplitude value. This is an
> intentional documentation inconsistency for demo purposes.

### `Pipeline.run(signal)`

Runs the signal through all registered transform steps. Returns the
transformed signal.

## Running Tests

```bash
pytest tests/
```
