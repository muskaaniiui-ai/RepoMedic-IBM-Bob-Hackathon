import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { fetchHealth, type HealthResponse } from '../api/health'

type Status = 'loading' | 'ok' | 'error'

/** Displays the real-time backend health status fetched from GET /api/health. */
export default function BackendStatus() {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth()
      .then((res) => {
        setData(res)
        setStatus('ok')
      })
      .catch((err: Error) => {
        setError(err.message)
        setStatus('error')
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <Loader className="w-3 h-3 animate-spin" />
        <span>Checking backend…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-red-400 text-xs" title={error ?? undefined}>
        <XCircle className="w-3 h-3" />
        <span>Backend unreachable</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-emerald-400 text-xs" title={`${data?.service} v${data?.version}`}>
      <CheckCircle className="w-3 h-3" />
      <span>Backend {data?.status}</span>
    </div>
  )
}
