# Issue Report: find_peaks returns spurious DC component

**Filed by:** fictional_user_42  
**Date:** 2024-01-10  
**Severity:** Medium  

## Description

When I pass a constant signal (e.g. `[5.0] * 64`) to `find_peaks()`, I get a
spurious peak in the output. I expected zero peaks for a DC signal.

## Reproduction

```python
from spectral import SpectralAnalyzer
analyzer = SpectralAnalyzer(sample_rate=64.0)
peaks = analyzer.find_peaks([5.0] * 64, threshold=0.01)
print(peaks)  # Prints [1] — unexpected
```

## Expected behaviour

`find_peaks()` should return `[]` for a constant signal.
