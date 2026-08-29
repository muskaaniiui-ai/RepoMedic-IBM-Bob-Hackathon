"""Sparse tests for Pipeline — happy-path only (intentional test gap)."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from spectral.pipeline import Pipeline


def test_pipeline_applies_all_steps():
    """Pipeline should apply every step in order."""
    pipeline = Pipeline(steps=[
        lambda s: [x * 2 for x in s],
        lambda s: [x + 1 for x in s],
    ])
    result = pipeline.run([1.0, 2.0, 3.0])
    assert result == [3.0, 5.0, 7.0]


def test_pipeline_empty_steps_returns_input():
    """An empty pipeline should return the input unchanged."""
    pipeline = Pipeline()
    signal = [1.0, 2.0, 3.0]
    assert pipeline.run(signal) == signal

    # TEST GAP: no test verifying what happens when a step raises.
    # Defect 2 (silent swallow) is entirely untested — by design.
