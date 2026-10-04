import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import clsx from 'clsx'
import { ExternalLink as ExternalIcon, Check } from 'lucide-react'
import { useCurrentWorkspace } from '../../app/Layout'
import { useCompanies, useInsertSnapshots, useMetrics, useScorecard } from '../../lib/hooks'
import { AREA_LABEL, AREA_ORDER, platformLabel, type CompanyWithProfiles, type MetricRow, type ScorecardCell } from '../../lib/models'
import { formatDate, formatValue } from '../../lib/format'
import { Button } from '../../components/Button'
import { Input, Select, Textarea } from '../../components/Field'
import { Badge, ErrorNote, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import type { Database } from '../../lib/database.types'

type SnapshotInsert = Database['public']['Tables']['snapshots']['Insert']
type Draft = Record<string, string> // metric_key -> raw input ('' = untouched)

export function DataEntryPage() {
  const ws = useCurrentWorkspace()
  const { session } = useAuth()
  const companies = useCompanies(ws.id)
  const metrics = useMetrics()
  const cells = useScorecard(ws.id)
  const insert = useInsertSnapshots(ws.id)
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<Draft>({})
  const [note, setNote] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const companyId = params.get('company') ?? companies.data?.[0]?.id
  const company = companies.data?.find((c) => c.id === companyId)

  useEffect(() => {
    setDraft({})
    setNote('')
    setSavedAt(null)
  }, [companyId])

  const cellMap = useMemo(() => {
    const m = new Map<string, ScorecardCell>()
    for (const c of cells.data ?? []) if (c.company_id === companyId) m.set(c.metric_key!, c)
    return m
  }, [cells.data, companyId])

  if (companies.isLoading || metrics.isLoading || cells.isLoading) return <Spinner />
  const err = companies.error || metrics.error || cells.error
  if (err) return <ErrorNote error={err} />
  if (!company) return <ErrorNote error={new Error('No companies in this workspace yet. Add them in Settings.')} />

  const manualMetrics = (metrics.data ?? []).filter((m) => m.source === 'manual')
  const groups = groupMetrics(manualMetrics)
  const dirtyCount = Object.values(draft).filter((v) => v !== '').length

  async function save() {
    if (!session) return
    const rows: SnapshotInsert[] = []
    for (const m of manualMetrics) {
      const raw = draft[m.key]
      if (raw == null || raw === '') continue
      const row = toRow(m, raw, company!.id, session.user.id, note)
      if (row) rows.push(row)
    }
    if (rows.length === 0) return
    await insert.mutateAsync(rows)
    setDraft({})
    setNote('')
    setSavedAt(new Date().toISOString())
  }

  function carryForward(keys: string[]) {
    setDraft((d) => {
      const next = { ...d }
      for (const k of keys) {
        const cell = cellMap.get(k)
        const m = manualMetrics.find((x) => x.key === k)
        if (cell && m) next[k] = cellToInput(m, cell)
      }
      return next
    })
  }

  const idx = companies.data!.findIndex((c) => c.id === company.id)
  const nextCompany = companies.data![idx + 1]

  return (
    <>
      <PageHeader
        title="Data entry"
        subtitle="Manual metrics, one company at a time. Open each profile with the link beside its section, read the numbers, type them in. Only fields you fill in are saved; every save is a new dated entry."
        actions={
          <Select value={company.id} onChange={(e) => setParams({ company: e.target.value })} className="mt-0 w-64">
            {companies.data!.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_client ? ' (client)' : c.group === 'benchmark' ? ' (benchmark)' : ''}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
        <div className="space-y-4">
          {AREA_ORDER.map((area) => {
            const areaGroups = groups.filter((g) => g.area === area)
            if (areaGroups.length === 0) return null
            return (
              <section key={area}>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">{AREA_LABEL[area]}</h2>
                <div className="space-y-3">
                  {areaGroups.map((g) => (
                    <GroupCard
                      key={`${g.area}:${g.platform}`}
                      group={g}
                      company={company}
                      draft={draft}
                      cellMap={cellMap}
                      onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
                      onCarryForward={() => carryForward(g.metrics.map((m) => m.key))}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <aside className="lg:sticky lg:top-6 bg-surface border border-border rounded-lg shadow-sm p-4 space-y-3">
          <div>
            <div className="font-medium">{company.name}</div>
            <div className="text-xs text-text-muted">{company.city}</div>
          </div>
          <label className="block">
            <span className="text-xs text-text-muted">Note for this save (optional)</span>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Counted posts from Sep 4 to Oct 4" />
          </label>
          <Button className="w-full" disabled={dirtyCount === 0 || insert.isPending} onClick={save}>
            {insert.isPending ? 'Saving…' : dirtyCount === 0 ? 'Nothing to save yet' : `Save ${dirtyCount} ${dirtyCount === 1 ? 'value' : 'values'}`}
          </Button>
          {insert.error && <ErrorNote error={insert.error} />}
          {savedAt && (
            <div className="text-xs text-positive flex items-center gap-1">
              <Check size={13} /> Saved {formatDate(savedAt, 'h:mm a')}.
              {nextCompany && (
                <button className="underline ml-1" onClick={() => setParams({ company: nextCompany.id })}>
                  Next: {nextCompany.short_name ?? nextCompany.name}
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-text-faint">
            Use "Same as last time" on a section to re-confirm unchanged values with today's date, which clears the stale flag.
          </p>
        </aside>
      </div>
    </>
  )
}

interface Group {
  area: MetricRow['area']
  platform: string | null
  metrics: MetricRow[]
}

function groupMetrics(metrics: MetricRow[]): Group[] {
  const map = new Map<string, Group>()
  for (const m of metrics) {
    const k = `${m.area}:${m.platform ?? ''}`
    if (!map.has(k)) map.set(k, { area: m.area, platform: m.platform, metrics: [] })
    map.get(k)!.metrics.push(m)
  }
  return [...map.values()]
}

function GroupCard({
  group,
  company,
  draft,
  cellMap,
  onChange,
  onCarryForward,
}: {
  group: Group
  company: CompanyWithProfiles
  draft: Draft
  cellMap: Map<string, ScorecardCell>
  onChange: (key: string, value: string) => void
  onCarryForward: () => void
}) {
  const profile = group.platform ? company.company_profiles.find((p) => p.platform === group.platform) : null
  const link = group.platform ? profile?.url : company.website_url
  const title = group.platform ? platformLabel(group.platform) : AREA_LABEL[group.area]
  const hasAny = group.metrics.some((m) => cellMap.has(m.key))
  const missingProfile = group.platform && !profile?.url

  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {profile?.handle && <span className="text-xs text-text-faint truncate">{profile.handle}</span>}
          {missingProfile && <Badge tone="warning">No profile URL</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {hasAny && (
            <Button variant="ghost" size="sm" onClick={onCarryForward} title="Copy the current values into the form so they are re-saved with today's date">
              Same as last time
            </Button>
          )}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Open {group.platform ? platformLabel(group.platform).split(' ')[0] : 'site'} <ExternalIcon size={12} />
            </a>
          ) : null}
        </div>
      </header>
      <div className="p-4 grid gap-3 sm:grid-cols-2">
        {group.metrics.map((m) => (
          <MetricInput key={m.key} metric={m} cell={cellMap.get(m.key)} value={draft[m.key] ?? ''} onChange={(v) => onChange(m.key, v)} />
        ))}
        {profile?.notes && <p className="sm:col-span-2 text-xs text-text-faint">{profile.notes}</p>}
      </div>
    </div>
  )
}

function MetricInput({ metric, cell, value, onChange }: { metric: MetricRow; cell: ScorecardCell | undefined; value: string; onChange: (v: string) => void }) {
  const current = cell ? formatValue(metric, cell) : null
  const dirty = value !== ''
  const inputId = `m-${metric.key}`
  return (
    <div className={clsx('rounded-md', dirty && 'ring-1 ring-accent/40 bg-accent-soft/30 -m-1 p-1')}>
      <label htmlFor={inputId} className="text-xs text-text-muted flex items-center justify-between gap-2">
        <span>
          {metric.label}
          {metric.unit && metric.value_type !== 'boolean' ? <span className="text-text-faint"> ({metric.unit})</span> : null}
        </span>
        {cell && (
          <span className={clsx('text-[11px] tabular-nums', cell.is_stale ? 'text-warning' : 'text-text-faint')} title={`Last entered ${formatDate(cell.captured_at)}`}>
            {current} · {formatDate(cell.captured_at, 'MMM d')}
            {cell.is_stale ? ' · stale' : ''}
          </span>
        )}
      </label>
      {metric.value_type === 'boolean' ? (
        <Select id={inputId} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{cell ? 'Keep as is' : 'Not entered'}</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      ) : metric.value_type === 'text' ? (
        <Textarea id={inputId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={cell ? `Current: ${current}` : (metric.help_text ?? '')} className="min-h-14" />
      ) : metric.value_type === 'date' ? (
        <Input id={inputId} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step={metric.value_type === 'number' ? '0.1' : '1'}
          min={metric.value_type === 'percent' || metric.value_type === 'score' ? 0 : undefined}
          max={metric.value_type === 'percent' ? 100 : metric.value_type === 'score' ? 100 : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={cell ? `Current: ${current}` : ''}
        />
      )}
      {metric.help_text && !cell && <p className="text-[11px] text-text-faint mt-1">{metric.help_text}</p>}
    </div>
  )
}

function cellToInput(m: MetricRow, cell: ScorecardCell): string {
  switch (m.value_type) {
    case 'boolean':
      return cell.value_bool == null ? '' : String(cell.value_bool)
    case 'text':
      return cell.value_text ?? ''
    case 'date':
      return cell.value_date ?? ''
    default:
      return cell.value_num == null ? '' : String(cell.value_num)
  }
}

function toRow(m: MetricRow, raw: string, companyId: string, userId: string, note: string): SnapshotInsert | null {
  const base: SnapshotInsert = { company_id: companyId, metric_key: m.key, source: 'manual', entered_by: userId, note: note || null }
  switch (m.value_type) {
    case 'boolean':
      return { ...base, value_bool: raw === 'true' }
    case 'text':
      return raw.trim() ? { ...base, value_text: raw.trim() } : null
    case 'date':
      return { ...base, value_date: raw }
    default: {
      const n = Number(raw)
      return Number.isFinite(n) ? { ...base, value_num: n } : null
    }
  }
}
