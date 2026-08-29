import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Printer, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import type { Finding } from '../api/analyze'
import { useAnalysis } from '../context/AnalysisContext'

// ---------------------------------------------------------------------------
// Constants and pure helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const SCORE_PENALTY: Record<string, number> = { HIGH: 15, MEDIUM: 7, LOW: 3 }

function calcHealthScore(findings: Finding[]): number {
  const penalty = findings.reduce(
    (acc, f) => acc + (SCORE_PENALTY[f.severity] ?? 0),
    0,
  )
  return Math.max(0, Math.min(100, 100 - penalty))
}

function scoreColour(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function severityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  return map[severity] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

/** Build the executive-summary sentence deterministically from the data. */
function buildExecutiveSummary(
  total: number,
  high: number,
  medium: number,
  low: number,
  affectedFiles: number,
): string {
  if (total === 0) {
    return 'RepoMedic found no issues in this repository. The codebase appears clean based on the current rule set.'
  }

  const filePart =
    affectedFiles === 1
      ? '1 affected file'
      : `${affectedFiles} affected files`

  const highPart =
    high === 0
      ? ''
      : high === 1
        ? '1 high-severity issue requires immediate attention'
        : `${high} high-severity issues require immediate attention`

  const medPart =
    medium === 0
      ? ''
      : medium === 1
        ? '1 medium-severity finding should be reviewed'
        : `${medium} medium-severity findings should be reviewed`

  const lowPart =
    low === 0
      ? ''
      : low === 1
        ? '1 low-severity finding was noted'
        : `${low} low-severity findings were noted`

  const details = [highPart, medPart, lowPart].filter(Boolean)
  const detailStr =
    details.length === 1
      ? details[0]
      : details.slice(0, -1).join(', ') + ', while ' + details[details.length - 1]

  return (
    `RepoMedic identified ${total} potential issue${total !== 1 ? 's' : ''} ` +
    `across ${filePart}. ${detailStr}.`
  )
}

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${severityBadgeClass(severity)}`}
    >
      {severity}
    </span>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-gray-800">
      {children}
    </h2>
  )
}

function NavButton({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
    >
      {label}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// FinalReportPage
// ---------------------------------------------------------------------------

/** Final Report page — full analysis summary with print support. */
export default function FinalReportPage() {
  const { result, repairResult, verificationResult } = useAnalysis()

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-8 text-center">
        <FileText className="w-12 h-12 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          No analysis available
        </h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Run an analysis first to generate the final report.
        </p>
        <Link
          to="/analyze"
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          Go to Analyze
        </Link>
      </div>
    )
  }

  const { summary, repository_path, findings } = result

  // Derived values — computed once per render
  const healthScore = useMemo(() => calcHealthScore(findings), [findings])

  const affectedFiles = useMemo(
    () => new Set(findings.map((f) => f.file_path)).size,
    [findings],
  )

  const sortedFindings = useMemo(
    () =>
      [...findings].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) -
          (SEVERITY_ORDER[b.severity] ?? 99),
      ),
    [findings],
  )

  const executiveSummary = useMemo(
    () =>
      buildExecutiveSummary(
        summary.total,
        summary.high,
        summary.medium,
        summary.low,
        affectedFiles,
      ),
    [summary, affectedFiles],
  )

  // ── Report ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* ── Page controls (not printed) ─────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex flex-wrap gap-2">
            <NavButton to="/analyze"    label="Analyze" />
            <NavButton to="/findings"   label="Findings" />
            <NavButton to="/evidence"   label="Evidence Chain" />
            <NavButton to="/repair-plan" label="Repair Plan" />
            <NavButton to="/verification" label="Verification" />
            <NavButton to="/metrics"    label="Metrics" />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>

        {/* ── Report header ───────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">
                RepoMedic AI
              </p>
              <h1 className="text-3xl font-bold text-white mb-1">
                Final Report
              </h1>
              <p
                className="text-gray-500 text-sm truncate max-w-xl"
                title={repository_path}
              >
                {repository_path}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Health Score</p>
              <p className={`text-5xl font-bold ${scoreColour(healthScore)}`}>
                {healthScore}
              </p>
              <p className="text-gray-600 text-xs mt-1">/ 100</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
              Analysis complete
            </span>
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────── */}
        <section>
          <SectionHeading>Summary</SectionHeading>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Total findings</p>
              <p className="text-3xl font-bold text-white">{summary.total}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">High</p>
              <p className="text-3xl font-bold text-red-400">{summary.high}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Medium</p>
              <p className="text-3xl font-bold text-amber-400">{summary.medium}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Low</p>
              <p className="text-3xl font-bold text-blue-400">{summary.low}</p>
            </div>
          </div>
        </section>

        {/* ── Executive summary ───────────────────────────────────────── */}
        <section>
          <SectionHeading>Executive Summary</SectionHeading>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-300 leading-relaxed">{executiveSummary}</p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Affected files</p>
                <p className="text-white font-semibold">{affectedFiles}</p>
              </div>
              <div>
                <p className="text-gray-500">Health score</p>
                <p className={`font-semibold ${scoreColour(healthScore)}`}>
                  {healthScore} / 100
                </p>
              </div>
              <div>
                <p className="text-gray-500">Rule IDs triggered</p>
                <p className="text-white font-semibold">
                  {new Set(findings.map((f) => f.check_id)).size}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Priority findings ───────────────────────────────────────── */}
        <section>
          <SectionHeading>Priority Findings</SectionHeading>
          {sortedFindings.length === 0 ? (
            <p className="text-gray-500 text-sm">No findings.</p>
          ) : (
            <div className="space-y-3">
              {sortedFindings.map((f, i) => (
                <div
                  key={`${f.check_id}-${f.file_path}-${i}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-gray-600 text-sm font-mono shrink-0 pt-0.5">
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-gray-500 text-xs font-mono">
                          {f.check_id}
                        </span>
                      </div>
                      <p className="text-white font-semibold leading-snug">
                        {f.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {f.file_path}
                        {f.line !== null ? `:${f.line}` : ''}
                      </p>
                      <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                        {f.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Recommended actions ─────────────────────────────────────── */}
        <section>
          <SectionHeading>Recommended Actions</SectionHeading>
          {sortedFindings.length === 0 ? (
            <p className="text-gray-500 text-sm">No actions required.</p>
          ) : (
            <ol className="space-y-3">
              {sortedFindings.map((f, i) => (
                <li
                  key={`action-${f.check_id}-${f.file_path}-${i}`}
                  className="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4"
                >
                  <span className="text-gray-600 font-mono text-sm shrink-0 pt-0.5">
                    {i + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-gray-400 text-xs font-mono">
                        {f.check_id}
                      </span>
                      <span className="text-gray-600 text-xs">
                        {f.file_path}
                        {f.line !== null ? `:${f.line}` : ''}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {f.suggestion}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ── Verification status ─────────────────────────────────────── */}
        <section>
          <SectionHeading>Verification Status</SectionHeading>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {verificationResult ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Repairs applied</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {repairResult?.applied_count ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Resolved</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {verificationResult.resolved_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Remaining</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {verificationResult.remaining_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Tests passed</p>
                    <p className={`text-2xl font-bold ${verificationResult.tests_failed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {verificationResult.tests_passed}
                    </p>
                  </div>
                </div>
                <div className={`flex items-start gap-2 rounded-lg px-4 py-3 ${
                  verificationResult.verification_status === 'PASSED'
                    ? 'bg-emerald-950/30 border border-emerald-900/40'
                    : verificationResult.verification_status === 'PARTIAL'
                      ? 'bg-amber-950/30 border border-amber-900/40'
                      : 'bg-red-950/30 border border-red-900/40'
                }`}>
                  {verificationResult.verification_status === 'PASSED' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : verificationResult.verification_status === 'PARTIAL' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <p className={`text-xs leading-relaxed ${
                    verificationResult.verification_status === 'PASSED'
                      ? 'text-emerald-300/80'
                      : verificationResult.verification_status === 'PARTIAL'
                        ? 'text-amber-300/80'
                        : 'text-red-300/80'
                  }`}>
                    Verification status: <strong>{verificationResult.verification_status}</strong>.{' '}
                    {verificationResult.regression_detected
                      ? 'Regression detected — test failures were recorded after repair.'
                      : `${verificationResult.resolved_count} finding(s) resolved, ${verificationResult.remaining_count} remaining.`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Repairs applied</p>
                    <p className="text-2xl font-bold text-gray-500">
                      {repairResult?.applied_count ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Manual review</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {repairResult?.manual_review_count ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Verified</p>
                    <p className="text-2xl font-bold text-gray-500">0</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Pending</p>
                    <p className="text-2xl font-bold text-amber-400">{summary.total}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/40 rounded-lg px-4 py-3">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-300/80 text-xs leading-relaxed">
                    {repairResult
                      ? `${repairResult.applied_count} repair(s) applied. Run verification on the Verification page to confirm results.`
                      : `Repairs have not been applied or verified yet. All ${summary.total} finding${summary.total !== 1 ? 's are' : ' is'} pending repair and independent verification.`}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Report footer ───────────────────────────────────────────── */}
        <div className="border-t border-gray-800 pt-6 flex items-center justify-between flex-wrap gap-4 text-xs text-gray-600">
          <span>Generated by RepoMedic AI · Diagnose. Repair. Verify. Ship.</span>
          <button
            onClick={() => window.print()}
            className="print:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-xs"
          >
            <Printer className="w-3 h-3" />
            Print Report
          </button>
        </div>

      </div>
    </div>
  )
}
