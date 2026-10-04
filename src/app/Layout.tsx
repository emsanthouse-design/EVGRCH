import { NavLink, Outlet, useNavigate, useParams } from 'react-router'
import clsx from 'clsx'
import { BarChart3, ClipboardList, FileText, LogOut, Search, Settings as SettingsIcon, Building2 } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkspace, useWorkspaces } from '../lib/hooks'
import { Spinner, ErrorNote } from '../components/ui'
import { createContext, useContext } from 'react'
import type { WorkspaceRow } from '../lib/models'

const WorkspaceContext = createContext<WorkspaceRow | null>(null)
export function useCurrentWorkspace(): WorkspaceRow {
  const ws = useContext(WorkspaceContext)
  if (!ws) throw new Error('No workspace in context')
  return ws
}

export function Layout() {
  const { slug } = useParams()
  const { profile, isAdmin, signOut } = useAuth()
  const workspaces = useWorkspaces()
  const workspace = useWorkspace(slug)
  const navigate = useNavigate()

  const nav = [
    { to: `/w/${slug}`, label: 'Scorecard', icon: BarChart3, end: true },
    { to: `/w/${slug}/search`, label: 'Search', icon: Search },
    { to: `/w/${slug}/companies`, label: 'Companies', icon: Building2 },
    { to: `/w/${slug}/entry`, label: 'Data entry', icon: ClipboardList, adminOrEditor: true },
    { to: `/w/${slug}/reports`, label: 'Reports', icon: FileText },
    { to: `/w/${slug}/settings`, label: 'Settings', icon: SettingsIcon, adminOnly: true },
  ]

  return (
    <div className="min-h-full flex">
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Presence Tracker</div>
          {workspaces.data && workspaces.data.length > 1 ? (
            <select
              className="mt-1 w-full bg-transparent font-semibold text-sm outline-none"
              value={slug}
              onChange={(e) => navigate(`/w/${e.target.value}`)}
            >
              {workspaces.data.map((w) => (
                <option key={w.id} value={w.slug}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 font-semibold text-sm truncate">{workspace.data?.name ?? '…'}</div>
          )}
        </div>
        <nav className="p-2 flex-1">
          {nav
            .filter((n) => (n.adminOnly ? isAdmin : true))
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm',
                    isActive ? 'bg-accent-soft text-accent font-medium' : 'text-text-muted hover:bg-surface-muted hover:text-text',
                  )
                }
              >
                <n.icon size={16} strokeWidth={1.75} />
                {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="p-3 border-t border-border text-xs">
          <div className="truncate text-text-muted" title={profile?.email}>
            {profile?.email}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-text-faint">{isAdmin ? 'Agency admin' : 'Client'}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1 text-text-muted hover:text-text">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6">
        {workspace.isLoading ? (
          <Spinner />
        ) : workspace.error ? (
          <ErrorNote error={workspace.error} />
        ) : workspace.data ? (
          <WorkspaceContext.Provider value={workspace.data}>
            <Outlet />
          </WorkspaceContext.Provider>
        ) : (
          <ErrorNote error={new Error('Workspace not found or you do not have access.')} />
        )}
      </main>
    </div>
  )
}
