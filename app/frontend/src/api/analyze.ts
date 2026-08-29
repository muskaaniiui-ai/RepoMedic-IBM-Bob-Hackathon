export interface Finding {
  check_id: string
  severity: string
  file_path: string
  line: number | null
  title: string
  explanation: string
  evidence: string
  suggestion: string
}

export interface AnalysisSummary {
  total: number
  high: number
  medium: number
  low: number
}

export interface AnalyzeResponse {
  repository_path: string
  summary: AnalysisSummary
  findings: Finding[]
}

export async function analyzeRepository(
  repositoryPath: string,
): Promise<AnalyzeResponse> {
  const response = await fetch('http://127.0.0.1:8000/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repository_path: repositoryPath,
    }),
  })

  if (!response.ok) {
    throw new Error(`Analysis failed with status ${response.status}`)
  }

  return response.json()
}