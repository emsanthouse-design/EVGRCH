import { Fragment, useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronRight, Minus } from 'lucide-react'
import { useCurrentWorkspace } from '../../app/Layout'
import { useCompanies, useSearchQueries, useSerpData } from '../../lib/hooks'
import type { CompanyWithProfiles, QueryRow, SerpResultView } from '../../lib/models'
import { formatDate } from '../../lib/format'
import { Badge, EmptyState, ErrorNote, PageHeader, Spinner } from '../../components/ui'
import { RefreshButton } from '../../components/RefreshButton'

const GROUP_LABEL: Record<string, string> = { branded: 'Branded', category: 'Category', community: 'Community', buyer_situation: 'Buyer situation' }

export function SearchPage() {
  const ws = useCurrentWorkspace()
  const companies = useCompanies(ws.id)
  const queries = useSearchQueries(ws.id)
  const activeQueries = useMemo(() => (queries.data ?? []).filter((q) => q.is_active), [queries.data])
  const serp = useSerpData(ws.id, activeQueries.map((q) => q.id))
  const [open, setOpen] = useState<Set<string>>(new Set())

  if (companies.isLoading || queries.isLoading || serp.isLoading) return <Spinner />
  const err = companies.error || queries.error || serp.error
  if (err) return <ErrorNote error={err} />

  const cos = companies.data ?? []
  const latest = serp.data?.latest ?? []
  const previous = serp.data?.previous ?? []
  const byQuery = groupBy(latest, (r) => r.query_id!)
  const prevByQuery = groupBy(previous, (r) => r.query_id!)
  const capturedAt = latest.reduce<string | null>((best, r) => (r.captured_at && (!best || r.captured_at > best) ? r.captured_at : best), null)

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <>
      <PageHeader
        title="Search"
        subtitle={
          <>
            Where each company ranks for each tracked query, searched from {ws.search_location} on {ws.search_device}.
            {capturedAt ? ` Last captured ${formatDate(capturedAt, 'MMM d, h:mm a')}.` : ''}
          </>
        }
        actions={<RefreshButton workspaceId={ws.id} />}
      />
      {latest.length === 0 ? (
        <EmptyState
          title="No search data yet"
          body="Rankings appear after the first collector run. Agency admins can start one with Refresh now once the SERP provider credentials are set on the Netlify site."
        />
      ) : (
        <div className="overflow-x-auto bg-surface border border-border rounded-lg shadow-sm">
          <table className="w-full text-sm min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="text-left font-medium px-3 py-2.5 w-80 min-w-80 sticky left-0 bg-surface z-10">Query</th>
                {cos.map((c) => (
                  <th key={c.id} className={clsx('text-left font-medium px-3 py-2.5 min-w-24', c.is_client && 'border-b-2 border-client', c.group === 'benchmark' && 'border-b-2 border-benchmark')}>
                    {c.short_name ?? c.name}
                  </th>
                ))}
                <th className="text-left font-medium px-3 py-2.5 min-w-40">Top result</th>
              </tr>
            </thead>
            <tbody>
              {groupQueries(activeQueries).map(([group, qs]) => (
                <Fragment key={group}>
                  <tr className="bg-surface-muted/60">
                    <td colSpan={cos.length + 2} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted border-y border-border sticky left-0">
                      {GROUP_LABEL[group] ?? group}
                    </td>
                  </tr>
                  {qs.map((q) => {
                    const rows = byQuery.get(q.id) ?? []
                    const prevRows = prevByQuery.get(q.id) ?? []
                    const isOpen = open.has(q.id)
                    const top = rows.find((r) => r.result_type === 'organic' && r.position === 1)
                    const topCo = top?.matched_company_id ? cos.find((c) => c.id === top.matched_company_id) : null
                    const ads = rows.filter((r) => r.result_type === 'ad')
                    return (
                      <Fragment key={q.id}>
                        <tr className="border-b border-border/70 hover:bg-surface-muted/40">
                          <td className="px-3 py-2 sticky left-0 bg-surface z-10">
                            <button className="flex items-center gap-1.5 text-left" onClick={() => toggle(q.id)}>
                              {isOpen ? <ChevronDown size={14} className="text-text-faint shrink-0" /> : <ChevronRight size={14} className="text-text-faint shrink-0" />}
                              <span className={q.is_branded ? 'font-medium' : ''}>{q.phrase}</span>
                            </button>
                            <div className="ml-5 mt-0.5 flex gap-1 flex-wrap">
                              {q.is_branded && <Badge tone="client">Branded</Badge>}
                              {rows.some((r) => r.result_type === 'local_pack') && <Badge tone="info">Local pack</Badge>}
                              {ads.length > 0 && <Badge tone="warning">{ads.length} {ads.length === 1 ? 'ad' : 'ads'}</Badge>}
                              {rows.length === 0 && <span className="text-[11px] text-text-faint">not captured yet</span>}
                            </div>
                          </td>
                          {cos.map((c) => (
                            <RankCell key={c.id} company={c} rows={rows} prevRows={prevRows} />
                          ))}
                          <td className="px-3 py-2 text-xs">
                            {top ? (
                              topCo ? (
                                <span className={clsx('font-medium', topCo.is_client ? 'text-client' : '')}>{topCo.short_name ?? topCo.name}</span>
                              ) : (
                                <span className="text-text-muted">{top.domain}</span>
                              )
                            ) : (
                              <Minus size={14} className="text-text-faint" />
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border">
                            <td colSpan={cos.length + 2} className="px-3 py-3 bg-surface-muted/30">
                              <ResultList rows={rows} companies={cos} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-text-faint mt-3">
        Each cell shows the organic position (and the local-pack position with a map pin) plus the change since the previous capture. A dash means the company did not appear in the top 20.
        Expand a query to see the full captured results, including ads.
      </p>
    </>
  )
}

function RankCell({ company, rows, prevRows }: { company: CompanyWithProfiles; rows: SerpResultView[]; prevRows: SerpResultView[] }) {
  const organic = best(rows, company.id, 'organic')
  const local = best(rows, company.id, 'local_pack')
  const prevOrganic = best(prevRows, company.id, 'organic')
  const profile = rows.find((r) => r.matched_company_id === company.id && r.match_kind === 'third_party_profile')
  const delta = organic && prevOrganic ? prevOrganic.position! - organic.position! : organic && prevRows.length > 0 && !prevOrganic ? null : 0
  return (
    <td className={clsx('px-3 py-2 align-top tabular-nums', company.is_client && 'bg-accent-soft/20')}>
      {organic ? (
        <div className="flex items-baseline gap-1">
          <span className="font-medium">#{organic.position}</span>
          {delta ? <span className={clsx('text-[11px]', delta > 0 ? 'text-positive' : 'text-negative')}>{delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}</span> : null}
          {delta === null && <span className="text-[11px] text-positive">new</span>}
        </div>
      ) : profile ? (
        <span className="text-xs text-text-muted" title={profile.url ?? undefined}>
          #{profile.position} via {profile.domain}
        </span>
      ) : (
        <Minus size={14} className="text-text-faint" />
      )}
      {local && (
        <div className="text-[11px] text-text-muted" title="Local pack position">
          📍 {local.position}
          {local.rating != null && <span className="text-text-faint"> · {local.rating}★ ({local.review_count})</span>}
        </div>
      )}
    </td>
  )
}

function ResultList({ rows, companies }: { rows: SerpResultView[]; companies: CompanyWithProfiles[] }) {
  const sections: [string, SerpResultView[]][] = [
    ['Ads', rows.filter((r) => r.result_type === 'ad')],
    ['Local pack', rows.filter((r) => r.result_type === 'local_pack')],
    ['Organic', rows.filter((r) => r.result_type === 'organic')],
  ]
  return (
    <div className="grid gap-4 md:grid-cols-3 text-xs">
      {sections.map(([label, list]) => (
        <div key={label}>
          <div className="font-semibold text-text-muted mb-1.5">
            {label}
            {list.length === 0 && <span className="font-normal text-text-faint"> · none</span>}
          </div>
          <ol className="space-y-1">
            {list
              .sort((a, b) => a.position! - b.position!)
              .map((r) => {
                const co = r.matched_company_id ? companies.find((c) => c.id === r.matched_company_id) : null
                return (
                  <li key={r.id} className="flex gap-2 items-start">
                    <span className="w-6 text-right text-text-faint tabular-nums shrink-0">{r.position}.</span>
                    <div className="min-w-0">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline line-clamp-1 break-all">
                          {r.title || r.url}
                        </a>
                      ) : (
                        <span className="line-clamp-1">{r.title}</span>
                      )}
                      <div className="text-text-faint flex gap-1.5 items-center">
                        <span className="truncate">{r.domain}</span>
                        {co && <Badge tone={co.is_client ? 'client' : co.group === 'benchmark' ? 'benchmark' : 'neutral'}>{co.short_name ?? co.name}</Badge>}
                        {r.rating != null && <span>{r.rating}★ ({r.review_count})</span>}
                      </div>
                    </div>
                  </li>
                )
              })}
          </ol>
        </div>
      ))}
    </div>
  )
}

function best(rows: SerpResultView[], companyId: string, type: 'organic' | 'local_pack'): SerpResultView | undefined {
  return rows
    .filter((r) => r.matched_company_id === companyId && r.result_type === type && (type === 'local_pack' || r.match_kind === 'own_site'))
    .sort((a, b) => a.position! - b.position!)[0]
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(it)
  }
  return m
}

function groupQueries(qs: QueryRow[]): [string, QueryRow[]][] {
  const order = ['branded', 'category', 'community', 'buyer_situation']
  const m = groupBy(qs, (q) => q.group)
  const keys = [...m.keys()].sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
  return keys.map((k) => [k, m.get(k)!.sort((a, b) => a.sort_order - b.sort_order)])
}
