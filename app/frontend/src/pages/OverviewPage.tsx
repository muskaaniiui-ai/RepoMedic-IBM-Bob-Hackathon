import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  FileCode2,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'

const SEVERITY_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

function severityClass(severity: string) {
  const classes: Record<string, string> = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }

  return classes[severity] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

function getHealthScore(
  total: number,
  high: number,
  medium: number,
  low: number,
) {
  const score = Math.max(
    0,
    100 - high * 15 - medium * 7 - low * 3,
  )

  return score
}

function healthColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

export default function OverviewPage() {
  const { result } = useAnalysis()

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <Activity className="w-12 h-12 text-gray-600 mb-4" />

        <h2 className="text-xl font-semibold text-white mb-2">
          No analysis available
        </h2>

        <p className="text-gray-400 text-sm max-w-md mb-6">
          Analyze a repository first to see its health overview,
          findings, repair status, and verification progress.
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

  const { repository_path, summary, findings } = result

  const healthScore = getHealthScore(
    summary.total,
    summary.high,
    summary.medium,
    summary.low,
  )

  const affectedFiles = new Set(
    findings.map((finding) => finding.file_path),
  ).size

  const ruleIds = new Set(
    findings.map((finding) => finding.check_id),
  ).size

  const sortedFindings = [...findings]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 99) -
        (SEVERITY_ORDER[b.severity] ?? 99),
    )
    .slice(0, 5)

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-blue-400 text-sm font-semibold mb-1">
            RepoMedic AI
          </p>

          <h1 className="text-3xl font-bold text-white">
            Repository Overview
          </h1>

          <p
            className="text-gray-500 text-sm mt-2 truncate"
            title={repository_path}
          >
            {repository_path}
          </p>
        </div>

        {/* Health score + status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          <div className="md:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <p className="text-gray-300 font-medium">
                Repository Health
              </p>
            </div>

            <div className="flex items-end gap-2">
              <span
                className={`text-5xl font-bold ${healthColor(
                  healthScore,
                )}`}
              >
                {healthScore}
              </span>

              <span className="text-gray-500 mb-2">
                / 100
              </span>
            </div>

            <div className="mt-5 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full"
                style={{
                  width: `${healthScore}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <p className="text-gray-300 font-medium">
                Findings
              </p>
            </div>

            <p className="text-4xl font-bold text-white">
              {summary.total}
            </p>

            <p className="text-gray-500 text-sm mt-1">
              potential issues detected
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileCode2 className="w-5 h-5 text-purple-400" />
              <p className="text-gray-300 font-medium">
                Affected Files
              </p>
            </div>

            <p className="text-4xl font-bold text-white">
              {affectedFiles}
            </p>

            <p className="text-gray-500 text-sm mt-1">
              files require attention
            </p>
          </div>
        </div>

        {/* Severity summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">

          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Finding Severity
              </h2>

              <p className="text-gray-500 text-sm mt-1">
                Issues detected during repository analysis
              </p>
            </div>

            <Link
              to="/findings"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4">

            <div className="bg-gray-950 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 text-sm">
                High
              </p>

              <p className="text-3xl font-bold text-white mt-1">
                {summary.high}
              </p>
            </div>

            <div className="bg-gray-950 border border-amber-500/20 rounded-lg p-4">
              <p className="text-amber-400 text-sm">
                Medium
              </p>

              <p className="text-3xl font-bold text-white mt-1">
                {summary.medium}
              </p>
            </div>

            <div className="bg-gray-950 border border-blue-500/20 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                Low
              </p>

              <p className="text-3xl font-bold text-white mt-1">
                {summary.low}
              </p>
            </div>

          </div>
        </div>

        {/* Top findings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">

          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Priority Findings
              </h2>

              <p className="text-gray-500 text-sm mt-1">
                Highest-priority issues detected by RepoMedic
              </p>
            </div>

            <Link
              to="/findings"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Open Findings →
            </Link>
          </div>

          <div className="space-y-3">

            {sortedFindings.length === 0 ? (
              <div className="flex items-center gap-3 py-6 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span>
                  No findings detected. Repository looks healthy.
                </span>
              </div>
            ) : (
              sortedFindings.map((finding, index) => (
                <div
                  key={`${finding.check_id}-${finding.file_path}-${index}`}
                  className="bg-gray-950 border border-gray-800 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">

                    <span className="text-gray-600 text-sm font-mono mt-1">
                      #{index + 1}
                    </span>

                    <div className="flex-1 min-w-0">

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${severityClass(
                            finding.severity,
                          )}`}
                        >
                          {finding.severity}
                        </span>

                        <span className="text-gray-500 text-xs font-mono">
                          {finding.check_id}
                        </span>
                      </div>

                      <p className="text-white font-medium mt-2">
                        {finding.title}
                      </p>

                      <p className="text-gray-500 text-xs mt-1">
                        {finding.file_path}
                        {finding.line !== null
                          ? `:${finding.line}`
                          : ''}
                      </p>

                    </div>
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

        {/* Workflow */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              RepoMedic Workflow
            </h2>

            <p className="text-gray-500 text-sm mt-1">
              Diagnose → Repair → Verify → Report
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            <WorkflowCard
              number="1"
              title="Diagnose"
              description="Analyze the repository and identify issues."
              link="/findings"
              icon={<Activity className="w-5 h-5" />}
            />

            <WorkflowCard
              number="2"
              title="Repair"
              description="Preview and apply safe automated repairs."
              link="/repair-plan"
              icon={<Wrench className="w-5 h-5" />}
            />

            <WorkflowCard
              number="3"
              title="Verify"
              description="Run tests and check whether issues remain."
              link="/verification"
              icon={<ShieldCheck className="w-5 h-5" />}
            />

            <WorkflowCard
              number="4"
              title="Report"
              description="Review health metrics and the final report."
              link="/final-report"
              icon={<CheckCircle className="w-5 h-5" />}
            />

          </div>
        </div>

        {/* Rule information */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-xs">
            {ruleIds} unique rules triggered ·{' '}
            {affectedFiles} affected files ·{' '}
            {summary.total} total findings
          </p>
        </div>

      </div>
    </div>
  )
}

interface WorkflowCardProps {
  number: string
  title: string
  description: string
  link: string
  icon: React.ReactNode
}

function WorkflowCard({
  number,
  title,
  description,
  link,
  icon,
}: WorkflowCardProps) {
  return (
    <Link
      to={link}
      className="bg-gray-950 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
          {icon}
        </div>

        <div>
          <span className="text-gray-600 text-xs">
            Step {number}
          </span>

          <p className="text-white font-semibold">
            {title}
          </p>
        </div>
      </div>

      <p className="text-gray-500 text-xs leading-relaxed">
        {description}
      </p>
    </Link>
  )
}