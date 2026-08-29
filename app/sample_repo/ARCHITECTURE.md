# Architecture

spectral is structured as a simple transform pipeline:

```
load_signal()
    → normalize()          (optional)
    → window()             (optional)
    → SpectralAnalyzer.compute_fft()
    → SpectralAnalyzer.find_peaks()
    → save_results()
```

## Modules

| Module | Responsibility |
|---|---|
| `spectral/analyzer.py` | FFT computation and peak detection |
| `spectral/pipeline.py` | Composable transform chains |
| `spectral/transforms.py` | normalize, window, resample |
| `spectral/utils.py` | I/O helpers |
