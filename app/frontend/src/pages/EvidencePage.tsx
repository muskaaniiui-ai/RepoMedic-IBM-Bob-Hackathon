import { useAnalysis } from '../context/AnalysisContext'

function SeverityBadge({ severity }: { severity: string }) {
  const classes =
    severity === 'HIGH'
      ? 'bg-red-950 text-red-300 border-red-800'
      : severity === 'MEDIUM'
        ? 'bg-yellow-950 text-yellow-300 border-yellow-800'
        : 'bg-blue-950 text-blue-300 border-blue-800'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {severity}
    </span>
  )
}

export default function EvidencePage() {
  const { result } = useAnalysis()

  if (!result) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">
            Evidence Chain
          </h1>

          <p className="text-gray-400 mb-8">
            Review the evidence behind each repository finding.
          </p>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              No analysis available
            </h2>

            <p className="text-gray-400 mb-5">
              Run a repository analysis first to see the evidence chain.
            </p>

            <a
              href="/analyze"
              className="inline-block px-5 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500"
            >
              Go to Analyze
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">
          Evidence Chain
        </h1>

        <p className="text-gray-400 mb-2">
          Trace every finding from detected evidence to the recommended fix.
        </p>

        <p className="text-sm text-gray-500 mb-8">
          Repository: {result.repository_path}
        </p>

        <div className="space-y-6">
          {result.findings.map((finding, index) => (
            <div
              key={`${finding.check_id}-${finding.file_path}-${index}`}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      {finding.check_id} · {finding.file_path}
                      {finding.line !== null && `:${finding.line}`}
                    </p>

                    <h2 className="text-xl font-semibold text-white mt-2">
                      {finding.title}
                    </h2>
                  </div>

                  <SeverityBadge severity={finding.severity} />
                </div>
              </div>

              <div className="p-6 space-y-6">
                <section>
                  <p className="text-sm font-semibold text-gray-300 mb-2">
                    1. Finding
                  </p>

                  <p className="text-gray-400">
                    {finding.explanation}
                  </p>
                </section>

                <section>
                  <p className="text-sm font-semibold text-gray-300 mb-2">
                    2. Evidence
                  </p>

                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
                    {finding.evidence}
                  </pre>
                </section>

                <section>
                  <p className="text-sm font-semibold text-gray-300 mb-2">
                    3. Recommended Action
                  </p>

                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400">
                      {finding.suggestion}
                    </p>
                  </div>
                </section>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Rule
                    </p>
                    <p className="text-white font-medium mt-1">
                      {finding.check_id}
                    </p>
                  </div>

                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      File
                    </p>
                    <p className="text-white font-medium mt-1 break-all">
                      {finding.file_path}
                    </p>
                  </div>

                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Line
                    </p>
                    <p className="text-white font-medium mt-1">
                      {finding.line ?? 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {result.findings.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              No findings
            </h2>

            <p className="text-gray-400">
              The repository did not produce any findings to investigate.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}