import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeRepository } from '../api/analyze'
import { uploadRepository } from '../api/repository'
import type { RepositoryUploadResponse } from '../api/repository'
import { useAnalysis } from '../context/AnalysisContext'
import { Upload, FolderOpen, FlaskConical, CheckCircle, AlertCircle, FileArchive } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntakeMode = 'upload' | 'local' | 'sample'

// ---------------------------------------------------------------------------
// The known absolute path to the bundled sample repository.
// The backend resolves this path at analysis time.
// ---------------------------------------------------------------------------

/** Analyze page — three intake options: Upload ZIP, Local Path, Sample Repository. */
export default function AnalyzePage() {
  const { result, setResult, repositoryPath, setRepositoryPath } = useAnalysis()
  const navigate = useNavigate()

  const [mode, setMode] = useState<IntakeMode>('sample')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sampleRepoPath, setSampleRepoPath] = useState<string | null>(null)

const loadSampleRepository = async () => {
  try {
    const response = await fetch('/api/sample-repository')
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Sample repository not available')
    }

    setSampleRepoPath(data.repository_path)
    setRepositoryPath(data.repository_path)
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Could not load sample repository',
    )
  }
}

  // Upload-specific state
  const [uploadInfo, setUploadInfo] = useState<RepositoryUploadResponse | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derived: what path will be analyzed?
  function getEffectivePath(): string {
    if (mode === 'upload' && uploadInfo) return uploadInfo.repository_path
    if (mode === 'sample') return sampleRepoPath ?? ''
    return repositoryPath
  }

  const effectivePath = getEffectivePath()
  const canAnalyze =
    !loading &&
    (mode === 'upload' ? uploadInfo !== null : effectivePath.trim().length > 0)

  // ---------------------------------------------------------------------------
  // Upload handlers
  // ---------------------------------------------------------------------------

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadError('Only .zip files are accepted.')
      return
    }
    setUploadError(null)
    setUploadInfo(null)
    setUploadProgress(0)
    try {
      const info = await uploadRepository(file, (pct) => setUploadProgress(pct))
      setUploadInfo(info)
      setUploadProgress(null)
    } catch (err) {
      setUploadProgress(null)
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  // ---------------------------------------------------------------------------
  // Analyze handler
  // ---------------------------------------------------------------------------

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)

    const path = getEffectivePath()
    if (mode === 'local') setRepositoryPath(path)

    try {
      const analysisResult = await analyzeRepository(path)
      setResult(analysisResult)
      // Update context path so other pages (RepairPlan, Verify…) know the repo
      setRepositoryPath(path)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while analyzing the repository.',
      )
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Analyze Repository</h1>
        <p className="text-gray-400 mb-8">
          Upload a ZIP of your Python repository, use the built-in sample, or provide a
          local path. RepoMedic will scan it for potential issues.
        </p>

        {/* ---- Intake mode selector ---- */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <IntakeModeCard
            active={mode === 'sample'}
            onClick={() => {
             setMode('sample')
             setError(null)
             loadSampleRepository()
             }}
            icon={<FlaskConical className="w-5 h-5" />}
            title="Use Sample Repository"
            description="Try RepoMedic with the built-in demo project — includes intentional issues."
            accent="emerald"
          />
          <IntakeModeCard
            active={mode === 'upload'}
            onClick={() => { setMode('upload'); setError(null) }}
            icon={<Upload className="w-5 h-5" />}
            title="Upload Repository"
            description="Upload a .zip archive of your own Python project."
            accent="blue"
          />
          <IntakeModeCard
            active={mode === 'local'}
            onClick={() => { setMode('local'); setError(null) }}
            icon={<FolderOpen className="w-5 h-5" />}
            title="Use Local Path"
            description="Enter a filesystem path to a Python repository on this machine."
            accent="purple"
          />
        </div>

        {/* ---- Mode-specific intake panels ---- */}

        {mode === 'sample' && (
          <div className="bg-gray-900 border border-emerald-800/40 rounded-xl p-6 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Sample Repository Ready</p>
                <p className="text-gray-400 text-sm mb-2">
                  The built-in <code className="text-emerald-300 bg-gray-800 px-1 rounded">sample_repo</code> contains
                  a small Python library with 7 intentional issues across bugs, documentation gaps,
                  configuration problems, and test coverage holes.
                </p>
                <p className="text-gray-500 text-xs font-mono">
                 {sampleRepoPath ?? 'Loading sample repository...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {mode === 'upload' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Upload Python repository (.zip)
            </label>

            {/* Drag-and-drop zone */}
            {!uploadInfo && uploadProgress === null && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  flex flex-col items-center justify-center gap-3
                  border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors
                  ${isDragOver
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30'
                  }
                `}
              >
                <FileArchive className="w-10 h-10 text-gray-500" />
                <div className="text-center">
                  <p className="text-gray-300 font-medium">Drop your .zip here</p>
                  <p className="text-gray-500 text-sm mt-1">or click to browse</p>
                </div>
                <p className="text-gray-600 text-xs">Maximum 100 MB · .zip only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            )}

            {/* Upload progress */}
            {uploadProgress !== null && (
              <div className="flex flex-col gap-2 py-4">
                <p className="text-gray-300 text-sm">Uploading… {uploadProgress}%</p>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload success */}
            {uploadInfo && (
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-emerald-300 font-semibold">Repository ready</p>
                    <p className="text-gray-300 text-sm mt-0.5">{uploadInfo.repository_name}.zip</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {uploadInfo.file_count} files · {uploadInfo.python_file_count} Python files · {uploadInfo.test_file_count} test files
                    </p>
                  </div>
                  <button
                    onClick={() => { setUploadInfo(null); setUploadError(null) }}
                    className="text-gray-500 hover:text-gray-300 text-xs"
                  >
                    Replace
                  </button>
                </div>
              </div>
            )}

            {/* Upload error */}
            {uploadError && (
              <div className="mt-3 flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}

        {mode === 'local' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Repository path (local filesystem)
            </label>
            <input
              type="text"
              value={repositoryPath}
              onChange={(e) => setRepositoryPath(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-purple-500"
              placeholder="C:\path\to\repository  or  /home/user/my-project"
            />
            <p className="text-gray-600 text-xs mt-2">
              The path must be accessible by the RepoMedic backend server.
            </p>
          </div>
        )}

        {/* ---- Analyze button ---- */}
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing…' : 'Analyze Repository'}
        </button>

        {/* ---- Error ---- */}
        {error && (
          <div className="mt-6 bg-red-950 border border-red-800 rounded-xl p-5">
            <h2 className="text-red-300 font-semibold mb-2">Analysis failed</h2>
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* ---- Analysis result summary ---- */}
        {result && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Analysis Complete</h2>
              <button
                onClick={() => navigate('/findings')}
                className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
              >
                View Findings →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-3xl font-bold text-white">{result.summary.total}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">High</p>
                <p className="text-3xl font-bold text-red-400">{result.summary.high}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Medium</p>
                <p className="text-3xl font-bold text-amber-400">{result.summary.medium}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Low</p>
                <p className="text-3xl font-bold text-blue-400">{result.summary.low}</p>
              </div>
            </div>

            <div className="space-y-4">
              {result.findings.map((finding, index) => (
                <div
                  key={`${finding.check_id}-${finding.file_path}-${index}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        {finding.check_id} · {finding.file_path}
                        {finding.line !== null && `:${finding.line}`}
                      </p>
                      <h3 className="text-lg font-semibold text-white mt-1">{finding.title}</h3>
                    </div>
                    <SeverityBadge severity={finding.severity} />
                  </div>
                  <p className="text-gray-400 mt-3">{finding.explanation}</p>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-300">Evidence</p>
                    <pre className="mt-1 bg-gray-950 rounded-lg p-3 text-sm text-gray-400 overflow-x-auto">
                      {finding.evidence}
                    </pre>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-300">Suggested fix</p>
                    <p className="text-gray-400 mt-1">{finding.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface IntakeModeCardProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
  accent: 'emerald' | 'blue' | 'purple'
}

function IntakeModeCard({ active, onClick, icon, title, description, accent }: IntakeModeCardProps) {
  const accentMap = {
    emerald: {
      border: active ? 'border-emerald-500' : 'border-gray-800',
      ring: active ? 'ring-1 ring-emerald-500/30' : '',
      iconBg: active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-800 text-gray-500',
      title: active ? 'text-emerald-300' : 'text-gray-300',
    },
    blue: {
      border: active ? 'border-blue-500' : 'border-gray-800',
      ring: active ? 'ring-1 ring-blue-500/30' : '',
      iconBg: active ? 'bg-blue-500/15 text-blue-400' : 'bg-gray-800 text-gray-500',
      title: active ? 'text-blue-300' : 'text-gray-300',
    },
    purple: {
      border: active ? 'border-purple-500' : 'border-gray-800',
      ring: active ? 'ring-1 ring-purple-500/30' : '',
      iconBg: active ? 'bg-purple-500/15 text-purple-400' : 'bg-gray-800 text-gray-500',
      title: active ? 'text-purple-300' : 'text-gray-300',
    },
  }
  const a = accentMap[accent]

  return (
    <button
      onClick={onClick}
      className={`
        text-left w-full p-5 rounded-xl border bg-gray-900
        transition-all duration-150 hover:border-gray-700
        ${a.border} ${a.ring}
      `}
    >
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${a.iconBg}`}>
        {icon}
      </div>
      <p className={`font-semibold text-sm mb-1 ${a.title}`}>{title}</p>
      <p className="text-gray-500 text-xs leading-relaxed">{description}</p>
    </button>
  )
}

/** Coloured severity badge. */
function SeverityBadge({ severity }: { severity: string }) {
  const classes: Record<string, string> = {
    HIGH: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  const cls = classes[severity] ?? 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls} shrink-0`}>
      {severity}
    </span>
  )
}
