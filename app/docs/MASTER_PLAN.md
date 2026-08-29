# RepoMedic AI — Master Implementation Blueprint

> **Diagnose. Repair. Verify. Ship.**
> Evidence-driven autonomous software maintenance for a one-day hackathon.
> Supports: Demo Repository (bundled) · Local Repository (user-selected)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model](#3-data-model)
4. [Sample Repository Design](#4-sample-repository-design)
5. [Backend API Specification](#5-backend-api-specification)
6. [Agent Layer Design](#6-agent-layer-design)
7. [Repair Architecture](#7-repair-architecture)
8. [Health Score Design](#8-health-score-design)
9. [Frontend Page Specifications](#9-frontend-page-specifications)
10. [IBM Bob Development Strategy](#10-ibm-bob-development-strategy)
11. [Implementation Phases](#11-implementation-phases)
12. [Hackathon Acceptance Criteria](#12-hackathon-acceptance-criteria)
13. [Risk and Fallback Plan](#13-risk-and-fallback-plan)

---

## 1. Product Vision

### 1.1 Core Statement

AI coding assistants generate fixes. RepoMedic proves them.

RepoMedic AI takes a repository, runs structured multi-analyst investigation, proposes evidence-backed repairs, requires human approval, applies the minimal safe change, verifies the result independently, and produces an auditable evidence chain. It never marks a finding resolved until independent verification passes.

### 1.2 Three Developer Workflows Addressed

| Workflow | Problem Solved | RepoMedic Action |
|---|---|---|
| Application Maintenance | Defects, misconfigs, dead code accumulate silently | Structured analysts surface findings with file+line evidence |
| Debugging | Speculative patches without root cause proof | Evidence chain forces traceability from symptom to fix to re-check |
| Testing | Gap coverage is invisible; regressions go undetected | Test Analyst identifies gaps; repair step generates+runs regression tests |

### 1.3 Non-Goals (MVP Scope Exclusions)

- No authentication or user management
- No cloud deployment or containerisation
- No database (local JSON only)
- No CI/CD integration
- No simultaneous multi-repository analysis. One repository is analyzed per session.
- No real-time collaboration
- No mobile layout
- No GitHub URL import, Git clone, GitLab/Bitbucket integration, or cloud repository upload
- No remote repository synchronization
- No multi-user collaboration

---

## 2. Architecture Overview

### 2.1 Tier Diagram

```
┌─────────────────────────────────────────────────┐
│  React 18 + TypeScript + Vite  (port 5173)       │
│  Tailwind CSS  ·  Lucide React                    │
│  Pages: Overview, Analyze, Findings,              │
│         Evidence Chain, Repair Plan,              │
│         Verification, Metrics,                    │
│         IBM Bob Workflow, Final Report            │
└────────────────────┬────────────────────────────┘
                     │  REST JSON  (CORS: localhost)
┌────────────────────▼────────────────────────────┐
│  Python 3.11 + FastAPI  (port 8000)              │
│  ┌─────────────┐  ┌──────────────┐              │
│  │  Routers    │  │   Models     │              │
│  │  (HTTP)     │  │  (Pydantic)  │              │
│  └──────┬──────┘  └──────────────┘              │
│         │                                         │
│  ┌──────▼──────────────────────────────┐         │
│  │            Services                 │         │
│  │  repo_scanner · doc_parser          │         │
│  │  evidence_store · repair_engine     │         │
│  │  verification_engine · health_score │         │
│  │  metrics_collector                  │         │
│  └──────┬──────────────────────────────┘         │
│         │                                         │
│  ┌──────▼──────────────────────────────┐         │
│  │           Agents (Bob subagents)    │         │
│  │  orchestrator · bug_analyst         │         │
│  │  test_analyst · config_analyst      │         │
│  │  doc_analyst · verifier             │         │
│  └──────┬──────────────────────────────┘         │
│         │                                         │
│  ┌──────▼──────────────────────────────┐         │
│  │  backend/data/  (JSON files)        │         │
│  │  session.json · findings.json       │         │
│  │  evidence_chain.json · repairs.json │         │
│  │  health_scores.json · metrics.json  │         │
│  │  audit_log.json                     │         │
│  └─────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Repository Source (one per session)             │
│                                                  │
│  DEMO: sample_repo/  (bundled, deterministic)    │
│  LOCAL: user-selected directory on disk          │
│                                                  │
│  → Repository Validator → RepoMedic Pipeline    │
└──────────────────────────────────────────────────┘
```

**Repository source flow:**

```
                    ┌─────────────────────┐
                    │ Repository Selection│
                    └──────────┬──────────┘
                               │
                     ┌─────────┴─────────┐
                     │                   │
                     ▼                   ▼
              Demo Repository      Local Repository
              (sample_repo/)       (user-selected)
                     │                   │
                     └─────────┬─────────┘
                               ▼
                     Repository Validator
                               │
                               ▼
                       RepoMedic Pipeline
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
              Scan          Documents     Analysts
                 │             │             │
                 └─────────────┼─────────────┘
                               ▼
                        Evidence Chain
                               ▼
                         Repair + Verify
```

`sample_repo/` is the **bundled Demo Repository** — it is not the only repository RepoMedic can analyze. It exists to guarantee a deterministic, reproducible hackathon demonstration. Both repository sources enter the exact same analysis pipeline.

### 2.2 Analysis Workflow (Canonical Sequence)

Every step is timestamped and attributed to the responsible agent.

```
1.  SELECT_REPOSITORY   User chooses Demo or Local repository source
2.  VALIDATE_REPOSITORY Backend validates path, readability, and content
3.  REPO_SCAN           File tree, language detection, dependency graph
4.  DOC_PARSE           README, ARCHITECTURE.md, CHANGELOG, inline docs
5.  PARALLEL_ANALYSIS   Bug + Test + Config + Doc analysts run concurrently
6.  EVIDENCE_SYNTHESIS  Deduplicate, correlate, rank findings
7.  PRIORITIZATION      Risk-score each finding (severity × confidence)
8.  REPAIR_PLAN         Generate proposed diffs per finding
9.  HUMAN_APPROVAL      UI gate — APPROVE / REJECT each repair
10. REPAIR_EXECUTION    Apply approved unified diffs atomically
11. REGRESSION_TESTS    Run existing + newly generated tests
12. INDEPENDENT_VERIFY  Re-run original analysis on post-repair code
13. EVIDENCE_CHAIN      Finalize append-only audit record
14. HEALTH_RESCORE      Recalculate all five dimensions from scratch
15. METRICS_DELTA       Compute before/after comparison
```

### 2.3 Directory Layout

```
RepoMedic/
├── AGENTS.md
├── README.md
├── docs/
│   └── MASTER_PLAN.md           ← This file
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── apiClient.ts      ← Base fetch wrapper + error handling
│       │   ├── analysisApi.ts
│       │   ├── findingsApi.ts
│       │   ├── repairApi.ts
│       │   ├── verificationApi.ts
│       │   ├── healthApi.ts
│       │   ├── metricsApi.ts
│       │   └── reportApi.ts
│       ├── components/
│       │   ├── AppShell.tsx      ← Nav + layout wrapper
│       │   ├── HealthGauge.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── SeverityBadge.tsx
│       │   ├── EvidenceStep.tsx
│       │   ├── FindingCard.tsx
│       │   ├── DiffViewer.tsx
│       │   ├── ProgressStream.tsx
│       │   └── MetricRow.tsx
│       └── pages/
│           ├── OverviewPage.tsx
│           ├── AnalyzePage.tsx
│           ├── FindingsPage.tsx
│           ├── EvidenceChainPage.tsx
│           ├── RepairPlanPage.tsx
│           ├── VerificationPage.tsx
│           ├── MetricsPage.tsx
│           ├── BobWorkflowPage.tsx
│           └── FinalReportPage.tsx
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── analysis.py
│   │   ├── findings.py
│   │   ├── repairs.py
│   │   ├── verification.py
│   │   ├── health.py
│   │   ├── metrics.py
│   │   └── report.py
│   ├── services/
│   │   ├── repo_scanner.py
│   │   ├── doc_parser.py
│   │   ├── evidence_store.py
│   │   ├── repair_engine.py
│   │   ├── verification_engine.py
│   │   ├── health_scorer.py
│   │   └── metrics_collector.py
│   ├── agents/
│   │   ├── orchestrator.py
│   │   ├── bug_analyst.py
│   │   ├── test_analyst.py
│   │   ├── config_analyst.py
│   │   ├── doc_analyst.py
│   │   └── verifier.py
│   ├── models/
│   │   ├── analysis.py
│   │   ├── finding.py
│   │   ├── evidence.py
│   │   ├── repair.py
│   │   ├── verification.py
│   │   ├── health.py
│   │   └── metrics.py
│   └── data/
│       ├── session.json
│       ├── findings.json
│       ├── evidence_chain.json
│       ├── repairs.json
│       ├── health_scores.json
│       ├── metrics.json
│       └── audit_log.json
└── sample_repo/
    ├── README.md
    ├── ARCHITECTURE.md
    ├── CHANGELOG.md
    ├── requirements.txt
    ├── ISSUE_REPORT.md
    ├── spectral/
    │   ├── __init__.py
    │   ├── analyzer.py
    │   ├── pipeline.py
    │   ├── transforms.py
    │   └── utils.py
    └── tests/
        ├── test_analyzer.py      ← Pre-existing (sparse)
        └── test_pipeline.py      ← Pre-existing (sparse)
```

---

## 3. Data Model

All objects are persisted as JSON. Every object has a stable string ID (`uuid4` hex).

### 3.0 RepositorySelection

```
RepositorySelection {
  source:   "DEMO" | "LOCAL"    # which repository source was selected
  path:     string              # absolute path resolved by backend
  name:     string              # display name (e.g. "spectral" or directory basename)
}
```

**Validation rules for LOCAL source:**
- `path` must exist on disk
- `path` must be a directory
- directory must be readable by the process
- directory must contain at least one supported file (`.py`, `.js`, `.ts`, `.go`, `.java`, `.rb`, `.rs`, `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.cfg`, `.ini`, `requirements.txt`, `package.json`, etc.)
- Git metadata is **not** required
- No internet access required

**For DEMO source:** `path` and `name` are resolved automatically from `config.SAMPLE_REPO_PATH`. `repo_path` in the request may be `null` or omitted.

---

### 3.1 Session

```
Session {
  id:               string          # uuid
  repo_source:      "DEMO" | "LOCAL"   # which source was selected
  repo_path:        string          # absolute path to target repo
  repo_name:        string
  status:           SessionStatus   # IDLE | SCANNING | ANALYZING | REPAIRING | VERIFYING | COMPLETE | FAILED
  started_at:       ISO8601 | null
  completed_at:     ISO8601 | null
  current_step:     string          # human-readable step name
  step_history:     StepRecord[]    # append-only
  error:            string | null
}

StepRecord {
  step:         string
  agent:        string
  started_at:   ISO8601
  completed_at: ISO8601 | null
  status:       "RUNNING" | "DONE" | "FAILED"
  detail:       string | null
}
```

### 3.2 RepoContext

```
RepoContext {
  session_id:       string
  repo_path:        string
  file_count:       int
  total_lines:      int
  languages:        dict[string, int]     # language → line count
  dependencies:     Dependency[]
  file_tree:        string                # text representation
  scanned_at:       ISO8601
}

Dependency {
  name:     string
  version:  string
  source:   string    # "requirements.txt" | "pyproject.toml" etc.
}
```

### 3.3 DocumentContext

```
DocumentContext {
  session_id:           string
  readme_summary:       string | null
  architecture_notes:   string | null
  changelog_entries:    ChangelogEntry[]
  inline_doc_coverage:  float            # 0.0–1.0
  requirements_found:   Requirement[]
  parsed_at:            ISO8601
}

ChangelogEntry {
  version:    string
  date:       string
  notes:      string
}

Requirement {
  id:         string
  source:     string      # file + line ref
  text:       string
  category:   string      # "behaviour" | "interface" | "constraint"
}
```

### 3.4 Finding

```
Finding {
  id:                   string
  session_id:           string
  analyst:              AnalystType    # BUG | TEST | CONFIG | DOC
  category:             string         # "logic_defect" | "test_gap" | "doc_inconsistency" | "config_risk" | "maintainability"
  title:                string
  description:          string
  severity:             Severity       # CRITICAL | HIGH | MEDIUM | LOW | INFO
  confidence:           Confidence     # HIGH | MEDIUM | LOW
  affected_files:       FileRef[]
  evidence_id:          string         # FK → Evidence
  requirement_id:       string | null  # FK → Requirement
  recommendation:       string
  verification_method:  string
  status:               FindingStatus  # OPEN | IN_REPAIR | VERIFIED | FAILED | DISMISSED
  created_at:           ISO8601
  updated_at:           ISO8601
}

FileRef {
  path:         string    # relative to repo root
  start_line:   int
  end_line:     int
  snippet:      string    # exact lines from file
}
```

### 3.5 Evidence

```
Evidence {
  id:               string
  finding_id:       string
  file_path:        string
  start_line:       int
  end_line:         int
  content:          string        # exact source lines
  explanation:      string        # why this is a problem
  extracted_at:     ISO8601
  extracted_by:     string        # agent name
}
```

### 3.6 RepairTask

```
RepairTask {
  id:               string
  finding_id:       string
  session_id:       string
  title:            string
  root_cause:       string
  proposed_diff:    string        # unified diff format
  affected_files:   string[]
  risk_level:       RiskLevel     # LOW | MEDIUM | HIGH
  risk_rationale:   string
  status:           RepairStatus  # PROPOSED | APPROVED | REJECTED | IMPLEMENTED | VERIFIED | FAILED
  approved_by:      string | null # "human" or null
  approved_at:      ISO8601 | null
  implemented_at:   ISO8601 | null
  rejection_reason: string | null
  created_at:       ISO8601
  updated_at:       ISO8601
}
```

### 3.7 RegressionTest

```
RegressionTest {
  id:             string
  repair_id:      string
  finding_id:     string
  name:           string
  file_path:      string      # relative to repo root
  test_function:  string
  command:        string      # e.g. "pytest sample_repo/tests/test_foo.py::test_bar"
  generated:      bool        # true if created by RepoMedic, false if pre-existing
  created_at:     ISO8601
}
```

### 3.8 VerificationResult

```
VerificationResult {
  id:                       string
  repair_id:                string
  finding_id:               string
  session_id:               string
  regression_test_ids:      string[]
  regression_tests_passed:  bool
  regression_test_output:   string
  full_suite_passed:         bool
  full_suite_output:         string
  requirement_check_passed: bool
  requirement_check_notes:  string
  original_symptom_absent:  bool
  original_symptom_notes:   string
  independent_analysis_run: bool
  independent_finding_gone: bool
  final_status:             VerificationStatus    # VERIFIED | PARTIALLY_VERIFIED | FAILED | FALSE_POSITIVE
  verified_at:              ISO8601
  verified_by:              string                # agent name
}
```

### 3.9 HealthScore

```
HealthScore {
  id:               string
  session_id:       string
  snapshot:         "BEFORE" | "AFTER"
  bug_health:       int | null       # 0–100 or null if PENDING
  test_health:      int | null
  doc_health:       int | null
  maintainability:  int | null
  config_health:    int | null
  overall:          int | null
  dimension_notes:  dict[string, string]    # per-dimension rationale
  calculated_at:    ISO8601
}
```

### 3.10 Metric

```
Metric {
  id:                       string
  session_id:               string
  repo_source:               "DEMO" | "LOCAL"    # which source was analyzed
  analysis_duration_s:      float | null
  repair_duration_s:        float | null
  verification_duration_s:  float | null
  total_duration_s:         float | null
  findings_before:          int
  findings_after:            int
  findings_resolved:         int
  tests_before:              int
  tests_after:               int
  tests_generated:           int
  health_before:             int | null
  health_after:              int | null
  repair_status_breakdown:   dict[string, int]    # status → count
  manual_baseline_s:         float | null         # ESTIMATED, not observed
  is_manual_baseline_estimated: bool
  recorded_at:               ISO8601
}
```

### 3.11 AuditEvent

```
AuditEvent {
  id:         string
  session_id: string
  timestamp:  ISO8601
  agent:      string
  action:     string
  object_id:  string | null
  object_type: string | null
  detail:     string
  success:    bool
  error:      string | null
}
```

---

## 4. Sample Repository Design (Bundled Demo Repository)

The `sample_repo/` directory is RepoMedic's **bundled Demo Repository**. It is not the only repository RepoMedic can analyze — it exists to guarantee a deterministic, reproducible hackathon demonstration.

The demo repository must be resettable to its original defective state for repeated demonstrations. The local repository feature is independent of this design.

### 4.1 Repository Identity

**Name:** `spectral` — A small Python scientific data-processing library that performs spectral analysis on time-series signals.

**Domain:** Signal processing / data science. Realistic, not toy, but small enough to audit completely.

**Files:**

| File | Purpose |
|---|---|
| `spectral/__init__.py` | Package exports |
| `spectral/analyzer.py` | `SpectralAnalyzer` class — FFT computation and peak detection |
| `spectral/pipeline.py` | `Pipeline` class — chains transforms in sequence |
| `spectral/transforms.py` | `normalize()`, `window()`, `resample()` utility functions |
| `spectral/utils.py` | `load_signal()`, `save_results()`, `format_summary()` helpers |
| `tests/test_analyzer.py` | Existing sparse tests for `SpectralAnalyzer` |
| `tests/test_pipeline.py` | Existing sparse tests for `Pipeline` |
| `README.md` | User-facing documentation (contains one inconsistency) |
| `ARCHITECTURE.md` | Design rationale document |
| `CHANGELOG.md` | Version history |
| `ISSUE_REPORT.md` | Open issue filed by a fictional user |
| `requirements.txt` | Dependencies |

### 4.2 Intentional Defects (Deterministic and Reproducible)

#### Defect 1 — Off-by-one in peak detection (Logic Defect, MEDIUM severity)

**Location:** `spectral/analyzer.py`, `find_peaks()` method.

**Description:** The peak detection loop uses `range(1, len(freqs) - 1)` to scan for local maxima but the boundary condition uses `>=` instead of `>` when comparing amplitude threshold. This causes the function to include the DC component (index 0 boundary) as a false peak when the signal has a strong zero-frequency component. The bug is only triggered when the input signal has a non-zero mean.

**Evidence:** Reproducible with a unit test: `signal = [5.0] * 64` (constant signal, non-zero mean) causes `find_peaks()` to return one spurious peak.

#### Defect 2 — Silent data loss in pipeline step error handling (Logic Defect, HIGH severity)

**Location:** `spectral/pipeline.py`, `Pipeline.run()` method.

**Description:** When a transform step raises an exception, the pipeline catches it, logs a warning string to stdout (not stderr), and continues with the pre-exception data rather than raising or returning an error state. The caller has no programmatic way to know a step failed. The return value looks successful.

**Evidence:** A unit test that inserts a failing transform step and checks the return value or exception will confirm silent data loss.

### 4.3 Intentional Test Gaps

#### Test Gap 1 — No test for non-zero-mean signal input

**Location:** `tests/test_analyzer.py` — `test_find_peaks` only tests zero-mean sinusoidal input.

**Gap:** The boundary condition bug (Defect 1) is only exercised by a non-zero-mean input. The existing test suite passes even though the bug exists.

#### Test Gap 2 — No test for pipeline step failure propagation

**Location:** `tests/test_pipeline.py` — only tests the happy path.

**Gap:** No test verifies what happens when a pipeline step raises. The silent data loss (Defect 2) is entirely untested.

### 4.4 Documentation Inconsistency

**Location:** `README.md` states that `SpectralAnalyzer.find_peaks()` accepts a `threshold` parameter as a **percentage of maximum amplitude** (0–100). The actual implementation treats it as an **absolute amplitude value**. This contradicts the documented API contract.

### 4.5 Maintainability Issue

**Location:** `spectral/utils.py` — `format_summary()` function is defined and exported but never called anywhere in the codebase. It is dead code.

### 4.6 Configuration / Dependency Issue

**Location:** `requirements.txt` — pins `numpy==1.21.0`, which is over two years old and predates NumPy 2.x. The old pin is not unsafe, but it blocks compatibility with downstream packages that require NumPy >= 1.23. This is a real, verifiable constraint issue, not an invented CVE.

---

## 5. Backend API Specification

Base URL: `http://localhost:8000/api`

All responses return `Content-Type: application/json`. Errors return `{ "detail": string }`.

### 5.1 Analysis

#### `POST /api/analysis/start`

**Purpose:** Begin a new analysis session. Supports both the bundled Demo repository and a user-selected Local repository.

**Request body:**
```json
{
  "source": "DEMO" | "LOCAL",
  "repo_path": "string | null"
}
```

**Rules:**
- `DEMO`: `repo_path` may be omitted or `null`. Backend resolves `config.SAMPLE_REPO_PATH` automatically.
- `LOCAL`: `repo_path` is required. Backend validates the directory before starting. Invalid path returns `400`.

**Response:**
```json
{
  "session_id": "string",
  "repo_source": "DEMO" | "LOCAL",
  "repo_name": "string",
  "repo_path": "string",
  "status": "SCANNING",
  "started_at": "ISO8601"
}
```

**Errors:**
- `400` if `source` is `LOCAL` and `repo_path` is missing, invalid, unreadable, or contains no supported files.
- `409` if a session is already running.

---

#### `GET /api/analysis/status`

**Purpose:** Poll current session status and step history.

**Response:**
```json
{
  "session_id": "string",
  "status": "SessionStatus",
  "current_step": "string",
  "step_history": [ StepRecord ],
  "error": "string | null"
}
```

---

#### `GET /api/analysis/repo-context`

**Purpose:** Return the repository structure and language summary.

**Response:** `RepoContext` object.

---

#### `GET /api/analysis/doc-context`

**Purpose:** Return parsed documentation and extracted requirements.

**Response:** `DocumentContext` object.

---

#### `GET /api/repositories/demo`

**Purpose:** Return metadata for the bundled demo repository so the UI can display it before analysis starts.

**Response:**
```json
{
  "name": "string",
  "path": "string",
  "source": "DEMO",
  "file_count": int,
  "description": "string"
}
```

---

#### `POST /api/repositories/validate`

**Purpose:** Validate a local repository path before the user starts analysis. Lightweight check — no analysis performed.

**Request body:**
```json
{ "path": "string" }
```

**Response:**
```json
{
  "valid": bool,
  "path": "string",
  "name": "string",
  "reason": "string | null"
}
```

`reason` is populated when `valid` is `false` (e.g. `"path does not exist"`, `"not a directory"`, `"no supported source files found"`).

---

### 5.2 Findings

#### `GET /api/findings`

**Purpose:** Return all findings for the current session.

**Query params:** `analyst`, `severity`, `confidence`, `status`, `category` (all optional filters).

**Response:**
```json
{ "findings": [ Finding ], "total": int }
```

---

#### `GET /api/findings/{finding_id}`

**Purpose:** Return a single finding with its full evidence.

**Response:**
```json
{ "finding": Finding, "evidence": Evidence }
```

**Errors:** `404` if not found.

---

#### `GET /api/findings/summary`

**Purpose:** Return aggregate counts by severity, category, and status.

**Response:**
```json
{
  "by_severity": { "CRITICAL": int, "HIGH": int, ... },
  "by_category": { ... },
  "by_status":   { ... },
  "total": int
}
```

---

### 5.3 Evidence Chain

#### `GET /api/findings/{finding_id}/evidence-chain`

**Purpose:** Return the complete evidence chain for one finding — all steps from evidence through final verification.

**Response:**
```json
{
  "finding":      Finding,
  "evidence":     Evidence,
  "requirement":  Requirement | null,
  "repair":       RepairTask | null,
  "tests":        RegressionTest[],
  "verification": VerificationResult | null
}
```

---

### 5.4 Health Score

#### `GET /api/health`

**Purpose:** Return the most recent health score (BEFORE or AFTER depending on stage).

**Response:** `HealthScore` object.

---

#### `GET /api/health/before`

**Purpose:** Return the BEFORE health snapshot.

**Response:** `HealthScore` object or `404` if not yet calculated.

---

#### `GET /api/health/after`

**Purpose:** Return the AFTER health snapshot.

**Response:** `HealthScore` object or `404` if not yet calculated.

---

### 5.5 Repair Plan

#### `GET /api/repairs`

**Purpose:** Return all repair tasks.

**Response:**
```json
{ "repairs": [ RepairTask ], "total": int }
```

---

#### `GET /api/repairs/{repair_id}`

**Purpose:** Return a single repair task.

**Response:** `RepairTask` object. **Errors:** `404`.

---

#### `POST /api/repairs/{repair_id}/approve`

**Purpose:** Human approves a repair. Transitions status from `PROPOSED` to `APPROVED`.

**Request body:** `{}` (no body required)

**Response:** Updated `RepairTask`.

**Errors:** `409` if status is not `PROPOSED`.

---

#### `POST /api/repairs/{repair_id}/reject`

**Purpose:** Human rejects a repair.

**Request body:**
```json
{ "reason": "string" }
```

**Response:** Updated `RepairTask`.

**Errors:** `409` if status is not `PROPOSED`.

---

#### `POST /api/repairs/{repair_id}/execute`

**Purpose:** Apply an approved repair diff to the repository. Transitions status to `IMPLEMENTED`.

**Request body:** `{}` (no body required)

**Response:** Updated `RepairTask` with `implemented_at` set.

**Errors:** `409` if status is not `APPROVED`. `500` if patch application fails.

---

### 5.6 Verification

#### `POST /api/verification/run`

**Purpose:** Run regression tests + full suite + independent re-analysis for all `IMPLEMENTED` repairs.

**Request body:** `{}` (no body required)

**Response:**
```json
{ "results": [ VerificationResult ] }
```

---

#### `GET /api/verification/{repair_id}`

**Purpose:** Return the verification result for a specific repair.

**Response:** `VerificationResult` object. **Errors:** `404`.

---

### 5.7 Metrics

#### `GET /api/metrics`

**Purpose:** Return the full metrics object for the current session.

**Response:** `Metric` object.

---

### 5.8 Report

#### `GET /api/report`

**Purpose:** Return the complete final report as a structured JSON summary.

**Response:**
```json
{
  "session":         Session,
  "repo_context":    RepoContext,
  "doc_context":     DocumentContext,
  "health_before":   HealthScore | null,
  "health_after":    HealthScore | null,
  "findings":        Finding[],
  "repairs":         RepairTask[],
  "verifications":   VerificationResult[],
  "metrics":         Metric,
  "audit_events":    AuditEvent[]
}
```

---

## 6. Agent Layer Design

### 6.1 Orchestrator (`agents/orchestrator.py`)

**Role:** Coordinates the full analysis workflow. Spawns and awaits the four specialist analysts. Manages session state transitions. Records every step to the audit log.

**Responsibilities:**
- Start session, set status to `SCANNING`
- Call `repo_scanner` → set status to `ANALYZING`
- Call `doc_parser`
- Launch the four analysts concurrently using `asyncio.gather()`
- Collect findings, call `evidence_store.synthesize()`
- Generate repair plans via `repair_engine.plan()`
- Wait for human approvals (polling gate)
- Execute approved repairs
- Trigger verification
- Recalculate health score
- Finalize metrics
- Set status to `COMPLETE`

### 6.2 Bug Analyst (`agents/bug_analyst.py`)

**Input:** `RepoContext` + `DocumentContext` + all source files

**Technique:**
1. Parse each Python source file using the `ast` module
2. Detect patterns: unreachable except clauses, bare `except`, silent exception swallowing, suspicious boundary conditions, off-by-one loop indices
3. Cross-reference with `DocumentContext.requirements_found` for contract violations
4. For each candidate: extract exact line range, write `Evidence` object, assign `Confidence`

**Output:** List of `Finding` objects with category `logic_defect` or `error_handling`

**Key rule:** Only emit findings with file+line evidence. No speculative findings.

### 6.3 Test Analyst (`agents/test_analyst.py`)

**Input:** `RepoContext` + `DocumentContext` + test files + source files

**Technique:**
1. Enumerate all public functions/classes/methods in source
2. Enumerate all test functions in `tests/`
3. Match test names and `assert` statements to source functions
4. Identify source paths with zero or inadequate test coverage
5. Cross-reference with `Bug Analyst` findings — gaps near known bugs are highest priority

**Output:** List of `Finding` objects with category `test_gap`, plus `RegressionTest` proposals

### 6.4 Config Analyst (`agents/config_analyst.py`)

**Input:** `RepoContext` + `requirements.txt` / config files

**Technique:**
1. Parse `requirements.txt` for pinned versions
2. Compare pin ages using PyPI metadata (if network available) or static known-old heuristic
3. Check for `.env` patterns, hardcoded credentials, insecure defaults
4. Check for inconsistency between declared and actually imported packages

**Key rule:** Do not invent CVEs. Only report issues that can be confirmed from the files present in the repository.

**Output:** List of `Finding` objects with category `config_risk`

### 6.5 Documentation Analyst (`agents/doc_analyst.py`)

**Input:** `RepoContext` + `DocumentContext` + source files

**Technique:**
1. For each `Requirement` extracted from docs, locate the corresponding source implementation
2. Compare documented API signatures (parameter names, types, semantics) against actual function signatures using `ast`
3. Check for functions documented in README with no corresponding source definition
4. Flag README parameter descriptions that contradict the implementation

**Output:** List of `Finding` objects with category `doc_inconsistency`

### 6.6 Verifier (`agents/verifier.py`)

**Role:** Performs independent post-repair analysis. Runs as a separate agent pass after repairs are applied — it does not share state with the analysing agents.

**Steps per repair:**
1. Re-read the patched file from disk
2. Re-run the same detection logic that originally produced the finding
3. Confirm the original symptom is absent
4. Run `pytest` in a subprocess with timeout
5. Write `VerificationResult` with `independent_finding_gone = True/False`

---

## 7. Repair Architecture

### 7.0 Repair Safety for Local Repositories

When RepoMedic analyzes a user-selected Local repository, the following safety rules apply (in addition to the standard approval gate):

1. Never modify any file in the repository during analysis — only during approved repair execution.
2. Repairs require explicit human approval before any file is touched.
3. Before applying a repair, create a backup of every affected file to `backend/data/backups/{repair_id}/`.
4. Only modify files explicitly listed in the approved `RepairTask.affected_files`.
5. Never delete the entire repository or any directory recursively.
6. Never modify files outside the selected repository root (use `pathlib.Path.resolve()` to confirm).
7. Reject any path that traverses outside the repository root (e.g. `../` components resolve outside root → reject).
8. If repair application fails at any point, restore all affected files from backup before reporting failure.
9. The Repair Plan page must clearly show the repository name and path before repair execution.
10. The user must be able to see which repository will be modified before confirming any repair.

These rules apply identically to DEMO and LOCAL sources. For the hackathon MVP, no sandboxing infrastructure, containers, or cloud isolation is required. All path handling must use `pathlib` rather than hard-coded Unix path assumptions to remain Windows-compatible.

### 7.1 Repair Generation

For each approved finding, `repair_engine.plan()`:

1. Reads the affected file(s) from disk
2. Constructs the minimal correct change (line-by-line replacement — no structural refactoring)
3. Generates a **unified diff** (`difflib.unified_diff`)
4. Estimates risk level:
   - `LOW` if only comments/docs/whitespace change
   - `MEDIUM` if logic or configuration changes
   - `HIGH` if functions are deleted, moved, or security-sensitive paths change
5. Stores the diff in `RepairTask.proposed_diff` before any application

### 7.2 Repair Application

`repair_engine.apply()`:

1. Verifies repair status is `APPROVED`
2. Writes a backup of each affected file to `backend/data/backups/{repair_id}/`
3. Applies the unified diff using `subprocess.run(['patch', '-p1', ...])` or Python's `difflib` patch equivalent
4. Reads the patched file back and confirms the changed lines are present
5. If confirmation fails → restore backup, set status `FAILED`, log error
6. If confirmation passes → set status `IMPLEMENTED`, record `implemented_at`

### 7.3 Repair Safety Properties

- **Atomic per finding:** A repair either applies fully or the file is restored to backup. Partial patches are rejected.
- **Append-only evidence:** The diff is written to the evidence chain before application, not after.
- **No auto-retry:** A `FAILED` repair must be re-planned by the user triggering a new analysis.
- **Path confinement:** All file writes must resolve to within the selected repository root. Path traversal outside the root is rejected.
- **pathlib-native:** All path handling uses `pathlib.Path` — no hard-coded Unix separators or `patch` subprocess dependency.

### 7.4 Regression Test Generation

For each repair, `test_analyst` generates a regression test that:

1. Directly exercises the previously-failing code path
2. Asserts the previously-observed incorrect behaviour no longer occurs
3. Is written to `{repo_root}/tests/test_{finding_id_short}.py` (relative to the selected repository root, not hard-coded to `sample_repo/`)
4. Uses only `pytest` and packages already in the repository's dependency manifest

### 7.5 Test Execution

`verification_engine.run_tests()`:

1. Runs targeted test: `pytest {test_file}::{test_function} -v --tb=short --timeout=30`
2. Runs full suite: `pytest {repo_root}/tests/ -v --tb=short --timeout=30` (path resolved from selected repository root)
3. Captures stdout/stderr
4. Records pass/fail, output, and duration

---

## 8. Health Score Design

### 8.1 Calculation Method

Each dimension is scored independently based on **counted evidence**, not heuristics. The score is recalculated from scratch after each repair cycle — never incrementally adjusted.

#### Bug Health (weight: 20)

```
base = 100
deductions:
  CRITICAL finding → -30
  HIGH finding     → -20
  MEDIUM finding   → -10
  LOW finding      → -5
floor = 0
```

#### Test Health (weight: 20)

```
base = 100
gap_deduction = (untested_public_functions / total_public_functions) * 60
regression_bonus = min(generated_passing_tests * 5, 20)
score = max(0, base - gap_deduction + regression_bonus)
```

#### Documentation Health (weight: 20)

```
base = 100
deductions:
  doc_inconsistency finding (HIGH confidence) → -25
  doc_inconsistency finding (MEDIUM)          → -15
  inline_doc_coverage < 0.5                   → -20
  README missing sections                     → -10
floor = 0
```

#### Maintainability Health (weight: 20)

```
base = 100
deductions:
  dead_code finding    → -15
  duplication finding  → -10
  complexity finding   → -10
floor = 0
```

#### Configuration Health (weight: 20)

```
base = 100
deductions:
  HIGH config_risk finding    → -30
  MEDIUM config_risk finding  → -15
  LOW config_risk finding     → -5
floor = 0
```

#### Overall

```
overall = (bug_health + test_health + doc_health + maintainability + config_health) / 5
```

All dimensions that have not yet been analysed are marked `PENDING` and excluded from the average. The overall score is marked `PARTIAL` until all dimensions are complete.

---

## 9. Frontend Page Specifications

### 9.1 Overview Page

**Purpose:** Repository health summary, before/after scores, key metrics at a glance.

**Components:**
- `HealthGauge` — circular gauge showing overall score (before → after with animated delta)
- Repository info card: **Repository Name**, **Repository Source** (`DEMO` / `LOCAL` badge), **Repository Path**, language breakdown, file count, last scan time
- Five dimension cards with mini sparkbar (Bug / Test / Doc / Maintainability / Config)
- Stat strip: Findings · Verified Repairs · Tests Added · Docs Consistency
- "Start Analysis" CTA button if no session exists; "View Results" if complete

**API endpoints used:**
- `GET /api/analysis/status`
- `GET /api/health/before` + `GET /api/health/after`
- `GET /api/findings/summary`
- `GET /api/metrics`

**Empty state:** Show repository identity with all scores as `—`. Prompt user to run analysis.
**Loading state:** Skeleton cards. No spinner in the score gauge — keep it stable.
**Error state:** Red banner with error message from session.

**User actions:** Navigate to Analyze page to start.

---

### 9.2 Analyze Page

**Purpose:** Select repository source, trigger analysis, monitor progress, see per-analyst status.

**Components:**

**Repository Selection panel** (shown before analysis starts):

- "Choose Repository" heading
- **Option 1 — Demo Repository:** Description: "Use the bundled deterministic repository for the hackathon demonstration." Button: **"Use Demo"**. Shows repository name and path from `GET /api/repositories/demo`.
- **Option 2 — Local Repository:** Description: "Analyze a repository from your local machine." Input field for path + **"Validate"** button calling `POST /api/repositories/validate`. Shows validation result inline.
- After selection, display: Repository Name · Repository Path · Repository Source badge (`DEMO` / `LOCAL`)
- **"Start Analysis"** button — enabled only after a valid repository is selected

**Analysis Progress panel** (shown while running and after):

- `ProgressStream` — vertical stepper showing all 15 workflow steps (including SELECT_REPOSITORY and VALIDATE_REPOSITORY) with timestamps and agent labels
- Four analyst status cards (Bug / Test / Config / Doc) each showing: status badge, finding count, duration
- "Reset Session" button (destructive, clears all data)
- Live update via polling `GET /api/analysis/status` every 2 seconds while RUNNING

**API endpoints used:**
- `GET /api/repositories/demo`
- `POST /api/repositories/validate`
- `POST /api/analysis/start`
- `GET /api/analysis/status` (polled)
- `GET /api/analysis/repo-context`
- `GET /api/analysis/doc-context`

**Empty state:** Repository selection panel with both options visible.
**Loading state:** Each step shows a spinning indicator while running. Completed steps show green checkmark.
**Error state:** Failed step highlighted in red with error detail. Validation failure shown inline under the path input.

**User actions:** Select repository source, validate local path, start analysis, monitor progress, navigate to Findings when complete.

**Design rule:** Do not create separate analysis pages for DEMO and LOCAL. The same Analyze page handles both sources.

---

### 9.3 Findings Page

**Purpose:** Browse, filter, and inspect all findings.

**Components:**
- Filter bar: category dropdown, severity multi-select, confidence multi-select, status multi-select, text search
- Findings table with sortable columns: ID, Title, Analyst, Severity, Confidence, Status, Affected Files
- `SeverityBadge` and `StatusBadge` inline components
- Row expand → shows description, affected files, recommendation
- "View Evidence Chain" link per row → navigates to Evidence Chain page

**API endpoints used:**
- `GET /api/findings` (with filter query params)
- `GET /api/findings/summary`

**Empty state:** "No findings match current filters" with clear-filters CTA.
**Loading state:** Table skeleton rows.
**Error state:** Inline error banner.

**User actions:** Filter, sort, expand rows, navigate to Evidence Chain.

---

### 9.4 Evidence Chain Page

**Purpose:** The signature interface. Full lifecycle traceability for one finding.

**Components:**
- Finding header card (title, severity, analyst, status)
- Vertical evidence chain stepper with eight steps:

  1. **Finding** — title, description, analyst, severity, confidence
  2. **Evidence** — file path + line number + code snippet with syntax highlighting, explanation
  3. **Requirement** — source document reference, requirement text (or "No documented requirement found")
  4. **Recommendation** — specific proposed action text
  5. **Code Change** — `DiffViewer` showing unified diff (added lines green, removed lines red)
  6. **Regression Test** — test file + function name + command + pass/fail badge
  7. **Independent Verification** — re-analysis result, symptom-absent confirmation, output excerpt
  8. **Final Status** — `VERIFIED` (emerald) / `FAILED` (red) / `PENDING` (amber) with timestamp

- Each step has a status indicator: COMPLETE (filled circle), PENDING (empty circle), FAILED (red X)
- Steps that have not yet reached that stage are greyed out but still visible

**API endpoints used:**
- `GET /api/findings/{finding_id}/evidence-chain`

**Empty state:** "Select a finding from the Findings page."
**Loading state:** Skeleton stepper.
**Error state:** Error card per step that failed to load.

**User actions:** Read-only drill-down. Back navigation to Findings.

---

### 9.5 Repair Plan Page

**Purpose:** Review proposed repairs, approve or reject each one.

**Components:**
- Repairs list — each repair is a card showing:
  - Finding title + severity badge
  - Root cause summary
  - Risk level badge (LOW/MEDIUM/HIGH with colour coding)
  - Affected files list
  - Expand → `DiffViewer` for the proposed diff
  - `RegressionTest` details
  - Verification method description
  - Approval status badge
  - **Approve** button (green, disabled if not PROPOSED)
  - **Reject** button (red, disabled if not PROPOSED) → opens rejection reason modal

- Batch approve button for all LOW-risk repairs
- Summary strip: Total · Pending · Approved · Rejected

**API endpoints used:**
- `GET /api/repairs`
- `POST /api/repairs/{repair_id}/approve`
- `POST /api/repairs/{repair_id}/reject`
- `POST /api/repairs/{repair_id}/execute` (triggered after approval — or by separate "Execute All Approved" button)

**Empty state:** "No repairs proposed yet. Run analysis first."
**Loading state:** Skeleton cards.
**Error state:** Inline per-card error if approval/rejection fails.

**User actions:** Expand diffs, approve, reject (with reason), execute approved repairs.

---

### 9.6 Verification Page

**Purpose:** Show post-repair verification status for every implemented repair.

**Components:**
- Verification results list — per repair card showing:
  - Repair title + risk badge
  - Changed files list with line counts
  - Regression test results table (test name, pass/fail, duration)
  - Full suite result (pass/fail count)
  - Requirement check result (pass/fail + notes)
  - Original finding recheck (symptom absent: yes/no)
  - Independent verification result
  - Final status badge: `VERIFIED` / `PARTIALLY_VERIFIED` / `FAILED` / `FALSE_POSITIVE`

- "Run Verification" button → calls `POST /api/verification/run`
- Summary strip: Total · Verified · Failed · Partially Verified

**API endpoints used:**
- `GET /api/repairs`
- `GET /api/verification/{repair_id}`
- `POST /api/verification/run`

**Empty state:** "No repairs have been implemented yet."
**Loading state:** Verification in progress — stepper showing each check as it completes.
**Error state:** Failed verifications shown with red status and error excerpt.

**User actions:** Trigger verification, inspect per-check results.

---

### 9.7 Metrics Page

**Purpose:** Actual before/after measurement. No fabricated numbers.

**Components:**
- Repository source indicator at the top of the page: Repository Name · Source (`DEMO` / `LOCAL`) — so the user knows which repository's metrics are displayed
- Comparison table with rows:

  | Metric | Before | After | Δ | % Change |
  |---|---|---|---|---|
  | Overall Health Score | n | n | +n | +n% |
  | Bug Health | n | n | ... | ... |
  | Test Health | n | n | ... | ... |
  | Doc Health | n | n | ... | ... |
  | Maintainability | n | n | ... | ... |
  | Config Health | n | n | ... | ... |
  | Open Findings | n | n | ... | ... |
  | Passing Tests | n | n | ... | ... |
  | Analysis Duration | — | n s | — | — |
  | Repair Duration | — | n s | — | — |
  | Total Duration | — | n s | — | — |

- `MetricRow` component handles `null` values by showing `N/A` with tooltip explanation
- All observed values are labelled `OBSERVED`; any estimates are clearly labelled `ESTIMATED (not measured)`
- Manual baseline section — clearly labelled `ESTIMATED (not measured)` if applicable
- Repair status breakdown donut chart (simple SVG — no chart library needed)

**API endpoints used:**
- `GET /api/metrics`
- `GET /api/health/before`
- `GET /api/health/after`

**Empty state:** "Complete the analysis and at least one repair cycle to see metrics."
**Loading state:** Skeleton rows.
**Error state:** `N/A` cells with error tooltip.

**User actions:** Read-only. All numbers either measured or labelled as estimated.

---

### 9.8 IBM Bob Workflow Page

**Purpose:** Honest documentation of how IBM Bob 2.0 was actually used to build RepoMedic. This page records real usage, not aspirational claims.

**Structure:**

A timeline of Bob capability invocations during development, each card showing:
- Capability name (Plan / Agent / Ask / Subagents / Parallel Tasks / Document Understanding / Agentic Iteration)
- What was built in that session
- Specific files or decisions produced
- Screenshot or text excerpt if available

**Capabilities to document (populated after development is complete):**

| Capability | When It Was Used | What It Produced |
|---|---|---|
| Plan mode | Architecture session | `docs/MASTER_PLAN.md` |
| Agent mode | Backend scaffold | backend/ directory |
| Agent mode | Frontend scaffold | frontend/ directory |
| Ask mode | FastAPI patterns | router/service separation decisions |
| Subagents | Parallel analyst design | agent file structure |
| Parallel tasks | Four-analyst concurrent run | bug + test + config + doc findings |
| Document understanding | README + ARCHITECTURE.md parse | `DocumentContext` extraction |
| Agentic iteration | Repair → Test → Verify loop | verification results |

**Important rule:** Do not list a capability unless it was genuinely used. Update this list during implementation.

**API endpoints used:** None — this is a static documentation page.

**User actions:** Read-only. Links to relevant source files on GitHub (if applicable).

---

### 9.9 Final Report Page

**Purpose:** Presentation-ready summary exportable as a self-contained view.

**Components:**
- Report header: repository name, analysis date, overall verdict
- Health score before/after comparison (side-by-side gauges)
- Findings summary table (grouped by severity)
- Repair summary table (grouped by status)
- Verified repairs list with brief descriptions
- Tests added table
- Documentation consistency result
- Productivity metrics panel (observed + estimated clearly labelled)
- Evidence summary accordion — one row per verified finding with link to Evidence Chain
- Export button → opens print dialog (browser print to PDF)

**API endpoints used:**
- `GET /api/report`

**Empty state:** "Complete the full workflow to generate a final report."
**Loading state:** Skeleton report.
**Error state:** Error banner.

**User actions:** Read report, export to PDF via browser print.

---

## 10. IBM Bob Development Strategy

### 10.1 Mode Assignment

| Phase | Mode | Reason |
|---|---|---|
| Architecture | Plan | Requires reasoning about structure before touching code |
| Sample repo design | Agent | Creating files requires tool use |
| Backend scaffold | Agent | File creation and code writing |
| Agent layer | Agent | Complex logic, requires iteration |
| Repair engine | Agent | File patching logic, needs test loops |
| Frontend scaffold | Agent | React/TS boilerplate, component creation |
| Debugging | Ask | Investigating specific API behaviour without changing code |
| Evidence chain design | Plan | Schema design before implementation |

### 10.2 Subagent Strategy

The four analysts are designed to map directly to subagent invocations:

```
orchestrator.analyze() calls:
  asyncio.gather(
    bug_analyst.analyze(repo_context, doc_context),
    test_analyst.analyze(repo_context, doc_context),
    config_analyst.analyze(repo_context, doc_context),
    doc_analyst.analyze(repo_context, doc_context)
  )
```

In the Bob development workflow, each analyst design session can be a separate subagent exploration, then results are synthesized in the parent context.

### 10.3 Agentic Iteration Loop

The repair → test → verify cycle is designed to demonstrate agentic iteration:

```
1. Agent applies repair
2. Agent runs pytest subprocess
3. Agent reads test output
4. If FAILED: Agent reads error, generates corrected diff, repeats (max 2 retries)
5. If PASSED: Agent runs verification agent pass
6. Records final status
```

The key requirement: the loop must actually run, not simulate. The pytest output must be real.

### 10.4 Document Understanding

`doc_parser.py` will use structured text extraction to process:
- `sample_repo/README.md` — extract API descriptions, parameter documentation
- `sample_repo/ARCHITECTURE.md` — extract design constraints and interface contracts
- `sample_repo/ISSUE_REPORT.md` — extract reported symptoms and reproduction steps
- `sample_repo/CHANGELOG.md` — extract version history and behavioural changes

Extracted requirements are stored in `DocumentContext.requirements_found` and used by both the Doc Analyst (for inconsistency detection) and Bug Analyst (for contract violations).

---

## 11. Implementation Phases

### Phase 1 — Foundation

**Objective:** Working FastAPI server with all routes returning stub data. No analysis logic yet.

**Files created:**
- `backend/main.py`
- `backend/config.py` (includes `SAMPLE_REPO_PATH` and `DEMO_REPO_NAME`)
- `backend/requirements.txt`
- `backend/models/` (all Pydantic models including `RepositorySelection`)
- `backend/routers/` (all routers, stub responses)
- `backend/data/` (empty JSON files)

**Dependencies:** None.

**Acceptance criteria:**
- `uvicorn backend.main:app --reload` starts without errors
- `GET /api/analysis/status` returns `{"status": "IDLE"}`
- OpenAPI docs accessible at `http://localhost:8000/docs`
- All model imports resolve without errors

**Risk:** Low. Pure scaffolding.

---

### Phase 2 — Repository Selection and Validation

**Objective:** Implement repository source selection and validation. Both DEMO and LOCAL paths must be validated and resolve to an absolute path before analysis can start.

**Files created/modified:**
- `backend/services/repo_validator.py` — validates a path for LOCAL; resolves DEMO from config
- `backend/routers/repositories.py` — wires `GET /api/repositories/demo` and `POST /api/repositories/validate`
- `backend/models/analysis.py` — `RepositorySelection`, updated `StartAnalysisRequest`, updated `StartAnalysisResponse`

**Acceptance criteria:**
- `GET /api/repositories/demo` returns name, path, and description of `sample_repo/`
- `POST /api/repositories/validate` with a valid directory returns `{"valid": true}`
- `POST /api/repositories/validate` with a non-existent path returns `{"valid": false, "reason": "path does not exist"}`
- `POST /api/repositories/validate` with a directory containing no supported files returns `{"valid": false, "reason": "no supported source files found"}`
- Validation uses `pathlib.Path` throughout — no hard-coded Unix separators
- Git metadata is not required for validation to pass

**Risk:** Low.

---

### Phase 3 — Demo Repository (spectral)

**Objective:** Create the `spectral` sample repository with all intentional defects in place. This is the bundled Demo Repository.

**Files created:**
- `sample_repo/spectral/__init__.py`
- `sample_repo/spectral/analyzer.py` (contains Defect 1)
- `sample_repo/spectral/pipeline.py` (contains Defect 2)
- `sample_repo/spectral/transforms.py`
- `sample_repo/spectral/utils.py` (contains dead code)
- `sample_repo/tests/test_analyzer.py` (sparse — missing Test Gap 1)
- `sample_repo/tests/test_pipeline.py` (sparse — missing Test Gap 2)
- `sample_repo/README.md` (contains doc inconsistency)
- `sample_repo/ARCHITECTURE.md`
- `sample_repo/CHANGELOG.md`
- `sample_repo/ISSUE_REPORT.md`
- `sample_repo/requirements.txt` (contains old numpy pin)

**Dependencies:** Phase 1 complete.

**Acceptance criteria:**
- `pytest sample_repo/tests/` runs and passes (the existing sparse tests pass)
- Defect 1 is reproducible: a manual Python test confirms the peak detection bug triggers on non-zero-mean input
- Defect 2 is reproducible: manually calling `Pipeline.run()` with a failing step returns successfully without raising
- The doc inconsistency is textually present in `README.md`
- `sample_repo/` can be reset to its original defective state (for repeated demonstrations)

**Risk:** Low. The defects must be subtle enough not to be immediately obvious but reproducible.

---

### Phase 4 — Repository Scanner

**Objective:** `repo_scanner.py` produces a complete `RepoContext` from any directory path (DEMO or LOCAL).

**Files created/modified:**
- `backend/services/repo_scanner.py`
- `backend/routers/analysis.py` (wire `GET /api/analysis/repo-context`)

**Acceptance criteria:**
- Returns correct file count, line count, language breakdown for any valid repository directory
- Parses `requirements.txt` into `Dependency` objects when present
- Generates a readable file tree string
- All path operations use `pathlib.Path`

**Risk:** Low.

---

### Phase 5 — Document Parser

**Objective:** `doc_parser.py` extracts structured requirements from any repository's documentation.

**Files created/modified:**
- `backend/services/doc_parser.py`
- `backend/routers/analysis.py` (wire `GET /api/analysis/doc-context`)

**Acceptance criteria:**
- Extracts `SpectralAnalyzer.find_peaks` `threshold` parameter documentation from `README.md`
- Extracts at least one design constraint from `ARCHITECTURE.md`
- Populates `requirements_found` with `Requirement` objects referencing specific file+line
- Works on any repository that contains Markdown documentation (not hard-coded to `sample_repo/`)

**Risk:** Medium. Markdown parsing requires careful text extraction to avoid hallucinating requirements.

---

### Phase 6 — Parallel Analysts

**Objective:** All four analysts produce real findings from the selected repository.

**Files created/modified:**
- `backend/agents/bug_analyst.py`
- `backend/agents/test_analyst.py`
- `backend/agents/config_analyst.py`
- `backend/agents/doc_analyst.py`
- `backend/services/evidence_store.py`
- `backend/routers/findings.py` (wire all findings endpoints)

**Acceptance criteria:**
- `bug_analyst` produces Finding for Defect 1 (off-by-one) and Defect 2 (silent failure) with correct file+line evidence
- `test_analyst` produces Finding for Test Gap 1 and Test Gap 2
- `config_analyst` produces Finding for old numpy pin
- `doc_analyst` produces Finding for `threshold` parameter inconsistency
- `doc_analyst` produces Finding for dead `format_summary()` function
- `GET /api/findings` returns all 7 findings with correct severity and confidence
- `GET /api/findings/{id}/evidence-chain` returns evidence with file path and line number for each finding
- Analysts operate on the `repo_path` from the session — not a hard-coded path

**Risk:** High. This is the core analysis logic. AST parsing must be correct and findings must reference real lines.

---

### Phase 7 — Orchestrator and Session Management

**Objective:** `orchestrator.py` drives the full workflow from a single `POST /api/analysis/start` call, incorporating repository selection and validation as the first two steps.

**Files created/modified:**
- `backend/agents/orchestrator.py`
- `backend/routers/analysis.py` (wire `POST /api/analysis/start` with updated request schema)
- `backend/data/session.json`
- `backend/data/audit_log.json`

**Acceptance criteria:**
- `POST /api/analysis/start` with `{"source": "DEMO"}` resolves to `sample_repo/` and starts analysis
- `POST /api/analysis/start` with `{"source": "LOCAL", "repo_path": "/some/dir"}` validates then starts
- Session records `repo_source`, `repo_path`, and `repo_name`
- `GET /api/analysis/status` reflects SELECT_REPOSITORY and VALIDATE_REPOSITORY as the first two steps
- Step history is recorded with timestamps and agent names
- Analysis completes with `status: "COMPLETE"` and all findings populated

**Risk:** Medium. Async coordination and state management.

---

### Phase 8 — Repair Engine

**Objective:** Generate, approve, and apply repairs. All path handling is repository-root-relative and safe for both DEMO and LOCAL sources.

**Files created/modified:**
- `backend/services/repair_engine.py`
- `backend/routers/repairs.py` (wire all repair endpoints)
- `backend/agents/test_analyst.py` (extend: regression test generation)
- `backend/data/repairs.json`
- `backend/data/backups/` (runtime created)

**Acceptance criteria:**
- `GET /api/repairs` returns one `RepairTask` per finding with a valid unified diff
- Each diff is the minimal correct change (no collateral edits)
- `POST /api/repairs/{id}/approve` transitions to `APPROVED`
- `POST /api/repairs/{id}/execute` applies the patch and the patched file reads correctly
- A backup of each original file exists before the patch is applied
- All file paths are resolved with `pathlib.Path` and confirmed to be within the repository root before modification
- Path traversal outside the repository root is rejected with a logged error

**Risk:** High. Diff generation and application must be correct. Wrong diffs corrupt the repository.

---

### Phase 9 — Verification Engine

**Objective:** Run tests and independent re-analysis to produce `VerificationResult` per repair.

**Files created/modified:**
- `backend/services/verification_engine.py`
- `backend/agents/verifier.py`
- `backend/routers/verification.py`
- `backend/data/` (verification results written here)

**Acceptance criteria:**
- `POST /api/verification/run` runs `pytest` in subprocess with 30s timeout, using the session's `repo_path` as test root
- Each `VerificationResult` has `independent_finding_gone = true` for correctly repaired findings
- `final_status = "VERIFIED"` for the two logic defects and test gaps after correct repair
- If a repair is incorrect (tested manually by reverting), `final_status = "FAILED"`

**Risk:** High. Subprocess test execution, output parsing, and independent re-analysis must all work.

---

### Phase 10 — Health Score

**Objective:** Calculate BEFORE and AFTER health scores from actual evidence. Scoring logic is identical for DEMO and LOCAL repositories.

**Files created/modified:**
- `backend/services/health_scorer.py`
- `backend/routers/health.py`
- `backend/data/health_scores.json`

**Acceptance criteria:**
- `GET /api/health/before` returns a score calculated before any repairs, with `bug_health < 70`
- `GET /api/health/after` returns a higher overall score after verified repairs
- All dimension scores have `dimension_notes` explaining the deductions
- No score is hard-coded; changing a finding's severity changes the score
- No special scoring rules exist for DEMO vs LOCAL — the same evidence-based formula applies to both

**Risk:** Low. Pure calculation.

---

### Phase 11 — Metrics Collection

**Objective:** Record timing, counts, and deltas throughout the workflow. Metrics include `repo_source`.

**Files created/modified:**
- `backend/services/metrics_collector.py`
- `backend/routers/metrics.py`
- `backend/data/metrics.json`

**Acceptance criteria:**
- `GET /api/metrics` returns correct counts for findings, tests, and durations
- `repo_source` field is populated with `DEMO` or `LOCAL`
- `is_manual_baseline_estimated = true` for manual_baseline_s (we cannot measure manual effort)
- All timing values are wall-clock measurements from actual code execution
- The UI clearly labels values as OBSERVED or ESTIMATED

**Risk:** Low.

---

### Phase 12 — Frontend Scaffold

**Objective:** Working React + TypeScript + Vite + Tailwind app with routing and API client.

**Files created:**
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tailwind.config.ts`
- `frontend/tsconfig.json`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx` (routing with `react-router-dom`)
- `frontend/src/api/apiClient.ts`
- `frontend/src/api/repositoriesApi.ts` (demo metadata + validate endpoints)
- `frontend/src/components/AppShell.tsx`

**Acceptance criteria:**
- `npm run dev` starts Vite dev server on port 5173
- Navigation between pages works
- All API calls route through `apiClient.ts`
- Dark theme is applied globally via Tailwind

**Risk:** Low.

---

### Phase 13 — Frontend Pages and Repository Selection UI

**Objective:** Implement all 9 pages with full API integration, including the repository selection UI on the Analyze page.

**Files created:**
- All files under `frontend/src/pages/`
- All files under `frontend/src/components/`
- All remaining files under `frontend/src/api/`

**Build order within phase:**
1. `AnalyzePage` — repository selection UI first (Demo / Local options), then progress stream
2. `OverviewPage` — displays repository name, source badge, and path
3. `FindingsPage` (filterable table)
4. `EvidenceChainPage` (the signature feature — most important)
5. `RepairPlanPage` (approve/reject actions, shows repository name before execution)
6. `VerificationPage` (test results display)
7. `MetricsPage` (repo source indicator, OBSERVED/ESTIMATED labels)
8. `BobWorkflowPage` (static content populated after development)
9. `FinalReportPage` (summary + print)

**Acceptance criteria:**
- Analyze page shows "Demo Repository" and "Local Repository" options before analysis
- Selecting Demo immediately populates name and path from `GET /api/repositories/demo`
- Selecting Local shows path input with inline validation via `POST /api/repositories/validate`
- Both options lead to the same progress stream — no separate analysis pages
- Overview page shows Repository Name, Repository Source badge, Repository Path
- Metrics page labels all values as OBSERVED or ESTIMATED
- Every page loads without console errors
- Every API call uses the typed response interfaces
- Loading and error states are handled on every page
- Dark theme is consistent across all pages
- Evidence Chain page is fully functional for at least one finding end-to-end

**Risk:** Medium. Large surface area; prioritise Evidence Chain page above all others.

---

### Phase 14 — End-to-End Integration Test

**Objective:** Walk through the entire workflow from repository selection to Final Report, using both DEMO and LOCAL sources.

**Steps:**
1. Start backend: `uvicorn backend.main:app --reload`
2. Start frontend: `npm run dev`
3. Navigate to Overview — confirm idle state
4. Navigate to Analyze — select Demo Repository — click Start Analysis — watch all 15 steps complete
5. Navigate to Findings — confirm 7 findings present
6. Navigate to Evidence Chain — inspect one finding end-to-end
7. Navigate to Repair Plan — approve all MEDIUM repairs — execute
8. Navigate to Verification — run verification — confirm VERIFIED results
9. Navigate to Metrics — confirm health score improved, repo_source shows DEMO
10. Navigate to Final Report — confirm complete report renders
11. Reset session — navigate to Analyze — select a local directory — validate — start analysis — confirm same pipeline runs

**Acceptance criteria:** Steps 1–11 complete without errors. Both DEMO and LOCAL sources produce findings. Evidence chain shows full lifecycle for at least two findings.

**Risk:** Medium. Integration issues are expected; allocate time for debugging.

---

### Phase 15 — Demo Preparation

**Objective:** Polish, rehearse, and document.

**Tasks:**
- Update `BobWorkflowPage` with actual capabilities used during development
- Write `README.md` with setup instructions for evaluators
- Verify `sample_repo/` can be reset to its original defective state (for re-demo)
- Confirm the full DEMO workflow runs in under 60 seconds on a local machine
- Prepare 3-minute demo script: Select Demo Repo → Overview → Analyze → Evidence Chain → Repair → Verified
- Optionally demonstrate Local Repository selection on a secondary test directory

**Risk:** Low.

---

## 12. Hackathon Acceptance Criteria

### 12.1 Product Checklist

- [ ] Addresses a meaningful developer problem (software maintenance)
- [ ] Complete end-to-end workflow (repo in → verified report out)
- [ ] At least 2 logic defects detected in sample repo
- [ ] At least 2 test gaps detected
- [ ] At least 1 doc inconsistency detected
- [ ] Evidence chain traceable from finding to verification for every repaired finding
- [ ] Approval gate enforced (no repair executes without APPROVED status)
- [ ] Regression tests actually execute (not simulated)
- [ ] Independent verification runs separately from repair agent
- [ ] Health score calculated from evidence (not hard-coded)
- [ ] Before/after metrics displayed with observed/estimated distinction
- [ ] User can select the bundled Demo Repository
- [ ] User can select a Local Repository by path
- [ ] Local repository path is validated before analysis starts
- [ ] Demo and Local repositories use the same analysis pipeline
- [ ] Session records repository source (`DEMO` / `LOCAL`) and path
- [ ] Overview page shows repository name, source, and path
- [ ] Analysis never modifies repository files before repair approval
- [ ] Approved repairs are restricted to files within the selected repository root
- [ ] Repairs create file backups before modification
- [ ] Path traversal outside the repository root is rejected

### 12.2 Technical Checklist

- [ ] React + TypeScript + Vite frontend starts on port 5173
- [ ] Python + FastAPI backend starts on port 8000
- [ ] All 9 pages functional
- [ ] Evidence Chain page shows all 8 steps per finding
- [ ] Repair Plan page approve/reject actions work
- [ ] All API responses are typed (no `any` in TypeScript)
- [ ] Dark theme consistent across all pages
- [ ] No console errors in browser on any page
- [ ] No Python exceptions on any API call during demo flow
- [ ] JSON persistence files written and readable between restarts

### 12.3 IBM Bob Checklist

- [ ] Plan mode used for architecture (this document)
- [ ] Agent mode used for at least 3 implementation phases
- [ ] Ask mode used for at least 1 technical question
- [ ] Subagents used or demonstrated in orchestrator design
- [ ] Parallel tasks demonstrated (four analysts concurrent)
- [ ] Document understanding demonstrated (README parsing produces findings)
- [ ] Agentic iteration demonstrated (repair → test → fix → verify loop)
- [ ] `BobWorkflowPage` accurately records each capability actually used

### 12.4 Demo Quality Checklist

- [ ] Full demo runs in under 5 minutes
- [ ] Evidence Chain page is visually compelling
- [ ] Before/after health score improvement is visible and real
- [ ] At least one finding was caused by a doc inconsistency (not just code)
- [ ] The word "fabricated" does not apply to any displayed number

---

## 13. Risk and Fallback Plan

### 13.1 Priority Tiers

| Priority | Feature | Rationale |
|---|---|---|
| P0 | Demo repository works end-to-end | The guaranteed hackathon demonstration path |
| P0 | Local repository path can be selected and validated | Demonstrates general-purpose tool |
| P0 | Both sources enter the same analysis pipeline | Core architectural requirement |
| P0 | Evidence Chain page (at least 1 finding) | The signature feature |
| P0 | Repair + execution (at least 1 repair) | Must show automated repair working |
| P0 | Verification with real test execution | Distinguishes RepoMedic from other tools |
| P1 | All 7 findings detected | Richness of demo |
| P1 | Health score before/after | Visible impact metric |
| P1 | Polished dark UI | Hackathon presentation quality |
| P1 | Metrics page | Quantified improvement |
| P2 | Final Report PDF export | Nice to have |
| P2 | BobWorkflowPage content | Required but quick to fill in |
| P3 | Animation and transitions | Polish only |
| P3 | Full suite test runner | Coverage beyond the targeted regression tests |
| P3 | GitHub URL import or cloud repositories | Out of scope for MVP |
| P3 | Authentication or multi-user support | Out of scope for MVP |

### 13.2 Scope Reduction If Time Runs Short

**If Phase 6 (analysts) takes too long:**
- Reduce from 7 findings to 3 (Defect 1, Test Gap 1, Doc Inconsistency)
- Hardcode those 3 findings as fixtures while still running real verification

**If Phase 8 (repair engine) is unstable:**
- Use Python `pathlib` string replacement instead of `patch` subprocess
- Accept that the diff display is read-only and apply it via direct file write

**If Local Repository selection consumes too much time:**
- Keep Demo Repository support (P0 — do NOT remove)
- Reduce Local Repository to: manual path text input + path validation + analysis of that directory
- Do NOT implement GitHub or cloud support as a replacement

**If the frontend takes too long:**
- Complete Overview, Evidence Chain, and Repair Plan only
- Mark other pages as "coming soon" with placeholder content

**If Bob subagent coordination is complex:**
- Replace async `asyncio.gather()` with sequential analyst calls
- The parallel design is still documented; the demo explains the intent

### 13.3 Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| AST-based analysis misses defects | Medium | Design defects to be pattern-detectable, add explicit AST patterns |
| `patch` subprocess not available on Windows | Medium | Implement Python-native diff application via `pathlib` as primary — not a fallback |
| Pytest subprocess timeouts | Low | 30s timeout enforced, test files are small |
| Frontend TypeScript compilation errors | Low | Use strict tsconfig but fix errors incrementally |
| Sample repo defects too obvious or too subtle | Medium | Manually verify each defect is reproducible before Phase 6 |
| Bobcoins exhausted before completion | Medium | Use Ask mode for research, Agent mode for implementation only |
| Local repository contains a very large codebase | Low | Scanner imposes a file count limit; document this clearly in the UI |
| Path traversal in Local repair execution | Low | All paths resolved through `pathlib.Path.resolve()` and checked against repo root before write |

### 13.4 Estimated Bobcoin Budget

| Phase | Mode | Estimated Bobcoin Cost | Notes |
|---|---|---|---|
| Architecture (this plan) | Plan | Low | Already spent |
| Repository selection + validation | Agent | Low | Path validation, small service |
| Sample repo (bundled demo) | Agent | Low | Small files, straightforward |
| Backend scaffold | Agent | Low | Boilerplate |
| Document parser | Agent | Medium | String extraction logic |
| Four analysts | Agent | High | Most complex logic in the project |
| Repair engine | Agent | High | Diff generation + atomic application + path safety |
| Verification engine | Agent | Medium | Subprocess management |
| Health scorer | Agent | Low | Pure arithmetic |
| Frontend scaffold | Agent | Low | Boilerplate |
| Frontend pages + repo selection UI | Agent | High | 9 pages × components × API wiring + selection panel |
| Integration debug | Agent + Ask | Medium | Inevitable fixes |
| Demo prep | Agent | Low | Content updates |

**Total estimate:** The analysts, repair engine, and frontend pages are the largest consumers. Prioritise them for focused, targeted Agent sessions. Use Ask mode for any research tasks to conserve budget.

---

*This document is the implementation blueprint for RepoMedic AI. It is authoritative for all implementation decisions. When AGENTS.md and this document conflict, this document is more specific and takes precedence for implementation details. Update this document when architectural decisions change.*
