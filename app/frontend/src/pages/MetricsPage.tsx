import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import type { Finding } from '../api/analyze'
import { useAnalysis } from '../context/AnalysisContext'
import type { VerificationResponse } from '../api/repair'

// ---------------------------------------------------------------------------
// Health-score calculation
// ---------------------------------------------------------------------------

const SCORE_PENALTY: Record<string, number> = { HIGH: 15, MEDIUM: 7, LOW: 3 }

/** Calculate a 0–100 health score from a list of findings. */
function calcHealthScore(findings: Finding[]): number {
  const penalty = findings.reduce(
    (acc, f) => acc + (SCORE_PENALTY[f.severity] ?? 0),
    0,
  )
  return Math.max(0, Math.min(100, 100 - penalty))
}

/** Colour class for the health-score number based on its value. */
function scoreColour(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

/** Section wrapper with a heading. */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      {children}
    </div>
  )
}

/** Simple stat card. */
function StatCard({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

/** Horizontal bar showing a count relative to a maximum. */
function HorizBar({
  label,
  count,
  max,
  barClass,
}: {
  label: string
  count: number
  max: number
  barClass: string
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300 truncate max-w-xs">{label}</span>
        <span className="text-gray-500 ml-3 shrink-0">{count}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetricsPage
// ---------------------------------------------------------------------------

/** Metrics page — health score, distributions, repair status, before/after. */
export default function MetricsPage() {
  const { result, repairResult, verificationResult } = useAnalysis()

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          No analysis available
        </h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Run an analysis first to see metrics here.
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

  // Derived metrics — computed once
  const healthScore = useMemo(() => calcHealthScore(findings), [findings])

  // After-repair health score from verification
  const afterScore = useMemo(() => {
    if (!verificationResult) return null
    // Re-calculate from the after finding count by scaling penalty proportionally
    const remainCount = verificationResult.remaining_count
    const totalCount = verificationResult.analyzer_before_count
    if (totalCount === 0) return 100
    const fraction = remainCount / totalCount
    return Math.round(Math.max(0, Math.min(100, 100 - (100 - healthScore) * fraction)))
  }, [verificationResult, healthScore])

  // Rule distribution: check_id → count, sorted highest first
  const ruleDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of findings) {
      counts[f.check_id] = (counts[f.check_id] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [findings])

  // Affected files: file_path → count, sorted highest first
  const fileDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of findings) {
      counts[f.file_path] = (counts[f.file_path] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [findings])

  const maxRuleCount = ruleDistribution[0]?.[1] ?? 1
  const maxFileCount = fileDistribution[0]?.[1] ?? 1

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Page heading */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Metrics</h1>
          <p className="text-gray-500 text-sm truncate" title={repository_path}>
            {repository_path}
          </p>
        </div>

        {/* Navigation shortcuts */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/findings"
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
          >
            View Findings
          </Link>
          <Link
            to="/repair-plan"
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
          >
            View Repair Plan
          </Link>
          <Link
            to="/verification"
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
          >
            View Verification
          </Link>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <Section title="Finding Summary">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total findings" value={summary.total} />
            <StatCard label="High" value={summary.high} valueClass="text-red-400" />
            <StatCard label="Medium" value={summary.medium} valueClass="text-amber-400" />
            <StatCard label="Low" value={summary.low} valueClass="text-blue-400" />
          </div>
        </Section>

        {/* ── Health score ───────────────────────────────────────────────── */}
        <Section title="Repository Health Score">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-end gap-3 mb-4">
              <p className={`text-6xl font-bold ${scoreColour(healthScore)}`}>
                {healthScore}
              </p>
              <p className="text-gray-500 text-lg mb-1">/ 100</p>
            </div>
            {/* Score bar */}
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  healthScore >= 80
                    ? 'bg-emerald-500'
                    : healthScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <p className="text-gray-500 text-xs mt-3">
              Calculated from findings: −15 per HIGH, −7 per MEDIUM, −3 per LOW.
              Score is clamped between 0 and 100.
            </p>
          </div>
        </Section>

        {/* ── Severity distribution ─────────────────────────────────────── */}
        <Section title="Severity Distribution">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <HorizBar
              label="HIGH"
              count={summary.high}
              max={summary.total || 1}
              barClass="bg-red-500"
            />
            <HorizBar
              label="MEDIUM"
              count={summary.medium}
              max={summary.total || 1}
              barClass="bg-amber-500"
            />
            <HorizBar
              label="LOW"
              count={summary.low}
              max={summary.total || 1}
              barClass="bg-blue-500"
            />
          </div>
        </Section>

        {/* ── Rule distribution ─────────────────────────────────────────── */}
        <Section title="Rule Distribution">
          {ruleDistribution.length === 0 ? (
            <p className="text-gray-500 text-sm">No findings.</p>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              {ruleDistribution.map(([ruleId, count]) => (
                <HorizBar
                  key={ruleId}
                  label={ruleId}
                  count={count}
                  max={maxRuleCount}
                  barClass="bg-purple-500"
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Affected files ────────────────────────────────────────────── */}
        <Section title="Affected Files">
          {fileDistribution.length === 0 ? (
            <p className="text-gray-500 text-sm">No findings.</p>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              {fileDistribution.map(([filePath, count]) => (
                <HorizBar
                  key={filePath}
                  label={filePath}
                  count={count}
                  max={maxFileCount}
                  barClass="bg-blue-500"
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Repair status ─────────────────────────────────────────────── */}
        <Section title="Repair Status">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Before repair" value={summary.total} />
            <StatCard
              label="Repairs applied"
              value={repairResult ? repairResult.applied_count : 0}
              valueClass={repairResult ? 'text-emerald-400' : 'text-gray-500'}
            />
            <StatCard
              label="Verified resolved"
              value={verificationResult ? verificationResult.resolved_count : 0}
              valueClass={verificationResult ? 'text-emerald-400' : 'text-gray-500'}
            />
            <StatCard
              label="Remaining"
              value={verificationResult ? verificationResult.remaining_count : summary.total}
              valueClass={verificationResult?.remaining_count === 0 ? 'text-emerald-400' : 'text-amber-400'}
            />
          </div>
          {!repairResult && (
            <p className="mt-3 text-xs text-gray-600">
              No repairs have been applied yet. All {summary.total} finding
              {summary.total !== 1 ? 's are' : ' is'} pending.
            </p>
          )}
          {repairResult && !verificationResult && (
            <p className="mt-3 text-xs text-gray-500">
              {repairResult.applied_count} repair(s) applied. Run verification to confirm results.
            </p>
          )}
        </Section>

        {/* ── Before / After comparison ─────────────────────────────────── */}
        <Section title="Before / After Comparison">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Before</p>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">Health score</span>
                  <span className={`text-2xl font-bold ${scoreColour(healthScore)}`}>{healthScore}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">Total findings</span>
                  <span className="text-2xl font-bold text-white">{summary.total}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">High</span>
                  <span className="text-xl font-bold text-red-400">{summary.high}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">Medium</span>
                  <span className="text-xl font-bold text-amber-400">{summary.medium}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">Low</span>
                  <span className="text-xl font-bold text-blue-400">{summary.low}</span>
                </div>
              </div>
            </div>

            {/* After */}
            {verificationResult ? (
              <AfterPanel vr={verificationResult} afterScore={afterScore ?? healthScore} />
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-60">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">After</p>
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-gray-400 text-sm font-medium mb-2">Not available yet</p>
                  <p className="text-gray-600 text-xs max-w-xs">
                    Repairs have not been applied or verified yet. After-metrics
                    will appear here once repairs are executed and independently verified.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>

      </div>
    </div>
  )
}

/** After-repair panel shown when verification results are available. */
function AfterPanel({ vr, afterScore }: { vr: VerificationResponse; afterScore: number }) {
  return (
    <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-6">
      <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-4">After (Verified)</p>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Health score</span>
          <span className={`text-2xl font-bold ${scoreColour(afterScore)}`}>{afterScore}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Total findings</span>
          <span className="text-2xl font-bold text-white">{vr.analyzer_after_count}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Resolved</span>
          <span className="text-xl font-bold text-emerald-400">{vr.resolved_count}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Remaining</span>
          <span className="text-xl font-bold text-amber-400">{vr.remaining_count}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Tests passed</span>
          <span className={`text-xl font-bold ${vr.tests_failed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {vr.tests_passed}
          </span>
        </div>
      </div>
    </div>
  )
}

