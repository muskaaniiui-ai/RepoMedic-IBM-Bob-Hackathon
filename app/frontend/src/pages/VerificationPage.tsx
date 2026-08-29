import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Play } from 'lucide-react'
import { verifyRepairs } from '../api/repair'
import type { VerificationResponse, VerificationFindingDetail } from '../api/repair'
import { useAnalysis } from '../context/AnalysisContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function severityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  return map[severity] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${severityBadgeClass(severity)}`}>
      {severity}
    </span>
  )
}

function VerificationStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: JSX.Element; cls: string; label: string }> = {
    PASSED: {
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      label: 'Verified',
    },
    FAILED: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      cls: 'bg-red-500/15 text-red-400 border-red-500/30',
      label: 'Failed',
    },
    PARTIAL: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      label: 'Partial',
    },
    NOT_RUN: {
      icon: <Clock className="w-3.5 h-3.5" />,
      cls: 'bg-gray-700/50 text-gray-400 border-gray-600',
      label: 'Not run',
    },
  }
  const cfg = configs[status] ?? configs['NOT_RUN']
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

/** A single finding detail row in the verification result table. */
function FindingDetailRow({ detail, index }: { detail: VerificationFindingDetail; index: number }) {
  return (
    <div className={`flex items-start gap-3 px-5 py-4 border-b border-gray-800 last:border-0 ${detail.resolved ? '' : 'opacity-90'}`}>
      <span className="text-gray-600 text-sm font-mono shrink-0 pt-0.5">#{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 text-xs font-mono">{detail.check_id}</span>
          {detail.resolved ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" /> Remaining
            </span>
          )}
        </div>
        <p className="text-gray-300 text-sm mt-0.5 leading-snug">{detail.title}</p>
        <p className="text-gray-600 text-xs mt-0.5">{detail.file_path}{detail.line ? `:${detail.line}` : ''}</p>
      </div>
    </div>
  )
}

