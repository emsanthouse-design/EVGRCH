import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useCurrentWorkspace } from '../../app/Layout'
import { useQueryMutations, useSearchQueries } from '../../lib/hooks'
import { Card, ErrorNote, Spinner, Badge } from '../../components/ui'
import { Input, Select, Checkbox } from '../../components/Field'
import { Button } from '../../components/Button'
import type { QueryRow } from '../../lib/models'

const GROUPS = ['branded', 'category', 'community', 'buyer_situation']
const GROUP_LABEL: Record<string, string> = { branded: 'Branded', category: 'Category', community: 'Community', buyer_situation: 'Buyer situation' }

export function QueriesSettings() {
  const ws = useCurrentWorkspace()
  const queries = useSearchQueries(ws.id)
  const { upsert, remove } = useQueryMutations(ws.id)
  const [phrase, setPhrase] = useState('')
  const [group, setGroup] = useState('category')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!phrase.trim()) return
    const maxOrder = Math.max(0, ...(queries.data ?? []).map((q) => q.sort_order))
    await upsert.mutateAsync({ workspace_id: ws.id, phrase: phrase.trim(), group, is_branded: group === 'branded', sort_order: maxOrder + 1 })
    setPhrase('')
  }

  if (queries.isLoading) return <Spinner />
  if (queries.error) return <ErrorNote error={queries.error} />
  const rows = queries.data ?? []
  const active = rows.filter((q) => q.is_active).length

  return (
    <div className="max-w-3xl space-y-4">
      <Card title={`Tracked queries (${active} active)`} actions={<span className="text-xs text-text-faint">Each active query costs one SERP call per run</span>}>
        <form onSubmit={add} className="flex flex-wrap gap-2 mb-4">
          <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="New search phrase" className="mt-0 flex-1 min-w-60" />
          <Select value={group} onChange={(e) => setGroup(e.target.value)} className="mt-0 w-44">
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={upsert.isPending || !phrase.trim()}>
            Add
          </Button>
        </form>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-muted text-left border-b border-border">
              <th className="py-2 pr-2 w-10">#</th>
              <th className="py-2 pr-2">Phrase</th>
              <th className="py-2 pr-2 w-40">Group</th>
              <th className="py-2 pr-2 w-24">Branded</th>
              <th className="py-2 pr-2 w-20">Active</th>
              <th className="py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <Row key={q.id} q={q} onChange={(patch) => upsert.mutate({ id: q.id, workspace_id: ws.id, phrase: q.phrase, ...patch })} onDelete={() => remove.mutate(q.id)} />
            ))}
          </tbody>
        </table>
        {(upsert.error || remove.error) && <ErrorNote error={upsert.error || remove.error} />}
      </Card>
    </div>
  )
}

function Row({ q, onChange, onDelete }: { q: QueryRow; onChange: (p: Partial<QueryRow>) => void; onDelete: () => void }) {
  const [phrase, setPhrase] = useState(q.phrase)
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-1.5 pr-2 text-text-faint tabular-nums">
        <input
          type="number"
          className="w-10 bg-transparent outline-none"
          defaultValue={q.sort_order}
          onBlur={(e) => Number(e.target.value) !== q.sort_order && onChange({ sort_order: Number(e.target.value) })}
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          className="w-full bg-transparent outline-none border-b border-transparent focus:border-border-strong"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onBlur={() => phrase.trim() && phrase !== q.phrase && onChange({ phrase: phrase.trim() })}
        />
      </td>
      <td className="py-1.5 pr-2">
        <Select value={q.group} onChange={(e) => onChange({ group: e.target.value, is_branded: e.target.value === 'branded' })} className="mt-0 py-1">
          {[...new Set([...GROUPS, q.group])].map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g] ?? g}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-1.5 pr-2">{q.is_branded ? <Badge tone="client">Branded</Badge> : <span className="text-text-faint text-xs">—</span>}</td>
      <td className="py-1.5 pr-2">
        <Checkbox label="" checked={q.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} />
      </td>
      <td className="py-1.5 text-right">
        <button className="text-text-faint hover:text-negative" title="Delete query (its history stays)" onClick={() => confirm(`Delete "${q.phrase}"? Past rankings for it will be deleted too.`) && onDelete()}>
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}
