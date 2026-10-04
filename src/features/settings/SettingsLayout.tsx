import { NavLink, Outlet } from 'react-router'
import clsx from 'clsx'
import { PageHeader } from '../../components/ui'

const tabs = [
  { to: '', label: 'Workspace', end: true },
  { to: 'companies', label: 'Companies' },
  { to: 'queries', label: 'Queries' },
  { to: 'users', label: 'Users' },
]

export function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex gap-1 border-b border-border mb-5">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              clsx('px-3 py-2 text-sm -mb-px border-b-2', isActive ? 'border-accent text-text font-medium' : 'border-transparent text-text-muted hover:text-text')
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </>
  )
}
