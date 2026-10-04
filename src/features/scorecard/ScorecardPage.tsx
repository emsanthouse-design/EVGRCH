import { Fragment, useMemo } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import { AlertTriangle, Minus } from 'lucide-react'
import { useCurrentWorkspace } from '../../app/Layout'
import { useCompanies, useMetrics, useScorecard, useLatestRun } from '../../lib/hooks'
import { AREA_LABEL, AREA_ORDER, type CompanyWithProfiles, type MetricRow, type ScorecardCell, platformLabel } from '../../lib/models'
import { formatDate, formatDelta, formatValue, relativeDays } from '../../lib/format'
import { Badge, EmptyState, ErrorNote, PageHeader, Spinner } from '../../components/ui'
import { Button } from '../../components/Button'
import { useAuth } from '../auth/AuthProvider'

export function ScorecardPage() {
  const ws = useCurrentWorkspace()
  const { isAdmin } = useAuth()
  const companies = useCompanies(ws.id)
  const metrics = useMetrics()
  const cells = useScorecard(ws.id)
  const latestRun = useLatestRun(ws.id)

  const cellMap = useMemo(() => {
    const m = new Map<string, ScorecardCell>()
    for (const c of cells.data ?? []) m.set(`${c.company_id}:${c.metric_key}`, c)
    return m
  }, [cells.data])

  if (companies.isLoading || metrics.isLoading || cells.isLoading) return <Spinner />
  const err = companies.error || metrics.error || cells.error
  if (err) return <ErrorNote error={err} />

  const cos = companies.data ?? []
  const mets = (metrics.data ?? []).filter((m) => m.key !== 'branded_top_result_owner' || cellMap.size > 0)
  if (cos.length === 0)
    return (
      <>
        <PageHeader title="Scorecard" />
        <EmptyState
          title="No companies yet"
          body="Add the client and its competitors in Settings to start the scorecard."
          action={isAdmin ? <Link to="settings/companies"><Button>Add companies</Button></Link> : undefined}
        />
      </>
    )

  const lastManual = latest(cells.data ?? [], 'manual')
  const lastApi = latest(cells.data ?? [], 'api')
  const peers = cos.filter((c) => c.group !== 'benchmark')
  const benchmarks = cos.filter((c) => c.group === 'benchmark')
  const staleCount = (cells.data ?? []).filter((c) => c.is_stale).length

  return (
    <>
      <PageHeader
        title="Scorecard"
        subtitle={
          <span>
            {ws.name} against {cos.length - 1} {cos.length - 1 === 1 ? 'company' : 'companies'}.
            {lastManual && <> Manual data last entered {relativeDays(lastManual)}.</>}
            {lastApi ? <> API data last refreshed {relativeDays(lastApi)}.</> : <> No API data yet (Phase 2).</>}
            {latestRun.data && <> Last run: {latestRun.data.status}.</>}
          </span>
        }
        actions={
          <>
            {staleCount > 0 && (
              <Badge tone="warning" className="h-7 px-2.5">
                <AlertTriangle size={12} className="mr-1" /> {staleCount} stale {staleCount === 1 ? 'value' : 'values'}
              </Badge>
            )}
            {isAdmin && (
              <Link to="entry">
                <Button variant="secondary" size="sm">Enter data</Button>
              </Link>
            )}
            <Button size="sm" disabled title="Available in Phase 2 when API collectors are connected">
              Refresh now
            </Button>
          </>
        }
      />

      <div className="overflow-x-auto bg-surface border border-border rounded-lg shadow-sm">
        <table className="w-full border-collapse text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-surface text-left font-medium text-text-muted text-xs px-3 py-2.5 w-56 min-w-56">Metric</th>
              {peers.map((c, i) => (
                <CompanyHeader key={c.id} c={c} first={i === 0} />
              ))}
              {benchmarks.length > 0 && <th className="w-3 min-w-3 bg-surface-muted border-x border-border" aria-hidden />}
              {benchmarks.map((c) => (
                <CompanyHeader key={c.id} c={c} />
              ))}
            </tr>
          </thead>
          <tbody>
            {AREA_ORDER.map((area) => {
              const areaMetrics = mets.filter((m) => m.area === area)
              if (areaMetrics.length === 0) return null
              let lastPlatform: string | null | undefined = undefined
              return (
                <Fragment key={area}>
                  <tr className="bg-surface-muted/60">
                    <td colSpan={cos.length + 2} className="sticky left-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted border-y border-border">
                      {AREA_LABEL[area]}
                    </td>
                  </tr>
                  {areaMetrics.map((m) => {
                    const showPlatform = m.platform !== lastPlatform
                    lastPlatform = m.platform
                    return (
                      <tr key={m.key} className={clsx('border-b border-border/70 last:border-0', m.display_weight === 'secondary' && 'text-text-muted')}>
                        <th scope="row" className="sticky left-0 z-10 bg-surface text-left font-normal px-3 py-2 align-top">
                          {showPlatform && m.platform && <div className="text-[10px] uppercase tracking-wider text-text-faint mb-0.5">{platformLabel(m.platform)}</div>}
                          <div className={clsx(m.display_weight === 'secondary' ? 'text-xs' : 'text-sm text-text')}>{stripPlatform(m)}</div>
                        </th>
                        {peers.map((c) => (
                          <Cell key={c.id} metric={m} cell={cellMap.get(`${c.id}:${m.key}`)} />
                        ))}
                        {benchmarks.length > 0 && <td className="bg-surface-muted border-x border-border" aria-hidden />}
                        {benchmarks.map((c) => (
                          <Cell key={c.id} metric={m} cell={cellMap.get(`${c.id}:${m.key}`)} />
                        ))}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-faint mt-3">
        Each cell shows the latest value, the change since the previous entry, and when it was captured. Manual values older than {ws.stale_after_days} days are flagged.
        Secondary metrics (ratings, follower counts) are shown smaller on purpose.
      </p>
    </>
  )
}

function CompanyHeader({ c, first }: { c: CompanyWithProfiles; first?: boolean }) {
  return (
    <th
      className={clsx(
        'text-left font-medium px-3 py-2.5 align-bottom min-w-32',
        c.is_client && 'border-b-2 border-client',
        c.group === 'benchmark' && 'border-b-2 border-benchmark',
        first && 'border-l border-border',
      )}
    >
      <Link to={`companies/${c.id}`} className="hover:underline">
        <div className="text-sm">{c.short_name ?? c.name}</div>
      </Link>
      <div className="mt-0.5">
        {c.is_client ? <Badge tone="client">Client</Badge> : c.group === 'benchmark' ? <Badge tone="benchmark">Benchmark</Badge> : <span className="text-[11px] text-text-faint">{c.city}</span>}
      </div>
    </th>
  )
}

function Cell({ metric, cell }: { metric: MetricRow; cell: ScorecardCell | undefined }) {
  if (!cell)
    return (
      <td className="px-3 py-2 align-top text-text-faint">
        <Minus size={14} />
      </td>
    )
  const value = formatValue(metric, cell)
  const delta = formatDelta(metric, cell.delta_num)
  const deltaTone =
    !cell.delta_num || metric.direction === 'neutral' ? 'neutral' : (cell.delta_num > 0) === (metric.direction === 'higher_better') ? 'positive' : 'negative'
  const boolChanged = metric.value_type === 'boolean' && cell.prev_value_bool != null && cell.prev_value_bool !== cell.value_bool
  const dateChanged = metric.value_type === 'date' && cell.prev_value_date && cell.prev_value_date !== cell.value_date
  return (
    <td className={clsx('px-3 py-2 align-top', cell.is_stale && 'bg-warning-soft/60')} title={cell.is_stale ? 'Stale: this manual value is older than the workspace threshold' : undefined}>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={clsx(metric.display_weight === 'secondary' ? 'text-xs' : 'text-sm font-medium tabular-nums', metric.value_type === 'text' && 'font-normal italic line-clamp-2 max-w-48')}>
          {value || <Minus size={14} className="inline text-text-faint" />}
          {metric.unit && metric.value_type !== 'percent' && metric.value_type !== 'boolean' && metric.value_type !== 'text' && value ? <span className="text-[10px] text-text-faint ml-0.5">{metric.unit}</span> : null}
        </span>
        {delta && (
          <span className={clsx('text-[11px] tabular-nums', deltaTone === 'positive' && 'text-positive', deltaTone === 'negative' && 'text-negative', deltaTone === 'neutral' && 'text-text-faint')}>{delta}</span>
        )}
        {(boolChanged || dateChanged) && <span className="text-[11px] text-text-faint">changed</span>}
      </div>
      <div className={clsx('text-[11px] mt-0.5 flex items-center gap-1', cell.is_stale ? 'text-warning' : 'text-text-faint')}>
        {cell.is_stale && <AlertTriangle size={11} />}
        {formatDate(cell.captured_at, 'MMM d')}
        {cell.source === 'api' && <span className="uppercase text-[9px] tracking-wider">api</span>}
      </div>
    </td>
  )
}

function latest(cells: ScorecardCell[], source: 'manual' | 'api'): string | null {
  let best: string | null = null
  for (const c of cells) if (c.source === source && c.captured_at && (!best || c.captured_at > best)) best = c.captured_at
  return best
}

/** "Google owner response rate" → "Owner response rate" when the platform label is already shown. */
function stripPlatform(m: MetricRow): string {
  if (!m.platform) return m.label
  const p = platformLabel(m.platform)
  const short = m.platform.charAt(0).toUpperCase() + m.platform.slice(1)
  for (const prefix of [p, short, m.platform]) {
    if (m.label.startsWith(prefix + ' ')) {
      const rest = m.label.slice(prefix.length + 1)
      return rest.charAt(0).toUpperCase() + rest.slice(1)
    }
  }
  return m.label
}