/** Collapsible test output panel. */
function TestOutputPanel({ output }: { output: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-300 hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium">Test output</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <pre className="px-5 pb-5 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap border-t border-gray-800 pt-3">
          {output || '(no output)'}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VerificationPage
// ---------------------------------------------------------------------------

export default function VerificationPage() {
  const {
    result,
    repositoryPath,
    repairResult,
    verificationResult,
    setVerificationResult,
  } = useAnalysis()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── No analysis run yet ───────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-8 text-center">
        <ShieldCheck className="w-12 h-12 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No analysis available</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Run an analysis first to see verification status here.
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

  const sortedFindings = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  )

  async function handleVerify() {
    setLoading(true)
    setError(null)
    try {
      const vr = await verifyRepairs(repositoryPath)
      setVerificationResult(vr)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Zero findings ─────────────────────────────────────────────────────────
  if (summary.total === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader repoPath={repository_path} summary={summary} verificationResult={verificationResult} />
        <div className="mt-10 py-16 text-center">
          <p className="text-gray-400">No findings — nothing to verify.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader repoPath={repository_path} summary={summary} verificationResult={verificationResult} />

        {/* Navigation shortcuts */}
        <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3">
            <Link
              to="/repair-plan"
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              ← Repair Plan
            </Link>
            <Link
              to="/metrics"
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              Metrics →
            </Link>
          </div>

          <button
            onClick={handleVerify}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors ${
              repairResult
                ? 'bg-purple-600 hover:bg-purple-500'
                : 'bg-gray-700 hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Play className="w-4 h-4" />
            {loading ? 'Running verification…' : 'Run Verification'}
          </button>
        </div>

        {/* Info banner if repairs haven't been applied yet */}
        {!repairResult && !verificationResult && (
          <div className="mt-4 flex gap-3 bg-amber-950/30 border border-amber-900/40 rounded-xl px-5 py-4">
            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-300/80 text-sm leading-relaxed">
              Repairs have not been applied yet. Apply safe repairs on the{' '}
              <Link to="/repair-plan" className="text-amber-400 hover:underline">Repair Plan</Link>{' '}
              page first, then run verification here.
            </p>
          </div>
        )}

        {/* Info banner */}
        {!verificationResult && (
          <div className="mt-4 flex gap-3 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-gray-400 text-sm leading-relaxed">
              Verification runs the repository's pytest suite, then re-runs the RepoMedic
              analyzer to compare before and after finding counts. A finding is marked resolved
              only when it no longer appears in the post-repair analysis.
            </p>
          </div>
        )}

        {/* Errors */}
        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl px-5 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        {/* Verification results */}
        {verificationResult && (
          <div className="mt-6 space-y-6">
            {/* Status banner */}
            <div className={`rounded-xl px-5 py-4 border flex items-start gap-3 ${
              verificationResult.verification_status === 'PASSED'
                ? 'bg-emerald-950/40 border-emerald-900/50'
                : verificationResult.verification_status === 'PARTIAL'
                  ? 'bg-amber-950/30 border-amber-900/40'
                  : 'bg-red-950/30 border-red-900/40'
            }`}>
              {verificationResult.verification_status === 'PASSED' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : verificationResult.verification_status === 'PARTIAL' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">
                    Verification {verificationResult.verification_status}
                  </span>
                  <VerificationStatusBadge status={verificationResult.verification_status} />
                </div>
                {verificationResult.regression_detected && (
                  <p className="text-red-300 text-sm">
                    ⚠ Regression detected — test failures after repair.
                  </p>
                )}
              </div>
            </div>

            {/* Before / After finding counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">Before findings</p>
                <p className="text-3xl font-bold text-white">{verificationResult.analyzer_before_count}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">After findings</p>
                <p className="text-3xl font-bold text-white">{verificationResult.analyzer_after_count}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">Resolved</p>
                <p className="text-3xl font-bold text-emerald-400">{verificationResult.resolved_count}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">Remaining</p>
                <p className="text-3xl font-bold text-amber-400">{verificationResult.remaining_count}</p>
              </div>
            </div>

            {/* Test results */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">Tests passed</p>
                <p className="text-3xl font-bold text-emerald-400">{verificationResult.tests_passed}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">Tests failed</p>
                <p className={`text-3xl font-bold ${verificationResult.tests_failed > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {verificationResult.tests_failed}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm mb-1">Regression</p>
                <p className={`text-3xl font-bold ${verificationResult.regression_detected ? 'text-red-400' : 'text-emerald-400'}`}>
                  {verificationResult.regression_detected ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* Per-finding details */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Finding Details</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {verificationResult.details.map((d, i) => (
                  <FindingDetailRow key={`${d.check_id}-${i}`} detail={d} index={i} />
                ))}
              </div>
            </div>

            {/* Test output */}
            {verificationResult.test_output && (
              <TestOutputPanel output={verificationResult.test_output} />
            )}
          </div>
        )}

        {/* Pending cards (when no verification result yet) */}
        {!verificationResult && (
          <div className="mt-6 space-y-5">
            {sortedFindings.map((finding, index) => (
              <div key={`${finding.check_id}-${finding.file_path}-${index}`}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-800">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-gray-600 text-sm font-mono shrink-0 pt-0.5">#{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={finding.severity} />
                        <span className="text-gray-600 text-xs font-mono">{finding.check_id}</span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                          <Clock className="w-3 h-3" />
                          Verification pending
                        </span>
                      </div>
                      <p className="text-white font-semibold mt-1.5 leading-snug">{finding.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {finding.file_path}{finding.line !== null ? `:${finding.line}` : ''}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/evidence"
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                  >
                    View Evidence
                  </Link>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Original problem</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{finding.explanation}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Proposed repair</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{finding.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  repoPath: string
  summary: { total: number; high: number; medium: number; low: number }
  verificationResult: VerificationResponse | null
}

function PageHeader({ repoPath, summary, verificationResult }: PageHeaderProps) {
  const verified = verificationResult?.resolved_count ?? 0
  const failed = verificationResult?.regression_detected ? verificationResult.tests_failed : 0
  const pending = verificationResult ? verificationResult.remaining_count : summary.total

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Verification</h1>
        <p className="text-gray-500 text-sm truncate" title={repoPath}>{repoPath}</p>
      </div>

      {/* Finding severity summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Total findings</p>
          <p className="text-3xl font-bold text-white">{summary.total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">High</p>
          <p className="text-3xl font-bold text-red-400">{summary.high}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Medium</p>
          <p className="text-3xl font-bold text-amber-400">{summary.medium}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Low</p>
          <p className="text-3xl font-bold text-blue-400">{summary.low}</p>
        </div>
      </div>

      {/* Verification status summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Requiring verification</p>
          <p className="text-3xl font-bold text-white">{pending}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Verified</p>
          <p className="text-3xl font-bold text-emerald-400">{verified}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Test failures</p>
          <p className="text-3xl font-bold text-red-400">{failed}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Pending</p>
          <p className="text-3xl font-bold text-amber-400">{pending}</p>
        </div>
      </div>
    </>
  )
}
