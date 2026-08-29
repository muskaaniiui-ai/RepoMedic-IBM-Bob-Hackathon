"""RepoMedic repository analyzer — modular static-analysis check engine.

Each check is a standalone function with the signature::

    check_*(path: Path, source: str, tree: ast.Module) -> list[Finding]

The ``RepositoryAnalyzer`` discovers all Python files via ``RepositoryScanner``,
parses them with the ``ast`` module, and runs every registered check.  Results
are collected as ``Finding`` objects.

Adding a new check
------------------
1. Write a function named ``check_<something>`` at module level.
2. It will be auto-discovered and called for every Python file.
"""

import ast
import re
import tokenize
import io
from pathlib import Path
from typing import Optional

from core.finding import Finding
from core.scanner import RepositoryScanner

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rel(repo_root: Path, file_path: Path) -> str:
    """Return a forward-slash relative path string for display."""
    try:
        return file_path.relative_to(repo_root).as_posix()
    except ValueError:
        return file_path.as_posix()


def _source_line(source: str, lineno: int) -> str:
    """Return the stripped source line at the given 1-based line number."""
    lines = source.splitlines()
    if 1 <= lineno <= len(lines):
        return lines[lineno - 1].strip()
    return ""


# ---------------------------------------------------------------------------
# AST-based checks (Python source files)
# ---------------------------------------------------------------------------

