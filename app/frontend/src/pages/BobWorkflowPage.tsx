import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  Brain,
  CheckCircle,
  ChevronRight,
  Circle,
  FileCode2,
  Play,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'

type WorkflowStep =
  | 'plan'
  | 'analyze'
  | 'repair'
  | 'verify'
  | 'report'

const STEPS: {
  id: WorkflowStep
  label: string
  description: string
  icon: typeof Brain
}[] = [
  {
    id: 'plan',
    label: 'Plan',
    description: 'Understand the repository and prepare a repair strategy.',
    icon: Brain,
  },
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Detect bugs, configuration issues, and quality problems.',
    icon: FileCode2,
  },
  {
    id: 'repair',
    label: 'Repair',
    description: 'Preview and apply safe automated repairs.',
    icon: Wrench,
  },
  {
    id: 'verify',
    label: 'Verify',
    description: 'Run tests and detect regressions.',
    icon: ShieldCheck,
  },
  {
    id: 'report',
    label: 'Report',
    description: 'Produce an auditable final development report.',
    icon: CheckCircle,
  },
]

export default function IBMWorkflowPage() {
  const { result, repairPreview, repairResult, verificationResult } =
    useAnalysis()

  const [activeStep, setActiveStep] = useState<WorkflowStep>('plan')
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState<WorkflowStep[]>([])

  const currentIndex = STEPS.findIndex((step) => step.id === activeStep)

  const stats = useMemo(() => {
    if (!result) {
      return {
        findings: 0,
        high: 0,
        medium: 0,
        low: 0,
      }
    }

    return {
      findings: result.summary.total,
      high: result.summary.high,
      medium: result.summary.medium,
      low: result.summary.low,
    }
  }, [result])

  useEffect(() => {
    if (result && !completed.includes('analyze')) {
      setCompleted((previous) => [...previous, 'analyze'])
    }
  }, [result, completed])

  useEffect(() => {
    if (repairResult && !completed.includes('repair')) {
      setCompleted((previous) => [...previous, 'repair'])
    }
  }, [repairResult, completed])

  useEffect(() => {
    if (verificationResult && !completed.includes('verify')) {
      setCompleted((previous) => [...previous, 'verify'])
    }
  }, [verificationResult, completed])

  function isCompleted(step: WorkflowStep) {
    return completed.includes(step)
  }

  function startWorkflow() {
    setRunning(true)
    setCompleted([])

    let index = 0

    const timer = setInterval(() => {
      if (index >= STEPS.length) {
        clearInterval(timer)
        setRunning(false)
        return
      }

      const step = STEPS[index]

      setActiveStep(step.id)

      setCompleted((previous) =>
        previous.includes(step.id)
          ? previous
          : [...previous, step.id],
      )

      index += 1
    }, 900)
  }

  function goToStep(step: WorkflowStep) {
    setActiveStep(step)
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>

            <div>
              <p className="text-blue-400 text-sm font-semibold">
                Agentic Development Workflow
              </p>

              <h1 className="text-3xl font-bold text-white">
                IBM Bob Workflow
              </h1>
            </div>
          </div>

          <p className="text-gray-400 max-w-3xl leading-relaxed">
            An interactive demonstration of how an AI-assisted software
            development workflow can move from planning and diagnosis
            through safe repair, verification, and reporting.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Bob-inspired workflow demonstration
          </div>
        </div>

        {/* Repository status */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Active Repository
              </p>

              <p
                className="text-gray-200 font-mono text-sm truncate"
                title={result?.repository_path}
              >
                {result?.repository_path ?? 'No repository analyzed yet'}
              </p>
            </div>

            {result ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm shrink-0">
                <CheckCircle className="w-4 h-4" />
                Ready
              </div>
            ) : (
              <Link
                to="/analyze"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
              >
                Analyze Repository
              </Link>
            )}
          </div>
        </div>

        {/* Workflow timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 overflow-hidden">

          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Agent Workflow
              </h2>

              <p className="text-gray-500 text-sm mt-1">
                Follow the repository through each development stage.
              </p>
            </div>

            <button
              onClick={startWorkflow}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {running ? 'Workflow Running...' : 'Start Workflow'}
            </button>
          </div>

          <div className="relative">

            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-7 h-px bg-gray-800" />

            <div className="relative grid grid-cols-5 gap-3">

              {STEPS.map((step, index) => {
                const Icon = step.icon
                const completedStep = isCompleted(step.id)
                const active = activeStep === step.id

                return (
                  <button
                    key={step.id}
                    onClick={() => goToStep(step.id)}
                    className="text-left group"
                  >
                    <div className="flex justify-center mb-3">

                      <div
                        className={`
                          relative z-10 w-14 h-14 rounded-full
                          border flex items-center justify-center
                          transition-all duration-500
                          ${
                            completedStep
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                              : active
                                ? 'bg-blue-500/15 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                                : 'bg-gray-950 border-gray-700 text-gray-600'
                          }
                        `}
                      >
                        {completedStep ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>
                    </div>

                    <div className="text-center">
                      <p
                        className={`text-sm font-semibold ${
                          active
                            ? 'text-blue-300'
                            : completedStep
                              ? 'text-emerald-300'
                              : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>

                      <p className="text-gray-600 text-xs mt-1 hidden md:block">
                        {step.description}
                      </p>
                    </div>

                    {index < STEPS.length - 1 && (
                      <ChevronRight className="hidden" />
                    )}
                  </button>
                )
              })}

            </div>
          </div>
        </div>

        {/* Active stage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">

            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                {(() => {
                  const Icon = STEPS[currentIndex]?.icon ?? Bot
                  return <Icon className="w-6 h-6 text-blue-400" />
                })()}
              </div>

              <div>
                <p className="text-blue-400 text-xs uppercase tracking-wider font-semibold">
                  Stage {currentIndex + 1} of {STEPS.length}
                </p>

                <h2 className="text-2xl font-bold text-white mt-1">
                  {STEPS[currentIndex]?.label}
                </h2>

                <p className="text-gray-400 text-sm mt-1">
                  {STEPS[currentIndex]?.description}
                </p>
              </div>
            </div>

            {/* Stage content */}
            {activeStep === 'plan' && (
              <Stage
                title="Planning Agent"
                text="Understand the repository, prioritize findings, and determine which actions are safe to automate."
                items={[
                  'Inspect repository structure',
                  'Understand detected findings',
                  'Prioritize high-impact issues',
                  'Separate safe repairs from manual review',
                ]}
              />
            )}

            {activeStep === 'analyze' && (
              <Stage
                title="Analysis Agent"
                text="RepoMedic scans the repository using its deterministic analyzer rules."
                items={[
                  `${stats.findings} findings detected`,
                  `${stats.high} high-severity issues`,
                  `${stats.medium} medium-severity issues`,
                  `${stats.low} low-severity issues`,
                ]}
              />
            )}

            {activeStep === 'repair' && (
              <Stage
                title="Repair Agent"
                text="Safe repairs can be previewed, reviewed, and applied while risky semantic changes remain under manual review."
                items={[
                  `${repairPreview?.changes?.length ?? 0} repair proposals available`,
                  'Preview changes before applying them',
                  'Create backups before modifications',
                  'Keep manual-review findings untouched',
                ]}
              />
            )}

            {activeStep === 'verify' && (
              <Stage
                title="Verification Agent"
                text="After repairs, RepoMedic runs tests and re-analyzes the repository to detect regressions and remaining findings."
                items={[
                  verificationResult
                    ? 'Verification completed'
                    : 'Verification pending',
                  'Run the project test suite',
                  'Re-run repository analysis',
                  'Compare before and after state',
                ]}
              />
            )}

            {activeStep === 'report' && (
              <Stage
                title="Reporting Agent"
                text="The workflow ends with an auditable record of findings, repairs, verification results, and repository health."
                items={[
                  'Health score',
                  'Priority findings',
                  'Repair status',
                  'Verification status',
                ]}
              />
            )}

          </div>

          {/* Agent activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">

            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-5 h-5 text-yellow-400" />

              <h3 className="text-white font-semibold">
                Agent Activity
              </h3>
            </div>

            <div className="space-y-4">

              <ActivityRow
                done={!!result}
                text="Repository analyzed"
              />

              <ActivityRow
                done={!!result}
                text={`${stats.findings} findings identified`}
              />

              <ActivityRow
                done={!!repairResult}
                text="Safe repairs applied"
              />

              <ActivityRow
                done={!!verificationResult}
                text="Regression verification"
              />

              <ActivityRow
                done={!!verificationResult}
                text="Final state generated"
              />

            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          <Metric
            label="Findings"
            value={stats.findings}
            icon={<AlertIcon />}
          />

          <Metric
            label="High"
            value={stats.high}
            icon={<Circle className="w-4 h-4 text-red-400" />}
          />

          <Metric
            label="Repairs"
            value={repairResult?.applied_count ?? 0}
            icon={<Wrench className="w-4 h-4 text-emerald-400" />}
          />

          <Metric
            label="Verified"
            value={verificationResult?.verified ?? 0}
            icon={<ShieldCheck className="w-4 h-4 text-blue-400" />}
          />

        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-3">

          <Link
            to="/findings"
            className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 text-sm"
          >
            Findings
          </Link>

          <Link
            to="/repair-plan"
            className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 text-sm"
          >
            Repair Plan
          </Link>

          <Link
            to="/verification"
            className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 text-sm"
          >
            Verification
          </Link>

          <Link
            to="/metrics"
            className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 text-sm"
          >
            Metrics
          </Link>

          <Link
            to="/final-report"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm"
          >
            Final Report
          </Link>

        </div>

      </div>
    </div>
  )
}

function Stage({
  title,
  text,
  items,
}: {
  title: string
  text: string
  items: string[]
}) {
  return (
    <div>
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 mb-5">
        <p className="text-gray-300 text-sm leading-relaxed">
          {text}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 text-sm"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-gray-300">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityRow({
  done,
  text,
}: {
  done: boolean
  text: string
}) {
  return (
    <div className="flex items-center gap-3">

      {done ? (
        <CheckCircle className="w-4 h-4 text-emerald-400" />
      ) : (
        <Circle className="w-4 h-4 text-gray-700" />
      )}

      <span
        className={`text-sm ${
          done ? 'text-gray-300' : 'text-gray-600'
        }`}
      >
        {text}
      </span>

    </div>
  )
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">

      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-gray-500 text-xs">
          {label}
        </span>
      </div>

      <p className="text-3xl font-bold text-white">
        {value}
      </p>

    </div>
  )
}

function AlertIcon() {
  return (
    <Circle className="w-4 h-4 text-amber-400" />
  )
}