import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { AnalyzeResponse } from '../api/analyze'
import type { RepairResponse, VerificationResponse } from '../api/repair'

/** Shape of the shared analysis state available across all pages. */
interface AnalysisContextValue {
  /** The most recent analysis result, or null if none has been run. */
  result: AnalyzeResponse | null
  /** The repository path currently entered by the user. */
  repositoryPath: string
  /** The most recent repair preview, or null if none has been run. */
  repairPreview: RepairResponse | null
  /** The most recent repair apply result, or null if none has been run. */
  repairResult: RepairResponse | null
  /** The most recent verification result, or null if none has been run. */
  verificationResult: VerificationResponse | null
  /** Replace the stored analysis result. */
  setResult: (result: AnalyzeResponse | null) => void
  /** Update the stored repository path. */
  setRepositoryPath: (path: string) => void
  /** Replace the stored repair preview. */
  setRepairPreview: (preview: RepairResponse | null) => void
  /** Replace the stored repair apply result. */
  setRepairResult: (result: RepairResponse | null) => void
  /** Replace the stored verification result. */
  setVerificationResult: (result: VerificationResponse | null) => void
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

interface AnalysisProviderProps {
  children: ReactNode
}

/** Provides shared analysis and repair state to the entire application. */
export function AnalysisProvider({ children }: AnalysisProviderProps) {
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [repositoryPath, setRepositoryPath] = useState(
    'C:\\Users\\user\\Desktop\\RepoMedic\\app\\sample_repo',
  )
  const [repairPreview, setRepairPreview] = useState<RepairResponse | null>(null)
  const [repairResult, setRepairResult] = useState<RepairResponse | null>(null)
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null)

  return (
    <AnalysisContext.Provider
      value={{
        result,
        setResult,
        repositoryPath,
        setRepositoryPath,
        repairPreview,
        setRepairPreview,
        repairResult,
        setRepairResult,
        verificationResult,
        setVerificationResult,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  )
}

/**
 * Returns the shared analysis context.
 * Must be used inside an AnalysisProvider.
 */
export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext)
  if (ctx === null) {
    throw new Error('useAnalysis must be used inside an AnalysisProvider')
  }
  return ctx
}
