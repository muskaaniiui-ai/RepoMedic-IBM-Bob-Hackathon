# RepoMedic AI — AGENTS.md

> **Tagline:** Diagnose. Repair. Verify. Ship.

---

## 1. Project Purpose

RepoMedic AI is an evidence-driven autonomous software maintenance platform built as a one-day hackathon MVP. It demonstrates how AI can improve the developer workflow across three domains:

1. **Application Maintenance** — automated discovery and repair of defects, misconfigurations, and dead code.
2. **Debugging** — structured, evidence-backed root-cause analysis rather than speculative patching.
3. **Testing** — gap detection, regression test generation, and automated pass/fail verification.

The platform takes a repository as input and produces an explainable, auditable chain of findings → evidence → repairs → verifications, never reporting a finding as resolved until independent verification passes.

---

## 2. Architecture Principles

### 2.1 MVP-First Constraints

- This is a **one-day hackathon prototype**. Every decision must favour a working end-to-end demo over unnecessary infrastructure.
- No databases, cloud services, authentication systems, Kubernetes, microservices, or external cloud APIs beyond what is genuinely needed.
- Everything must run **locally** with a single startup command per tier.
- Local JSON files or plain text files are the persistence layer. Keep it simple.

### 2.2 Tier Separation

```
┌──────────────────────────────┐
│   React + TypeScript + Vite  │  Frontend (port 5173)
│   Tailwind CSS + Lucide       │
└────────────┬─────────────────┘
             │ REST / JSON
┌────────────▼─────────────────┐
│   Python + FastAPI            │  Backend (port 8000)
│   AI Agent Orchestration      │
│   Local JSON persistence      │
└──────────────────────────────┘
```

- Frontend and backend communicate exclusively through typed REST APIs.
- The backend owns all AI orchestration, analysis, repair logic, and file I/O.
- The frontend is a pure consumer of backend API responses — it never reads the repository directly.

### 2.3 Core Analysis Workflow

```
Repository Input
  → Repository Understanding    (file tree, language detection, dependency graph)
  → Document Understanding      (README, changelogs, inline docs, comments)
  → Parallel Specialized Analysis
      ├── Bug Analyst
      ├── Test Analyst
      ├── Configuration / Security Analyst
      └── Documentation Analyst
  → Evidence Synthesis          (cross-analyst deduplication and correlation)
  → Prioritization              (risk-scored finding list)
  → Repair Plan                 (proposed changes with risk classification)
  → Human Approval Gate         (LOW / MEDIUM / HIGH — human must approve)
  → Repair Execution            (apply approved changes)
  → Regression Tests            (run existing + generated tests)
  → Independent Verification    (re-check original evidence, not just diff)
  → Evidence Chain              (full audit trail per finding)
  → Before / After Metrics      (health score delta, time delta)
```

No step may be skipped. Every transition must be recorded with a timestamp and the responsible agent/analyst identity.

---

## 3. Technology Choices

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | React 18 + TypeScript + Vite | Fast dev server, strong typing, widely understood |
| Styling | Tailwind CSS | Utility-first, no extra build steps, consistent dark theme |
| Icons | Lucide React | Clean, consistent, tree-shakeable |
| Backend framework | Python + FastAPI | Async-native, auto-generated OpenAPI docs, minimal boilerplate |
| Persistence | Local JSON files | Zero infrastructure, sufficient for hackathon scope |
| AI orchestration | Python agent layer (IBM Bob 2.0 demonstrated via actual workflow) | First-class tool use, subagents, parallel analysis |

Do not introduce ORMs, message queues, container orchestration, or cloud SDKs unless explicitly added in a future instruction.

---

## 4. Coding Conventions

### 4.1 General

- Prefer **explicit over implicit**. Name variables, functions, and files after what they actually do.
- Every public function/class must have a docstring or JSDoc comment.
- No commented-out code in committed files.
- No `TODO` comments left in production paths — convert them to tracked findings or delete them.

### 4.2 Frontend (TypeScript / React)

- All components are functional with hooks. No class components.
- Props interfaces are defined with `interface`, not `type`, unless union types are required.
- Components live in `frontend/src/components/`. Pages live in `frontend/src/pages/`.
- API calls are isolated in `frontend/src/api/` — no raw `fetch` calls inside components.
- All API response types are explicitly typed. No `any`.
- Use Tailwind utility classes directly on JSX elements. No separate CSS files unless unavoidable.
- Lucide icons are imported individually: `import { Search } from 'lucide-react'`.

### 4.3 Backend (Python / FastAPI)

- All route handlers live in `backend/routers/`.
- Business logic lives in `backend/services/`.
- AI agent logic lives in `backend/agents/`.
- Pydantic models define all request/response schemas in `backend/models/`.
- All endpoints return structured JSON — never raw strings.
- Use `async def` for all FastAPI route handlers.
- Configuration (ports, file paths, model names) lives in `backend/config.py`.
- Use Python type hints everywhere.

