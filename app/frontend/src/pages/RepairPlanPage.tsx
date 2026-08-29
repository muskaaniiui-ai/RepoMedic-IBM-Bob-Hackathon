import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wrench, Eye, Play, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import type { Finding } from '../api/analyze'
import type { RepairChange, RepairResponse } from '../api/repair'
import { previewRepairs, applyRepairs } from '../api/repair'
import { useAnalysis } from '../context/AnalysisContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'Priority 1',
  MEDIUM: 'Priority 2',
  LOW: 'Priority 3',
}

function severityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  return map[severity] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

function priorityClass(severity: string): string {
  const map: Record<string, string> = {
    HIGH: 'text-red-500',
    MEDIUM: 'text-amber-500',
    LOW: 'text-blue-500',
  }
  return map[severity] ?? 'text-gray-500'
}

function statusBadge(status: string): JSX.Element {
  const configs: Record<string, { cls: string; label: string }> = {
    AUTO_REPAIRED: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Auto-repaired' },
    MANUAL_REVIEW: { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Manual review' },
    SKIPPED: { cls: 'bg-gray-700/50 text-gray-500 border-gray-600/30', label: 'Skipped' },
    FAILED: { cls: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Failed' },
    PROPOSED: { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Automatically repairable' },
  }
  const cfg = configs[status] ?? { cls: 'bg-gray-800 text-gray-400 border-gray-700', label: status }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
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

interface PreviewPanelProps {
  change: RepairChange
}

function PreviewPanel({ change }: PreviewPanelProps) {
  if (change.status === 'MANUAL_REVIEW') {
    return (
      <div className="mt-3 bg-amber-950/30 border border-amber-900/40 rounded-lg px-4 py-3 text-xs text-amber-300/90 leading-relaxed">
        <p className="font-semibold text-amber-400 mb-1">Manual review required</p>
        <p>{change.description}</p>
      </div>
    )
  }
  if (change.status === 'SKIPPED') {
    return (
      <div className="mt-3 bg-gray-800/50 border border-gray-700/40 rounded-lg px-4 py-3 text-xs text-gray-500">
        Skipped: {change.description}
      </div>
    )
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-gray-500 leading-relaxed">{change.description}</p>
      {change.old_text && change.old_text !== '(file does not exist)' && (
        <div>
          <p className="text-xs font-semibold text-red-400 mb-1">Before</p>
          <pre className="bg-red-950/30 border border-red-900/30 rounded-lg p-3 text-xs text-red-300 overflow-x-auto whitespace-pre-wrap">
            {change.old_text}
          </pre>
        </div>
      )}
      {change.new_text && change.new_text !== '(manual action required — see suggestion)' && (
        <div>
          <p className="text-xs font-semibold text-emerald-400 mb-1">After</p>
          <pre className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-3 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap">
            {change.new_text}
          </pre>
        </div>
      )}
    </div>
  )
}

interface RepairCardProps {
  finding: Finding
  index: number
  change: RepairChange | null
  showPreview: boolean
}

function RepairCard({ finding, index, change, showPreview }: RepairCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gray-600 text-sm font-mono shrink-0">#{index + 1}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={finding.severity} />
              <span className={`text-xs font-medium ${priorityClass(finding.severity)}`}>
                {PRIORITY_LABEL[finding.severity] ?? ''}
              </span>
              <span className="text-gray-600 text-xs font-mono">{finding.check_id}</span>
              {change && statusBadge(change.status)}
            </div>
            <p className="text-white font-semibold mt-1 leading-snug">{finding.title}</p>
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Problem</p>
          <p className="text-gray-400 text-sm leading-relaxed">{finding.explanation}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Evidence</p>
          <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
            {finding.evidence}
          </pre>
        </div>

        <div className="flex gap-3 bg-emerald-950/40 border border-emerald-900/50 rounded-lg p-4">
          <Wrench className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              Recommended repair
            </p>
            <p className="text-emerald-300 text-sm leading-relaxed">{finding.suggestion}</p>
          </div>
        </div>

        {showPreview && change && <PreviewPanel change={change} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Apply confirmation modal
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  autoCount: number
  manualCount: number
  fileCount: number
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ autoCount, manualCount, fileCount, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-7 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-3">Apply Safe Repairs?</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-5">
          RepoMedic will modify{' '}
          <span className="text-white font-semibold">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>.
          A backup will be created first.{' '}
          <span className="text-amber-400 font-medium">Manual-review findings will not be changed.</span>
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-4 py-3">
            <p className="text-emerald-400 font-semibold">{autoCount}</p>
            <p className="text-gray-400 text-xs mt-0.5">Safe repairs to apply</p>
          </div>
          <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg px-4 py-3">
            <p className="text-amber-400 font-semibold">{manualCount}</p>
            <p className="text-gray-400 text-xs mt-0.5">Manual review (untouched)</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
          >
            Apply Safe Repairs
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result banner
// ---------------------------------------------------------------------------

interface ApplyResultBannerProps {
  result: RepairResponse
}

function ApplyResultBanner({ result }: ApplyResultBannerProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <h3 className="text-white font-semibold">Repair run complete</h3>
      </div>
      <p className="text-gray-400 text-sm">{result.message}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-4 py-3">
          <p className="text-2xl font-bold text-emerald-400">{result.applied_count}</p>
          <p className="text-gray-400 text-xs mt-0.5">Repairs applied</p>
        </div>
        <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg px-4 py-3">
          <p className="text-2xl font-bold text-amber-400">{result.manual_review_count}</p>
          <p className="text-gray-400 text-xs mt-0.5">Manual review</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
          <p className="text-2xl font-bold text-gray-400">{result.skipped_count}</p>
          <p className="text-gray-400 text-xs mt-0.5">Skipped</p>
        </div>
        <div className="bg-red-950/30 border border-red-900/30 rounded-lg px-4 py-3">
          <p className="text-2xl font-bold text-red-400">{result.failed_count}</p>
          <p className="text-gray-400 text-xs mt-0.5">Failed</p>
        </div>
      </div>
      {result.backup_created && result.backup_path && (
        <div className="flex items-start gap-2 bg-blue-950/30 border border-blue-900/30 rounded-lg px-4 py-3 text-xs text-blue-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Backup created: {result.backup_path}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RepairPlanPage
// ---------------------------------------------------------------------------

export default function RepairPlanPage() {
  const {
    result,
    repositoryPath,
    repairPreview,
    setRepairPreview,
    repairResult,
    setRepairResult,
  } = useAnalysis()

  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingApply, setLoadingApply] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-8 text-center">
        <Wrench className="w-12 h-12 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No analysis available</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Run an analysis first to generate a repair plan.
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

  // Map check_id → change from preview
  const changeMap = new Map<string, RepairChange>()
  if (repairPreview) {
    for (const c of repairPreview.changes) {
      changeMap.set(c.check_id, c)
    }
  }
  if (repairResult) {
    for (const c of repairResult.changes) {
      changeMap.set(c.check_id, c)
    }
  }

  const autoCount = repairPreview
    ? repairPreview.changes.filter((c) => c.status === 'PROPOSED').length
    : 0
  const manualCount = repairPreview?.manual_review_count ?? 0

  // Unique files that will be touched
  const affectedFiles = repairPreview
    ? new Set(
        repairPreview.changes
          .filter((c) => c.safe_to_apply && c.status === 'PROPOSED')
          .map((c) => c.file_path),
      ).size
    : 0

  async function handlePreview() {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const preview = await previewRepairs(repositoryPath)
      setRepairPreview(preview)
      setShowPreview(true)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleApplyConfirmed() {
    setShowConfirm(false)
    setLoadingApply(true)
    setApplyError(null)
    try {
      const applied = await applyRepairs(repositoryPath)
      setRepairResult(applied)
      setRepairPreview(applied) // update the preview map too
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setLoadingApply(false)
    }
  }

  if (summary.total === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader repoPath={repository_path} summary={summary} />
        <div className="mt-10 py-16 text-center">
          <p className="text-gray-400">No findings — no repairs needed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader repoPath={repository_path} summary={summary} />

        {/* Action bar */}
        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <button
            onClick={handlePreview}
            disabled={loadingPreview || loadingApply}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Eye className="w-4 h-4" />
            {loadingPreview ? 'Generating preview…' : 'Preview Repairs'}
          </button>

          {repairPreview && !repairResult && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loadingApply || autoCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              {loadingApply ? 'Applying…' : `Apply ${autoCount} Safe Repair${autoCount !== 1 ? 's' : ''}`}
            </button>
          )}

          {repairResult && (
            <Link
              to="/verification"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Run Verification →
            </Link>
          )}

          {repairPreview && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700 hover:text-white transition-colors"
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          )}
        </div>

        {/* Preview / apply info banner */}
        {repairPreview && !repairResult && (
          <div className="mt-4 bg-blue-950/30 border border-blue-900/40 rounded-xl px-5 py-3 text-sm text-blue-300 flex items-start gap-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Preview only — repository not modified.{' '}
              <span className="text-emerald-400 font-medium">{autoCount} automatically repairable</span>,{' '}
              <span className="text-amber-400 font-medium">{manualCount} manual review</span>.
            </span>
          </div>
        )}

        {/* Errors */}
        {previewError && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl px-5 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {previewError}
          </div>
        )}
        {applyError && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl px-5 py-3 text-red-400 text-sm">
            <XCircle className="w-4 h-4 inline mr-2" />
            {applyError}
          </div>
        )}

        {/* Apply result banner */}
        {repairResult && (
          <div className="mt-4">
            <ApplyResultBanner result={repairResult} />
          </div>
        )}

        {/* Repair cards */}
        <div className="mt-8 space-y-5">
          {sortedFindings.map((finding, index) => (
            <RepairCard
              key={`${finding.check_id}-${finding.file_path}-${index}`}
              finding={finding}
              index={index}
              change={changeMap.get(finding.check_id) ?? null}
              showPreview={showPreview}
            />
          ))}
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <ConfirmModal
          autoCount={autoCount}
          manualCount={manualCount}
          fileCount={affectedFiles}
          onConfirm={handleApplyConfirmed}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  repoPath: string
  summary: { total: number; high: number; medium: number; low: number }
}

function PageHeader({ repoPath, summary }: PageHeaderProps) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Repair Plan</h1>
        <p className="text-gray-500 text-sm truncate" title={repoPath}>{repoPath}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Total</p>
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
    </>
  )
}
