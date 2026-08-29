/** Backend API base URL. Vite proxies /api to localhost:8000 during dev. */
const API_BASE = '/api'

/** Structured health check response from the backend. */
export interface HealthResponse {
  status: string
  service: string
  version: string
}

/**
 * Calls GET /api/health and returns the parsed response.
 * Throws an Error if the request fails or the server returns non-2xx.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<HealthResponse>
}
