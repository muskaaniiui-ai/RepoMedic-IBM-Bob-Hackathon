import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ScanLine,
  AlertTriangle,
  Link2,
  Wrench,
  ShieldCheck,
  BarChart3,
  Cpu,
  FileText,
} from 'lucide-react'
import BackendStatus from './BackendStatus'

/** Navigation item descriptor for the sidebar. */
interface NavItem {
  path: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { path: '/analyze', label: 'Analyze', Icon: ScanLine },

  { path: '/findings', label: 'Findings', Icon: AlertTriangle },

  { path: '/evidence', label: 'Evidence Chain', Icon: Link2 },

  { path: '/repair-plan', label: 'Repair Plan', Icon: Wrench },

  { path: '/verification', label: 'Verification', Icon: ShieldCheck },

  { path: '/overview', label: 'Overview', Icon: LayoutDashboard },

  { path: '/metrics', label: 'Metrics', Icon: BarChart3 },

  { path: '/final-report', label: 'Final Report', Icon: FileText },

  { path: '/bob-workflow', label: 'IBM Bob Workflow', Icon: Cpu },
]

/** Persistent left-hand navigation sidebar. */
export default function Sidebar() {
  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 border-r border-gray-800 shrink-0">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-400 font-bold text-lg tracking-tight">RepoMedic</span>
          <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-medium">AI</span>
        </div>
        <p className="text-gray-500 text-xs leading-snug">Diagnose. Repair. Verify. Ship.</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-500/15 text-blue-300'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
              ].join(' ')
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — backend health */}
      <div className="px-5 py-4 border-t border-gray-800">
        <BackendStatus />
      </div>
    </aside>
  )
}
