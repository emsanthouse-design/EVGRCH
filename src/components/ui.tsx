import clsx from 'clsx'
import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={clsx('bg-surface border border-border rounded-lg shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'client' | 'benchmark'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-muted text-text-muted',
        tone === 'positive' && 'bg-positive-soft text-positive',
        tone === 'negative' && 'bg-negative-soft text-negative',
        tone === 'warning' && 'bg-warning-soft text-warning',
        tone === 'info' && 'bg-info-soft text-text-muted',
        tone === 'client' && 'bg-accent-soft text-client',
        tone === 'benchmark' && 'bg-warning-soft text-benchmark',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="font-medium">{title}</p>
      {body && <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center">
      <span className="h-4 w-4 rounded-full border-2 border-border-strong border-t-accent animate-spin" />
      {label}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return <div className="text-sm text-negative bg-negative-soft rounded-md px-3 py-2">{msg}</div>
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={clsx('underline decoration-border-strong hover:decoration-text', className)}>
      {children}
    </a>
  )
}
