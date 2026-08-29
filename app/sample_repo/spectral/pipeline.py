"""Pipeline — chains transform steps in sequence."""
import logging


class Pipeline:
    """Executes a sequence of transform callables on an input signal.

    Parameters
    ----------
    steps : list of callable
        Each callable accepts a list of floats and returns a list of floats.
    """

    def __init__(self, steps: list = None):
        self.steps = steps or []

    def add_step(self, step) -> None:
        """Append a transform step to the pipeline."""
        self.steps.append(step)

    def run(self, signal: list) -> list:
        """Run the signal through all steps in order.

        INTENTIONAL DEFECT 2: when a step raises an exception, the exception
        is silently swallowed. A warning is printed to stdout (not stderr) and
        execution continues with the pre-failure signal. The caller has no
        programmatic indication that a step failed.

        Parameters
        ----------
        signal : list of float
            Input time-domain samples.

        Returns
        -------
        list of float
            Transformed signal. Indistinguishable from a fully successful run
            even if one or more steps silently failed.
        """
        result = list(signal)
        for step in self.steps:
            try:
                result = step(result)
            except Exception as e:
                # INTENTIONAL DEFECT: bare print to stdout, silent failure
                logging.warning(f"Warning: step {step} failed with {e}, continuing")
        return result
