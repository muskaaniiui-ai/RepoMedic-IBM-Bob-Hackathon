/** API types and functions for the repository intake endpoint. */

const BASE = 'http://127.0.0.1:8000/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepositoryUploadResponse {
  /** Absolute server-side path to the extracted repository root. */
  repository_path: string
  /** Friendly name derived from the ZIP filename. */
  repository_name: string
  /** Total number of files extracted. */
  file_count: number
  /** Number of .py files found under the repository root. */
  python_file_count: number
  /** Number of test files (test_*.py or *_test.py). */
  test_file_count: number
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Upload a ZIP archive to the backend.
 * The backend extracts it, validates it as a Python repo, and returns metadata.
 * Does NOT start analysis — call analyzeRepository() separately with the
 * returned repository_path.
 */
export async function uploadRepository(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<RepositoryUploadResponse> {
  // Use XMLHttpRequest so we can report upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/repository/upload`)

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as RepositoryUploadResponse)
        } catch {
          reject(new Error('Invalid JSON response from upload endpoint.'))
        }
      } else {
        let detail = `Upload failed with status ${xhr.status}.`
        try {
          const body = JSON.parse(xhr.responseText) as { detail?: string }
          if (body.detail) detail = body.detail
        } catch {
          // ignore parse failure
        }
        reject(new Error(detail))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted.')))

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}