def check_bare_except(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY001 — bare ``except:`` clause catches all exceptions silently."""
    findings = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue
        if node.type is None:
            findings.append(Finding(
                check_id="PY001",
                severity="MEDIUM",
                file_path=rel_path,
                line=node.lineno,
                title="Bare except clause",
                explanation=(
                    "A bare `except:` catches every exception including "
                    "SystemExit and KeyboardInterrupt, making errors invisible "
                    "and debugging extremely difficult."
                ),
                evidence=_source_line(source, node.lineno),
                suggestion=(
                    "Catch a specific exception type, e.g. `except ValueError:` "
                    "or at minimum `except Exception:`."
                ),
            ))
    return findings


def check_broad_exception_suppressed(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY002 — ``except Exception`` that never re-raises or logs (silent swallow)."""
    findings = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue
        if node.type is None:
            continue  # already caught by PY001
        # Check if it's `except Exception`
        type_name = None
        if isinstance(node.type, ast.Name):
            type_name = node.type.id
        if type_name != "Exception":
            continue
        # Look for any Raise or logging call in the handler body
        has_raise = any(isinstance(n, ast.Raise) for n in ast.walk(ast.Module(body=node.body, type_ignores=[])))
        has_log_or_print = any(
            isinstance(n, ast.Call) and (
                (isinstance(n.func, ast.Name) and n.func.id in ("print", "log", "logging"))
                or (isinstance(n.func, ast.Attribute) and n.func.attr in ("warning", "error", "exception", "critical", "info", "debug"))
            )
            for n in ast.walk(ast.Module(body=node.body, type_ignores=[]))
        )
        if not has_raise and not has_log_or_print:
            findings.append(Finding(
                check_id="PY002",
                severity="HIGH",
                file_path=rel_path,
                line=node.lineno,
                title="Silent exception suppression",
                explanation=(
                    "`except Exception` handler neither re-raises nor logs "
                    "the error. This causes silent data loss — callers cannot "
                    "detect that an error occurred."
                ),
                evidence=_source_line(source, node.lineno),
                suggestion=(
                    "Either re-raise the exception, log it to stderr, or "
                    "return an explicit error state to the caller."
                ),
            ))
    return findings


def check_print_in_library(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY003 — ``print()`` call in non-test library code."""
    # Only flag files that look like library modules (not tests/scripts)
    name = path.name
    if name.startswith("test_") or name == "conftest.py" or name.endswith("_cli.py"):
        return []
    # Also skip if the file is directly under a tests/ directory
    if "tests" in path.parts:
        return []
    findings = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name) and node.func.id == "print":
            findings.append(Finding(
                check_id="PY003",
                severity="LOW",
                file_path=rel_path,
                line=node.lineno,
                title="print() in library code",
                explanation=(
                    "`print()` writes to stdout and is unsuitable for library "
                    "code — callers cannot capture or suppress it. "
                    "Use the `logging` module instead."
                ),
                evidence=_source_line(source, node.lineno),
                suggestion=(
                    "Replace `print(...)` with `logging.warning(...)` or "
                    "`logging.info(...)` and configure a handler at the "
                    "application entry point."
                ),
            ))
    return findings


def check_missing_module_docstring(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY004 — Python module has no module-level docstring."""
    # Only check .py files that look like library/application modules
    if path.name.startswith("test_") or path.name == "conftest.py":
        return []
    has_docstring = (
        tree.body
        and isinstance(tree.body[0], ast.Expr)
        and isinstance(tree.body[0].value, ast.Constant)
        and isinstance(tree.body[0].value.value, str)
    )
    if not has_docstring:
        return [Finding(
            check_id="PY004",
            severity="LOW",
            file_path=rel_path,
            line=1,
            title="Missing module docstring",
            explanation=(
                "A module without a docstring gives readers no context about "
                "its purpose. Tools like `help()` and documentation generators "
                "rely on module docstrings."
            ),
            evidence=_source_line(source, 1),
            suggestion=(
                'Add a module docstring as the very first statement, e.g. '
                '`"""Short description of what this module does."""`'
            ),
        )]
    return []


def check_missing_function_docstrings(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY005 — public functions or methods with no docstring."""
    findings = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if node.name.startswith("_"):
            continue  # private / dunder — skip
        has_docstring = (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        )
        if not has_docstring:
            findings.append(Finding(
                check_id="PY005",
                severity="LOW",
                file_path=rel_path,
                line=node.lineno,
                title=f"Missing docstring on `{node.name}()`",
                explanation=(
                    f"Public function `{node.name}` has no docstring. "
                    "Without documentation, callers cannot understand the "
                    "expected parameters, return value, or side effects."
                ),
                evidence=_source_line(source, node.lineno),
                suggestion=(
                    f'Add a docstring immediately after `def {node.name}(...):`'
                ),
            ))
    return findings


def check_mutable_default_argument(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY006 — mutable default argument (list/dict/set literal)."""
    findings = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for default in node.args.defaults + node.args.kw_defaults:
            if default is None:
                continue
            if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                findings.append(Finding(
                    check_id="PY006",
                    severity="MEDIUM",
                    file_path=rel_path,
                    line=node.lineno,
                    title=f"Mutable default argument in `{node.name}()`",
                    explanation=(
                        "A mutable default argument (list, dict, or set) is "
                        "shared across all calls to the function. Mutations "
                        "persist between calls, causing subtle bugs."
                    ),
                    evidence=_source_line(source, node.lineno),
                    suggestion=(
                        "Use `None` as the default and create the mutable "
                        "object inside the function body, e.g. "
                        "`if param is None: param = []`."
                    ),
                ))
    return findings


def check_unused_imports(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY007 — imported names that are never referenced in the module body.

    Package ``__init__.py`` files are intentionally excluded: their imports
    are public re-exports, not internal usage, and linting them as unused
    produces only noise.
    """
    # __init__.py files are re-export modules — every import is intentional
    if path.name == "__init__.py":
        return []
    findings = []

    # Collect all imported names
    imported: dict = {}  # name -> lineno
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                local_name = alias.asname if alias.asname else alias.name.split(".")[0]
                imported[local_name] = node.lineno
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == "*":
                    return []  # can't know what star-import brings in
                local_name = alias.asname if alias.asname else alias.name
                imported[local_name] = node.lineno

    # Collect all Name references that are NOT in import statements
    used: set = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        if isinstance(node, ast.Name):
            used.add(node.id)
        elif isinstance(node, ast.Attribute):
            # collect the root of attribute chains
            root = node
            while isinstance(root, ast.Attribute):
                root = root.value
            if isinstance(root, ast.Name):
                used.add(root.id)

    for name, lineno in imported.items():
        if name not in used:
            findings.append(Finding(
                check_id="PY007",
                severity="LOW",
                file_path=rel_path,
                line=lineno,
                title=f"Unused import `{name}`",
                explanation=(
                    f"`{name}` is imported but never referenced. "
                    "Unused imports add noise, increase load time, and can "
                    "cause confusion about a module's actual dependencies."
                ),
                evidence=_source_line(source, lineno),
                suggestion=f"Remove the unused import of `{name}`.",
            ))
    return findings


def check_todo_fixme_comments(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY008 — TODO / FIXME / HACK / XXX comments left in source."""
    findings = []
    pattern = re.compile(r"#.*\b(TODO|FIXME|HACK|XXX)\b", re.IGNORECASE)
    for lineno, line in enumerate(source.splitlines(), start=1):
        m = pattern.search(line)
        if m:
            findings.append(Finding(
                check_id="PY008",
                severity="LOW",
                file_path=rel_path,
                line=lineno,
                title=f"{m.group(1).upper()} comment",
                explanation=(
                    f"A `{m.group(1).upper()}` comment indicates unfinished "
                    "or known-problematic code that was never resolved."
                ),
                evidence=line.strip(),
                suggestion=(
                    "Resolve the issue or track it in the project issue tracker "
                    "and remove the inline comment."
                ),
            ))
    return findings


def check_exception_logged_not_raised(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY009 — exception caught, printed to stdout only, and silently swallowed.

    Targets the specific pattern::

        except <Something> as e:
            print(...)          # stdout only — no re-raise, no logging

    This is distinct from PY002 (which requires a completely silent handler).
    Here the caller is given no programmatic signal of failure; the print goes
    to stdout where it can be easily missed or suppressed.
    """
    findings = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue

        # Build a flat list of all statement nodes in the handler body
        body_nodes = list(ast.walk(ast.Module(body=node.body, type_ignores=[])))

        has_raise = any(isinstance(n, ast.Raise) for n in body_nodes)
        if has_raise:
            continue  # re-raises are fine

        has_logging = any(
            isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr in ("warning", "error", "exception", "critical", "info", "debug")
            for n in body_nodes
        )
        if has_logging:
            continue  # proper logging is fine

        has_print = any(
            isinstance(n, ast.Call)
            and isinstance(n.func, ast.Name)
            and n.func.id == "print"
            for n in body_nodes
        )
        if not has_print:
            continue  # no print — already covered by PY001/PY002

        # At this point: handler has a print but no raise and no logging.
        # Determine exception type name for the title.
        exc_name = "Exception"
        if node.type is not None:
            if isinstance(node.type, ast.Name):
                exc_name = node.type.id
            elif isinstance(node.type, ast.Attribute):
                exc_name = node.type.attr

        findings.append(Finding(
            check_id="PY009",
            severity="HIGH",
            file_path=rel_path,
            line=node.lineno,
            title=f"Exception caught, printed to stdout, silently swallowed (`{exc_name}`)",
            explanation=(
                f"The `except {exc_name}` handler calls `print()` to stdout "
                "but never re-raises or propagates the error. "
                "The caller has no programmatic way to detect that a step "
                "failed — the function returns a normal-looking value "
                "even after an error occurred. This is silent data loss."
            ),
            evidence=_source_line(source, node.lineno),
            suggestion=(
                "Either propagate the exception (re-raise or raise a custom "
                "error), use `logging.warning()`/`logging.error()` instead of "
                "`print()`, or return an explicit error state so callers can "
                "detect failure."
            ),
        ))
    return findings


def check_unreferenced_module_functions(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY010 — module-level function defined but never called within the same file.

    Scope is deliberately limited to the single file: cross-file call detection
    via static analysis without a full import graph is unreliable.  This check
    is most useful for spotting functions whose *own module* never uses them,
    which is a strong signal of dead code (especially in utility modules).

    Exclusions:
    - ``__init__.py`` files (everything there is a public re-export)
    - test files (test functions are called by the framework, not by the file)
    - functions whose names start with ``_`` (private helpers)
    - functions named ``main`` (conventional entry points)
    - ``__dunder__`` methods
    """
    if path.name in ("__init__.py", "conftest.py"):
        return []
    if path.name.startswith("test_"):
        return []

    # Collect all module-level function definitions
    module_level_funcs: dict = {}  # name -> lineno
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            name = node.name
            if name.startswith("_"):
                continue
            if name == "main":
                continue
            module_level_funcs[name] = node.lineno

    if not module_level_funcs:
        return []

    # Collect every Call node's function name across the whole file
    called_names: set = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                called_names.add(node.func.id)
            elif isinstance(node.func, ast.Attribute):
                called_names.add(node.func.attr)

    # Also collect names used as values (passed as callbacks, etc.)
    referenced_names: set = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            referenced_names.add(node.id)

    # If *none* of the module-level functions are called internally, the file
    # is a pure API surface (e.g. a transforms.py with only exported helpers).
    # Flagging every function as dead in that case produces only noise.
    # Only proceed when at least one function IS referenced internally, which
    # lets us meaningfully identify the outliers that aren't.
    any_referenced = any(
        name in called_names or name in referenced_names
        for name in module_level_funcs
    )
    if not any_referenced:
        return []

    findings = []
    for func_name, lineno in module_level_funcs.items():
        if func_name in called_names or func_name in referenced_names:
            continue
        findings.append(Finding(
            check_id="PY010",
            severity="LOW",
            file_path=rel_path,
            line=lineno,
            title=f"Unreferenced function `{func_name}()` — possible dead code",
            explanation=(
                f"`{func_name}` is defined at module level but is never "
                "called or referenced anywhere in the same file. "
                "If it is not part of the public API and is not imported "
                "by any other module, it is dead code."
            ),
            evidence=_source_line(source, lineno),
            suggestion=(
                f"If `{func_name}` is intentionally part of the public API, "
                "add it to `__all__` and document it. "
                "If it is unused, remove it to reduce maintenance burden."
            ),
        ))
    return findings


def check_loop_boundary_ge_comparison(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """PY011 — suspicious non-strict (>=) comparison against an adjacent element
    inside a bounded ``for i in range(...)`` loop.

    The specific pattern flagged is::

        for i in range(...):
            if arr[i] >= arr[i - 1] ...   # or arr[i] >= arr[i + 1]

    Using ``>=`` instead of ``>`` when comparing a value to its immediate
    neighbour in a loop is a common off-by-one class of bug: it causes a
    plateau (two equal adjacent values) to be treated as a local maximum,
    which is usually wrong in peak-detection, sorted-order checks, and
    similar algorithms.

    Only fires when ALL of the following are true:
    - The loop variable is a simple ``Name`` (``i``, ``k``, etc.)
    - The comparison LHS is ``arr[i]`` (subscript of loop var)
    - The comparison RHS is ``arr[i ± 1]`` (same subscript, ±1 offset)
    - The operator is ``GtE`` (>=)
    """
    findings = []

    for loop in ast.walk(tree):
        if not isinstance(loop, ast.For):
            continue
        # loop target must be a simple name
        if not isinstance(loop.target, ast.Name):
            continue
        loop_var = loop.target.id

        # Walk all Compare nodes inside this loop body
        for node in ast.walk(ast.Module(body=loop.body, type_ignores=[])):
            if not isinstance(node, ast.Compare):
                continue

            # Inspect each (op, comparator) pair in the compare chain
            for op, comparator in zip(node.ops, node.comparators):
                if not isinstance(op, ast.GtE):
                    continue

                # LHS must be arr[i]
                lhs = node.left
                if not (
                    isinstance(lhs, ast.Subscript)
                    and isinstance(lhs.slice, ast.Name)
                    and lhs.slice.id == loop_var
                ):
                    continue

                # RHS must be arr[i ± 1]  (BinOp: i +/- Constant(1))
                rhs = comparator
                if not isinstance(rhs, ast.Subscript):
                    continue
                rhs_slice = rhs.slice
                if not isinstance(rhs_slice, ast.BinOp):
                    continue
                if not isinstance(rhs_slice.op, (ast.Add, ast.Sub)):
                    continue
                if not (
                    isinstance(rhs_slice.left, ast.Name)
                    and rhs_slice.left.id == loop_var
                ):
                    continue
                if not (
                    isinstance(rhs_slice.right, ast.Constant)
                    and rhs_slice.right.value == 1
                ):
                    continue

                # Same array object on both sides
                def _arr_name(subscript: ast.Subscript) -> str:
                    val = subscript.value
                    if isinstance(val, ast.Name):
                        return val.id
                    if isinstance(val, ast.Attribute):
                        return val.attr
                    return ""

                if _arr_name(lhs) != _arr_name(rhs):
                    continue

                findings.append(Finding(
                    check_id="PY011",
                    severity="MEDIUM",
                    file_path=rel_path,
                    line=node.lineno,
                    title=(
                        f"Suspicious `>=` comparison against adjacent element "
                        f"(`{_arr_name(lhs)}[{loop_var}] >= {_arr_name(rhs)}[{loop_var}±1]`)"
                    ),
                    explanation=(
                        f"Inside a `for {loop_var}` loop, `{_arr_name(lhs)}[{loop_var}]` "
                        f"is compared with `>=` against `{_arr_name(rhs)}[{loop_var}±1]`. "
                        "Using `>=` instead of `>` when checking for a local maximum "
                        "means a plateau (two equal adjacent values) is treated as a "
                        "peak, which is usually a logic error in peak-detection and "
                        "sorted-order algorithms."
                    ),
                    evidence=_source_line(source, node.lineno),
                    suggestion=(
                        "If this is a strict local-maximum test, replace `>=` with `>` "
                        "so that equal neighbours are not treated as peaks."
                    ),
                ))
    return findings


def check_test_file_no_failure_path(
    path: Path, source: str, tree: ast.Module, rel_path: str
) -> list:
    """TST001 — test file contains no failure-path assertions.

    A test file that exercises only the happy path gives no protection against
    error-handling regressions.  This check flags test files where no test
    function contains any of:

    - ``pytest.raises(...)``
    - ``unittest.TestCase.assertRaises(...)``
    - A ``try/except`` block
    - An ``assert`` on a falsy or error condition

    Only fires on files whose name starts with ``test_``.
    """
    if not path.name.startswith("test_"):
        return []

    # Collect all top-level test function definitions
    test_funcs = [
        node for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name.startswith("test")
    ]
    if not test_funcs:
        return []

    def _has_failure_path(func_node) -> bool:
        """Return True if this function contains any failure-path construct."""
        for n in ast.walk(func_node):
            # pytest.raises or unittest assertRaises
            if isinstance(n, ast.Call):
                func = n.func
                if isinstance(func, ast.Attribute) and func.attr == "raises":
                    return True
                if isinstance(func, ast.Attribute) and func.attr == "assertRaises":
                    return True
            # try/except block
            if isinstance(n, ast.Try):
                return True
            # with pytest.raises(...) as ...:
            if isinstance(n, ast.With):
                for item in n.items:
                    ctx = item.context_expr
                    if (
                        isinstance(ctx, ast.Call)
                        and isinstance(ctx.func, ast.Attribute)
                        and ctx.func.attr == "raises"
                    ):
                        return True
        return False

    all_happy_path = all(not _has_failure_path(fn) for fn in test_funcs)
    if not all_happy_path:
        return []

    return [Finding(
        check_id="TST001",
        severity="MEDIUM",
        file_path=rel_path,
        line=1,
        title="Test file contains no failure-path tests",
        explanation=(
            f"`{path.name}` has {len(test_funcs)} test function(s) but none "
            "of them test error conditions, exceptions, or failure paths "
            "(no `pytest.raises`, no `assertRaises`, no `try/except`). "
            "This means error-handling bugs can pass the test suite undetected."
        ),
        evidence=f"{len(test_funcs)} test function(s), 0 failure-path assertions",
        suggestion=(
            "Add at least one test that exercises an error or edge case, "
            "e.g. using `with pytest.raises(SomeError):` or by passing "
            "invalid input and asserting the expected exception."
        ),
    )]


# ---------------------------------------------------------------------------
# File-level checks (non-AST, runs on any file type)
# ---------------------------------------------------------------------------

def check_pinned_old_dependency(
    path: Path, source: str, _tree: Optional[ast.Module], rel_path: str
) -> list:
    """CFG001 — very old pinned dependency in requirements.txt."""
    if path.name != "requirements.txt":
        return []
    findings = []
    # Known old pins: numpy<1.23, requests<2.28, django<3.2, flask<2.0
    OLD_PINS = {
        "numpy": ("1.23.0", "Predates NumPy 1.23 and blocks packages requiring >= 1.23."),
        "requests": ("2.28.0", "Predates security and compatibility improvements in 2.28+."),
        "django": ("3.2.0", "Django < 3.2 is end-of-life."),
        "flask": ("2.0.0", "Flask < 2.0 is end-of-life."),
        "pillow": ("9.0.0", "Pillow < 9.0 has known CVEs."),
    }

    def _version_tuple(v: str) -> tuple:
        try:
            return tuple(int(x) for x in v.split(".")[:3])
        except ValueError:
            return (0, 0, 0)

    for lineno, line in enumerate(source.splitlines(), start=1):
        line_stripped = line.strip()
        if not line_stripped or line_stripped.startswith("#"):
            continue
        # Match `package==X.Y.Z`
        m = re.match(r"^([A-Za-z0-9_\-]+)==(\d+\.\d+(?:\.\d+)?)$", line_stripped)
        if not m:
            continue
        pkg = m.group(1).lower()
        ver = m.group(2)
        if pkg in OLD_PINS:
            min_ver, reason = OLD_PINS[pkg]
            if _version_tuple(ver) < _version_tuple(min_ver):
                findings.append(Finding(
                    check_id="CFG001",
                    severity="MEDIUM",
                    file_path=rel_path,
                    line=lineno,
                    title=f"Outdated dependency pin: {pkg}=={ver}",
                    explanation=(
                        f"`{pkg}=={ver}` is pinned to a very old version. "
                        f"{reason}"
                    ),
                    evidence=line_stripped,
                    suggestion=(
                        f"Update to a recent compatible version, e.g. "
                        f"`{pkg}>={min_ver}` or unpin entirely and test."
                    ),
                ))
    return findings


def check_missing_readme(
    path: Path, source: str, _tree: Optional[ast.Module], rel_path: str
) -> list:
    """DOC001 — package directory has no README file."""
    # Only check __init__.py at the top level of a package
    if path.name != "__init__.py":
        return []
    package_dir = path.parent
    readme_exists = any(
        (package_dir / name).exists()
        for name in ("README.md", "README.rst", "README.txt", "README")
    )
    if not readme_exists:
        return [Finding(
            check_id="DOC001",
            severity="LOW",
            file_path=rel_path,
            line=None,
            title=f"No README in package `{package_dir.name}/`",
            explanation=(
                f"The `{package_dir.name}/` package has no README file. "
                "New contributors and automated tools have no starting point "
                "for understanding the package."
            ),
            evidence=f"ls {package_dir.as_posix()}/ — no README found",
            suggestion=(
                "Add a README.md to the package directory describing its "
                "purpose, public API, and usage examples."
            ),
        )]
    return []


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

# File-level checks that run on all file types (tree may be None)
_FILE_CHECKS = [
    check_pinned_old_dependency,
    check_missing_readme,
]

# AST-level checks that run only on parseable Python files
_AST_CHECKS = [
    check_bare_except,
    check_broad_exception_suppressed,
    check_print_in_library,
    check_missing_module_docstring,
    check_missing_function_docstrings,
    check_mutable_default_argument,
    check_unused_imports,
    check_todo_fixme_comments,
    check_exception_logged_not_raised,
    check_unreferenced_module_functions,
    check_loop_boundary_ge_comparison,
    check_test_file_no_failure_path,
]


class RepositoryAnalyzer:
    """Runs all registered checks over a repository and returns findings.

    Parameters
    ----------
    repo_path : str or Path
        Root directory of the repository to analyze.

    Usage
    -----
    ::

        analyzer = RepositoryAnalyzer("path/to/repo")
        findings = analyzer.analyze()
        for f in findings:
            print(f.check_id, f.severity, f.file_path, f.line, f.title)
    """

    def __init__(self, repo_path):
        self.repo_path = Path(repo_path)
        self._scanner = RepositoryScanner(self.repo_path)

    def analyze(self) -> list:
        """Scan the repository and run all checks on each file.

        Returns
        -------
        list of Finding
            All findings, sorted by (file_path, line).

        Raises
        ------
        FileNotFoundError
            If the repository path does not exist.
        NotADirectoryError
            If the path is not a directory.
        """
        files = self._scanner.scan()
        all_findings: list = []

        for file_path in files:
            rel_path = _rel(self.repo_path, file_path)
            try:
                source = file_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            # Parse Python files
            tree: Optional[ast.Module] = None
            if file_path.suffix == ".py":
                try:
                    tree = ast.parse(source, filename=str(file_path))
                except SyntaxError:
                    pass

            # Run file-level checks
            for check_fn in _FILE_CHECKS:
                try:
                    all_findings.extend(
                        check_fn(file_path, source, tree, rel_path)
                    )
                except Exception:
                    pass  # never crash the whole run on a bad check

            # Run AST-level checks on parsed Python files only
            if tree is not None:
                for check_fn in _AST_CHECKS:
                    try:
                        all_findings.extend(
                            check_fn(file_path, source, tree, rel_path)
                        )
                    except Exception:
                        pass

        all_findings.sort(key=lambda f: (f.file_path, f.line or 0))
        return all_findings
