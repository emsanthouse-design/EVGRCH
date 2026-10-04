import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { useRefreshNow, useRunStatus, invalidateAfterRun } from '../lib/hooks'
import { useAuth } from '../features/auth/AuthProvider'
import { relativeDays } from '../lib/format'

export function RefreshButton({ workspaceId }: { workspaceId: string }) {
  const { isAdmin } = useAuth()
  const run = useRunStatus(workspaceId)
  const refresh = useRefreshNow(workspaceId)
  const qc = useQueryClient()
  const lastStatus = useRef<string | undefined>(undefined)

  // When a run finishes, pull fresh data into every view.
  useEffect(() => {
    const s = run.data?.status
    if (lastStatus.current && (lastStatus.current === 'running' || lastStatus.current === 'queued') && s && s !== 'running' && s !== 'queued') {
      invalidateAfterRun(qc, workspaceId)
    }
    lastStatus.current = s
  }, [run.data?.status, qc, workspaceId])

  const active = run.data?.status === 'queued' || run.data?.status === 'running'
  const summary = (run.data?.summary ?? {}) as Record<string, { errors?: string[] }>
  const errorCount = Object.values(summary).reduce((n, s) => n + (s?.errors?.length ?? 0), 0)

  return (
    <div className="flex items-center gap-2">
      {run.data && !active && (
        <span className="text-xs text-text-faint" title={errorCount ? Object.values(summary).flatMap((s) => s.errors ?? []).join('\n') : undefined}>
          Last run {relativeDays(run.data.finished_at ?? run.data.created_at)}: {run.data.status}
          {errorCount ? ` (${errorCount} ${errorCount === 1 ? 'error' : 'errors'})` : ''}
        </span>
      )}
      {refresh.error && <span className="text-xs text-negative">{refresh.error.message}</span>}
      {isAdmin && (
        <Button size="sm" disabled={active || refresh.isPending} onClick={() => refresh.mutate()} title="Re-run the API collectors for this workspace">
          <RefreshCw size={14} className={active ? 'animate-spin' : ''} />
          {active ? 'Refreshing…' : 'Refresh now'}
        </Button>
      )}
    </div>
  )
}
