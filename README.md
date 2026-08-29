# RepoMedic

## Intelligent Repository Analysis, Safe Repair & Verification

RepoMedic is a developer-focused tool that analyzes Python repositories, detects potential software issues, provides evidence-based explanations, proposes safe automated repairs, and verifies the resulting code.

It is designed to help developers understand and improve existing Python codebases without blindly modifying their source code.

---

## Problem

Developers working with existing repositories often spend significant time identifying bugs, understanding why they occur, deciding which fixes are safe, and verifying that changes did not introduce regressions.

Traditional static analysis tools can identify problems, but developers still need to manually understand findings, apply fixes, and verify the result.

RepoMedic brings these stages together into one auditable workflow.

---

## Solution

RepoMedic provides an end-to-end repository improvement workflow:

**Analyze → Findings → Evidence → Repair Plan → Verification → Overview → Metrics → Final Report → IBM Bob Workflow**

The system:

- Analyzes Python repositories
- Detects potential bugs and code-quality issues
- Provides evidence for each finding
- Prioritizes findings by severity
- Generates repair proposals
- Allows users to preview changes before applying them
- Automatically repairs only predefined safe issues
- Creates backups before applying repairs
- Runs verification after repairs
- Detects remaining issues and potential regressions
- Provides repository health metrics
- Generates an auditable final report

---

## Key Features

### Repository Intake

Users can provide a repository in three ways:

- Upload a `.zip` Python repository
- Use the built-in sample repository
- Provide a local repository path

Uploaded repositories are safely extracted into isolated workspaces.

Security protections include:

- ZIP-only upload validation
- Path traversal protection
- Extraction limits
- File-count limits
- Repository validation
- No execution of uploaded code during upload

---

### Repository Analysis

RepoMedic uses deterministic analyzer rules to identify issues in Python repositories.

Each finding includes:

- Check ID
- File path
- Line number
- Severity
- Explanation
- Evidence
- Suggested fix

---

### Evidence Chain

Findings are connected to the underlying source evidence so developers can understand why an issue was detected.

---

### Safe Repair Engine

RepoMedic supports previewing and applying predefined safe repairs.

Automatically repairable rules include:

- **PY011** — Corrects specific unsafe comparison boundaries
- **PY003** — Replaces `print()` with `logging.warning()` where applicable
- **DOC001** — Creates a README when a package has no README
- **CFG001** — Updates outdated pinned dependencies to conservative compatible minimums

The following findings remain manual-review only:

- **PY009** — Exception semantics
- **TST001** — Missing tests requiring domain knowledge

RepoMedic does not automatically modify these risky cases.

---

### Backup & Verification

Before applying repairs, RepoMedic creates a backup.

After repairs, the verification workflow:

1. Runs the repository test suite
2. Re-runs repository analysis
3. Compares the before and after state
4. Detects remaining findings
5. Reports verification results and possible regressions

---

## IBM Bob Workflow

RepoMedic includes an interactive IBM Bob-inspired agentic development workflow demonstrating how software development can progress through:

1. Planning
2. Analysis
3. Repair
4. Verification
5. Reporting

The workflow visually communicates how an AI-assisted development process can support repository improvement while keeping deterministic analysis and safe repair controls in place.

IBM Bob was used throughout the development process to assist with implementation, debugging, testing, frontend development, backend development, and workflow refinement.

---

## Technology Stack

### Backend

- Python
- FastAPI
- Pydantic
- Pytest
- AST-based Python analysis

### Frontend

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React

---

## Project Structure

```text
RepoMedic/
│
├── app/
│   ├── backend/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   └── main.py
│   │
│   ├── frontend/
│   │   └── src/
│   │
│   ├── core/
│   ├── tests/
│   └── sample_repo/
│
├── agents/
├── requirements.txt
├── pyproject.toml
├── .gitignore
└── README.md