### 4.4 File Naming

- Frontend: `PascalCase` for components (`FindingsTable.tsx`), `camelCase` for utilities (`apiClient.ts`).
- Backend: `snake_case` for all Python files and identifiers.
- JSON persistence files: `snake_case` with a `.json` extension under `backend/data/`.

---

## 5. Testing Requirements

- The project contains a **sample repository** (`sample_repo/`) that is intentionally imperfect. This is the target repository RepoMedic analyzes.
- Tests generated by RepoMedic must be written to a `sample_repo/tests/` directory and be executable.
- Every repair applied to `sample_repo/` must have at least one corresponding regression test.
- Regression tests must be run automatically after each repair. Pass/fail must be recorded in the evidence chain.
- The backend must expose a `/api/verification/run` endpoint that executes regression tests and returns structured results.
- Do not hard-code expected test outcomes. Tests must actually execute.

---

## 6. Safety Requirements

### 6.1 Approval Gate

Every proposed repair must be assigned a risk level before execution:

| Risk Level | Criteria |
|---|---|
| `LOW` | Whitespace, comment, documentation, minor formatting |
| `MEDIUM` | Logic change, dependency update, configuration change |
| `HIGH` | Structural refactor, deletion of code, security-sensitive change |

No repair may be executed without an explicit approval action. `MEDIUM` and `HIGH` repairs require human confirmation in the UI. `LOW` repairs may be auto-approved only if that setting is explicitly enabled.

### 6.2 Repair Statuses

```
PROPOSED → APPROVED → IMPLEMENTED → VERIFIED
         ↘ REJECTED
                               ↘ FAILED
```

A repair in `IMPLEMENTED` state that fails regression testing transitions to `FAILED`, not `VERIFIED`. A failed repair must not be retried automatically — it must be re-planned.

### 6.3 No Silent Failures

Every agent action that fails must be logged with a reason. The UI must surface failures — never silently discard them.

---

## 7. Evidence Requirements

### 7.1 Evidence Chain Structure

Every finding carries a complete, immutable evidence chain:

```
Finding
  → Evidence          (exact file, line number, content, why it is a problem)
  → Requirement       (what the correct behaviour should be — from docs or convention)
  → Recommendation    (specific proposed action)
  → Code Change       (exact diff applied)
  → Regression Test   (test name, file, command)
  → Independent Verification  (re-check of original evidence after repair)
  → Final Status      (VERIFIED or FAILED with reason)
```

### 7.2 Evidence Rules

- Evidence must reference a specific **file path and line number**, not a vague description.
- A finding is **not resolved** merely because code was changed.
- A finding is resolved **only when all of the following are true**:
  1. Evidence supports the original finding.
  2. A repair was applied.
  3. Regression tests pass.
  4. The original symptom has been re-checked and confirmed absent.
  5. Independent verification passes.
- Evidence chain entries are **append-only** — no entry may be deleted or retroactively modified.

---

## 8. Repair and Verification Rules

1. Repairs are generated as **unified diffs**. The exact diff is stored in the evidence chain before application.
2. Repair application must be **atomic per finding** — either the full diff applies or nothing applies.
3. After application, a **new read** of the changed file must confirm the patch is present.
4. Regression tests are run in an isolated subprocess. Timeouts must be enforced (default: 30 seconds per test suite).
5. Independent verification re-runs the original analysis on the post-repair code — it does not just check the diff.
6. Verification is performed by a **different agent pass** than the one that proposed the repair, to avoid confirmation bias.
7. Health scores are recalculated from scratch after verification, not incrementally adjusted.

---

## 9. Health Score

The repository health score is a weighted composite of five dimensions:

| Dimension | Description |
|---|---|
| Bug Health | Absence of known bugs, null-safety violations, logic errors |
| Test Health | Coverage, presence of regression tests, passing rate |
| Documentation Health | README completeness, inline docs, changelog presence |
| Maintainability Health | Code complexity, duplication, dead code |
| Configuration Health | Environment safety, secrets hygiene, dependency freshness |

- Each dimension is scored 0–100 based on **actual evidence** from the repository.
- The overall score is a weighted average. Weights are configurable but default to equal (20% each).
- The score **must never be fabricated**. If analysis is incomplete, the dimension is marked `PENDING`, not scored.
- Before and after scores are displayed side-by-side in the Metrics page to show verified improvement.

---

## 10. Metrics

The Metrics page compares two states — before and after RepoMedic ran:

| Metric | Source |
|---|---|
| Analysis time | Measured wall-clock time per agent pass |
| Findings count | Before vs. after repair cycle |
| Tests count | Before vs. after test generation |
| Health score | Before vs. after recalculation |
| Repair status breakdown | Count per status (VERIFIED / FAILED / REJECTED) |

**Productivity numbers must never be fabricated.** If a metric cannot be measured, display `N/A` with an explanation. Do not invent comparison baselines.

