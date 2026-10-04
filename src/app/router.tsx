import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { LoginPage } from '../features/auth/LoginPage'
import { Layout } from './Layout'
import { ScorecardPage } from '../features/scorecard/ScorecardPage'
import { DataEntryPage } from '../features/data-entry/DataEntryPage'
import { SettingsLayout } from '../features/settings/SettingsLayout'
import { WorkspaceSettings } from '../features/settings/WorkspaceSettings'
import { CompaniesSettings } from '../features/settings/CompaniesSettings'
import { QueriesSettings } from '../features/settings/QueriesSettings'
import { UsersSettings } from '../features/settings/UsersSettings'
import { useWorkspaces } from '../lib/hooks'
import { Spinner, EmptyState } from '../components/ui'
import { ComingSoon } from '../features/ComingSoon'

function RequireAuth() {
  const { loading, session, profile } = useAuth()
  if (loading) return <Spinner label="Signing you in…" />
  if (!session) return <Navigate to="/login" replace />
  if (!profile)
    return (
      <EmptyState
        title="Your account is not set up yet."
        body="You signed in, but no profile exists for this address. Ask an agency admin to invite you, then sign in again."
      />
    )
  return <Outlet />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to=".." replace />
  return <Outlet />
}

function Home() {
  const ws = useWorkspaces()
  if (ws.isLoading) return <Spinner />
  const first = ws.data?.[0]
  if (!first)
    return <EmptyState title="No workspaces yet." body="An agency admin needs to create the first workspace or grant you access to one." />
  return <Navigate to={`/w/${first.slug}`} replace />
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (!loading && session) return <Navigate to="/" replace />
  return <LoginPage />
}

const routes: RouteObject[] = [
  { path: '/login', element: <LoginRoute /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/w/:slug',
        element: <Layout />,
        children: [
          { index: true, element: <ScorecardPage /> },
          { path: 'search', element: <ComingSoon title="Search view" phase={2} body="Query-by-query rankings arrive with the SERP collector in Phase 2." /> },
          { path: 'companies', element: <ComingSoon title="Company detail" phase={3} body="Per-company history with trend lines arrives in Phase 3." /> },
          { path: 'companies/:companyId', element: <ComingSoon title="Company detail" phase={3} body="Per-company history with trend lines arrives in Phase 3." /> },
          { path: 'entry', element: <DataEntryPage /> },
          { path: 'reports', element: <ComingSoon title="Reports" phase={3} body="Frozen reports with PDF, CSV and chart exports arrive in Phase 3." /> },
          {
            element: <RequireAdmin />,
            children: [
              {
                path: 'settings',
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <WorkspaceSettings /> },
                  { path: 'companies', element: <CompaniesSettings /> },
                  { path: 'queries', element: <QueriesSettings /> },
                  { path: 'users', element: <UsersSettings /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
