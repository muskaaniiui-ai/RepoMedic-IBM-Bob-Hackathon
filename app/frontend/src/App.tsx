import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnalysisProvider } from './context/AnalysisContext'
import Sidebar from './components/Sidebar'
import OverviewPage from './pages/OverviewPage'
import AnalyzePage from './pages/AnalyzePage'
import FindingsPage from './pages/FindingsPage'
import EvidencePage from './pages/EvidencePage'
import RepairPlanPage from './pages/RepairPlanPage'
import VerificationPage from './pages/VerificationPage'
import MetricsPage from './pages/MetricsPage'
import BobWorkflowPage from './pages/BobWorkflowPage'
import FinalReportPage from './pages/FinalReportPage'

/**
 * Root application component.
 * Provides routing and the persistent sidebar shell.
 * AnalysisProvider makes analysis results available to all pages.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <div className="flex min-h-screen bg-gray-950 text-gray-300">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/analyze" replace />} />
              <Route path="/analyze" element={<AnalyzePage />} />
              <Route path="/findings" element={<FindingsPage />} />
              <Route path="/evidence" element={<EvidencePage />} />
              <Route path="/repair-plan" element={<RepairPlanPage />} />
              <Route path="/verification" element={<VerificationPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/bob-workflow" element={<BobWorkflowPage />} />
              <Route path="/final-report" element={<FinalReportPage />} />
            </Routes>
          </main>
        </div>
      </AnalysisProvider>
    </BrowserRouter>
  )
}