---

## 11. UI Principles

### 11.1 Design Philosophy

- **Dark-first.** The default theme is dark. A light mode toggle is a stretch goal, not a priority.
- **Professional and dense but readable.** Target a developer-operations aesthetic — think observability dashboards, not marketing pages.
- **Responsive.** Must work at 1280px+ width. Mobile is a stretch goal.
- **Accessible.** Semantic HTML, sufficient colour contrast, keyboard-navigable primary actions.

### 11.2 Colour Palette (dark theme baseline)

| Token | Usage |
|---|---|
| `gray-950` / `gray-900` | Page and panel backgrounds |
| `gray-800` / `gray-700` | Cards, table rows, code blocks |
| `gray-400` / `gray-300` | Body text, secondary labels |
| `white` | Primary headings, active states |
| `emerald-400` / `emerald-500` | Healthy, verified, passing |
| `amber-400` / `amber-500` | Warnings, medium risk, pending |
| `red-400` / `red-500` | Bugs, failures, high risk |
| `blue-400` / `blue-500` | Information, links, IBM blue accents |
| `purple-400` / `purple-500` | AI agent actions, evidence chain |

### 11.3 Page Structure

| Page | Purpose |
|---|---|
| **Overview** | Repository summary card, health score gauge, quick stats |
| **Analyze** | Trigger analysis, progress stream, analyst status |
| **Findings** | Filterable, sortable findings table with severity badges |
| **Evidence Chain** | Per-finding drill-down through the full evidence chain |
| **Repair Plan** | Proposed repairs list, risk badges, approval/rejection actions |
| **Verification** | Post-repair verification status, test results |
| **Metrics** | Before/after comparison table and score delta |
| **IBM Bob Workflow** | Live documentation of which Bob 2.0 capabilities were used and how |
| **Final Report** | Exportable summary of the full analysis and repair cycle |

---

## 12. IBM Bob 2.0 Hackathon Requirements

The project must **genuinely demonstrate** the following IBM Bob 2.0 capabilities. Each capability used must appear on the **IBM Bob Workflow** page with a description of how it was actually used, not how it could theoretically be used.

| Capability | Intended Use in RepoMedic |
|---|---|
| **Agent mode** | Implementing the core analysis pipeline, repair execution, and verification logic |
| **Plan mode** | Designing the architecture, workflow, and evidence chain schema before coding |
| **Ask mode** | Querying Bob about FastAPI patterns, Tailwind conventions, and TypeScript types |
| **Subagents** | Running Bug Analyst, Test Analyst, Config Analyst, Docs Analyst in parallel |
| **Parallel tasks** | Simultaneous multi-analyst passes over the sample repository |
| **Document understanding** | Parsing README, inline documentation, and changelogs for requirement extraction |
| **Agentic iteration** | Repair → Test → Verify loop with automatic retry on failed verifications |

Do not claim a capability was demonstrated unless it was actually invoked during development of this project.

---

## 13. Project Directory Layout (target)

```
RepoMedic/
├── AGENTS.md                  ← This file
├── README.md                  ← Project overview for evaluators
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/               ← All API client functions
│       ├── components/        ← Shared UI components
│       └── pages/             ← One file per page listed in §11.3
├── backend/
│   ├── main.py                ← FastAPI app entrypoint
│   ├── config.py              ← Runtime configuration
│   ├── requirements.txt
│   ├── routers/               ← FastAPI route handlers
│   ├── services/              ← Business logic
│   ├── agents/                ← AI agent orchestration
│   ├── models/                ← Pydantic request/response schemas
│   └── data/                  ← JSON persistence files
└── sample_repo/               ← Intentionally imperfect target repository
    ├── (source files TBD)
    └── tests/                 ← Generated regression tests land here
```

---

## 14. Hackathon Execution Order

The following order is recommended to build a working end-to-end demo as fast as possible:

1. **`sample_repo/`** — Create the intentionally imperfect target repository.
2. **Backend scaffold** — FastAPI app, routers, and Pydantic models.
3. **Agent layer** — Repository understanding, then the four specialized analysts.
4. **Evidence chain** — Schema, persistence, and append-only API.
5. **Repair engine** — Diff generation, approval gate, application, and rollback.
6. **Verification engine** — Test runner, independent re-analysis, status update.
7. **Health score** — Calculation from evidence, before/after delta.
8. **Frontend scaffold** — Vite + React + Tailwind + routing.
9. **Pages** — Overview → Analyze → Findings → Evidence Chain → Repair Plan → Verification → Metrics → IBM Bob Workflow → Final Report.
10. **Integration** — Wire frontend API client to all backend endpoints.
11. **Polish** — Dark theme consistency, loading states, error surfaces.

---

*This file is the source of truth for all contributors and agents working on RepoMedic AI. Update it when architectural decisions change — do not let it drift from the actual implementation.*
