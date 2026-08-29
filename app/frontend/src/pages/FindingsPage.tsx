import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpDown, Search } from 'lucide-react'
import type { Finding } from '../api/analyze'
import { useAnalysis } from '../context/AnalysisContext'

/** Allowed severity filter values. */
type SeverityFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'

/** Allowed sort columns. */
type SortKey = 'severity' | 'file_path' | 'check_id'

/** Severity sort order: HIGH first, then MEDIUM, then LOW. */
const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** Returns Tailwind classes for a severity badge. */
function severityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  return map[severity] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

/** Inline severity badge. */
function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${severityBadgeClass(severity)}`}
    >
      {severity}
    </span>
  )
}

/** A single row in the findings table. */
function FindingRow({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-gray-800 last:border-b-0">
      {/* Summary row */}
      <div
        className="flex items-start gap-3 px-5 py-4 hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
      >
        <div className="pt-0.5 shrink-0">
          <SeverityBadge severity={finding.severity} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium leading-snug">{finding.title}</p>
          <p className="text-gray-500 text-xs mt-0.5 truncate">
            <span className="text-gray-400 font-mono">{finding.check_id}</span>
            {' · '}
            {finding.file_path}
            {finding.line !== null ? `:${finding.line}` : ''}
          </p>
        </div>

        <Link
          to="/evidence"
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Evidence
        </Link>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 bg-gray-900/60">
          <p className="text-gray-400 text-sm leading-relaxed">
            {finding.explanation}
          </p>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Evidence
            </p>
            <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
              {finding.evidence}
            </pre>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Suggested fix
            </p>
            <p className="text-gray-400 text-sm">{finding.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Findings page — filter, search, and sort analysis results. */
export default function FindingsPage() {
  const { result } = useAnalysis()

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortAsc, setSortAsc] = useState(true)

  /** Toggle sort: clicking the same key reverses direction; clicking a new key sorts asc. */
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const visibleFindings = useMemo(() => {
    if (!result) return []

    let findings = [...result.findings]

    // Severity filter
    if (severityFilter !== 'ALL') {
      findings = findings.filter((f) => f.severity === severityFilter)
    }

    // Text search across check_id, title, file_path, explanation
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      findings = findings.filter(
        (f) =>
          f.check_id.toLowerCase().includes(q) ||
          f.title.toLowerCase().includes(q) ||
          f.file_path.toLowerCase().includes(q) ||
          f.explanation.toLowerCase().includes(q),
      )
    }

    // Sort
    findings.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'severity') {
        cmp =
          (SEVERITY_ORDER[a.severity] ?? 99) -
          (SEVERITY_ORDER[b.severity] ?? 99)
      } else if (sortKey === 'file_path') {
        cmp = a.file_path.localeCompare(b.file_path)
      } else {
        cmp = a.check_id.localeCompare(b.check_id)
      }
      return sortAsc ? cmp : -cmp
    })

    return findings
  }, [result, severityFilter, searchQuery, sortKey, sortAsc])

  // ── No analysis run yet ──────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-8 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          No analysis results yet
        </h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Run an analysis first to see findings here.
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

  const { summary, repository_path } = result

  // ── Analysis run, zero findings ──────────────────────────────────────────
  if (summary.total === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader repoPath={repository_path} summary={summary} />
        <div className="mt-10 flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-400">No findings — the repository looks clean.</p>
        </div>
      </div>
    )
  }

  // ── Normal results ────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader repoPath={repository_path} summary={summary} />

        {/* Controls */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by rule, title, file, or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Severity filter */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as SeverityFilter[]).map(
              (sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={[
                    'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                    severityFilter === sev
                      ? sev === 'HIGH'
                        ? 'bg-red-500/20 text-red-400'
                        : sev === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400'
                          : sev === 'LOW'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-gray-300',
                  ].join(' ')}
                >
                  {sev === 'ALL' ? `All (${summary.total})` : sev}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Sort controls */}
        <div className="mt-3 flex gap-3 text-xs text-gray-500">
          <span>Sort by:</span>
          {(['severity', 'file_path', 'check_id'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={[
                'flex items-center gap-1 hover:text-gray-300 transition-colors',
                sortKey === key ? 'text-gray-300' : '',
              ].join(' ')}
            >
              {key === 'file_path' ? 'File' : key === 'check_id' ? 'Rule' : 'Severity'}
              {sortKey === key && (
                <ArrowUpDown className={`w-3 h-3 ${sortAsc ? 'rotate-0' : 'rotate-180'}`} />
              )}
            </button>
          ))}
        </div>

        {/* Findings table */}
        <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {visibleFindings.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-500 text-sm">
              No findings match the current filter.
            </div>
          ) : (
            visibleFindings.map((finding, index) => (
              <FindingRow
                key={`${finding.check_id}-${finding.file_path}-${index}`}
                finding={finding}
              />
            ))
          )}
        </div>

        <p className="mt-3 text-xs text-gray-600">
          Showing {visibleFindings.length} of {summary.total} findings
        </p>
      </div>
    </div>
  )
}

/** Summary header shown at the top of the findings page. */
interface PageHeaderProps {
  repoPath: string
  summary: { total: number; high: number; medium: number; low: number }
}

function PageHeader({ repoPath, summary }: PageHeaderProps) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Findings</h1>
        <p className="text-gray-500 text-sm truncate" title={repoPath}>
          {repoPath}
        </p>
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
