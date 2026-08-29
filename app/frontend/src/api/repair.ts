/** API types and functions for the repair and verification endpoints. */

const BASE = 'http://127.0.0.1:8000/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepairRequest {
  repository_path: string
  finding_ids?: string[]
  dry_run?: boolean
}

export interface RepairChange {
  check_id: string
  file_path: string
  line: number | null
  description: string
  old_text: string
  new_text: string
  /** PROPOSED | AUTO_REPAIRED | MANUAL_REVIEW | SKIPPED | FAILED */
  status: string
  safe_to_apply: boolean
}

export interface RepairResponse {
  repository_path: string
  dry_run: boolean
  changes: RepairChange[]
  applied_count: number
  skipped_count: number
  failed_count: number
  manual_review_count: number
  backup_created: boolean
  backup_path: string | null
  message: string
}

export interface VerificationFindingDetail {
  check_id: string
  file_path: string
  line: number | null
  title: string
  resolved: boolean
}

export interface VerificationResponse {
  repository_path: string
  tests_passed: number
  tests_failed: number
  analyzer_before_count: number
  analyzer_after_count: number
  resolved_count: number
  remaining_count: number
  regression_detected: boolean
  /** PASSED | FAILED | PARTIAL | NOT_RUN */
  verification_status: string
  details: VerificationFindingDetail[]
  test_output: string
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Preview proposed repairs — repository is NOT modified. */
export async function previewRepairs(
  repositoryPath: string,
  findingIds?: string[],
): Promise<RepairResponse> {
  const response = await fetch(`${BASE}/repair/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repository_path: repositoryPath,
      finding_ids: findingIds,
      dry_run: true,
    } satisfies RepairRequest),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(detail?.detail ?? `Preview failed with status ${response.status}`)
  }
  return response.json()
}

/** Apply safe automatic repairs to the repository. */
export async function applyRepairs(
  repositoryPath: string,
  findingIds?: string[],
): Promise<RepairResponse> {
  const response = await fetch(`${BASE}/repair/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repository_path: repositoryPath,
      finding_ids: findingIds,
      dry_run: false,
    } satisfies RepairRequest),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(detail?.detail ?? `Apply failed with status ${response.status}`)
  }
  return response.json()
}

/** Run post-repair verification: pytest + re-analysis. */
export async function verifyRepairs(
  repositoryPath: string,
): Promise<VerificationResponse> {
  const response = await fetch(`${BASE}/repair/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repository_path: repositoryPath,
    } satisfies RepairRequest),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(detail?.detail ?? `Verify failed with status ${response.status}`)
  }
  return response.json()
}
