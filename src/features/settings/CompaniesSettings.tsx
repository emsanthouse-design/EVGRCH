import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Pencil, Plus, Trash2, ExternalLink as ExternalIcon } from 'lucide-react'
import { useCurrentWorkspace } from '../../app/Layout'
import { useCompanies, useCompanyMutations } from '../../lib/hooks'
import { GROUP_LABEL, PLATFORMS, platformLabel, type CompanyGroup, type CompanyWithProfiles } from '../../lib/models'
import { Badge, Card, ErrorNote, Spinner } from '../../components/ui'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/Field'
import { Button } from '../../components/Button'

export function CompaniesSettings() {
  const ws = useCurrentWorkspace()
  const companies = useCompanies(ws.id, { includeInactive: true })
  const { deleteCompany } = useCompanyMutations(ws.id)
  const [editing, setEditing] = useState<CompanyWithProfiles | 'new' | null>(null)

  if (companies.isLoading) return <Spinner />
  if (companies.error) return <ErrorNote error={companies.error} />
  const rows = companies.data ?? []

  return (
    <div className="space-y-4">
      <Card
        title={`Companies (${rows.length})`}
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus size={14} /> Add company
          </Button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-muted text-left border-b border-border">
              <th className="py-2 pr-3">Company</th>
              <th className="py-2 pr-3">Group</th>
              <th className="py-2 pr-3">Website</th>
              <th className="py-2 pr-3">Profiles</th>
              <th className="py-2 pr-3 w-16">Order</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={`border-b border-border/60 last:border-0 ${c.is_active ? '' : 'opacity-50'}`}>
                <td className="py-2 pr-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-text-faint">{[c.short_name, c.city].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="py-2 pr-3">
                  {c.is_client ? <Badge tone="client">Client</Badge> : c.group === 'benchmark' ? <Badge tone="benchmark">Benchmark</Badge> : <Badge>Direct peer</Badge>}
                  {!c.is_active && <Badge className="ml-1">Inactive</Badge>}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {c.website_url ? (
                    <a href={c.website_url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                      {c.website_domain ?? c.website_url} <ExternalIcon size={11} />
                    </a>
                  ) : (
                    <span className="text-text-faint">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {c.company_profiles
                      .filter((p) => p.url)
                      .map((p) => (
                        <a key={p.id} href={p.url!} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-surface-muted hover:bg-border text-text-muted">
                          {platformLabel(p.platform).split(' ')[0]}
                        </a>
                      ))}
                    {c.company_profiles.filter((p) => !p.url).length > 0 && (
                      <span className="text-text-faint">+{c.company_profiles.filter((p) => !p.url).length} without URL</span>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-3 text-text-faint tabular-nums">{c.sort_order}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button className="text-text-muted hover:text-text p-1" onClick={() => setEditing(c)} title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button
                    className="text-text-faint hover:text-negative p-1"
                    title="Delete company and all its history"
                    onClick={() => confirm(`Delete ${c.name} and ALL of its history? This cannot be undone. Consider marking it inactive instead.`) && deleteCompany.mutate(c.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deleteCompany.error && <ErrorNote error={deleteCompany.error} />}
      </Card>

      {editing && <CompanyEditor company={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

interface CompanyForm {
  name: string
  short_name: string
  website_url: string
  extra_domains: string
  city: string
  group: CompanyGroup
  is_client: boolean
  is_active: boolean
  sort_order: number
  notes: string
}

function CompanyEditor({ company, onClose }: { company: CompanyWithProfiles | null; onClose: () => void }) {
  const ws = useCurrentWorkspace()
  const { upsertCompany, upsertProfile, deleteProfile } = useCompanyMutations(ws.id)
  const companies = useCompanies(ws.id, { includeInactive: true })
  const live = company ? companies.data?.find((c) => c.id === company.id) ?? company : null
  const { register, handleSubmit, formState } = useForm<CompanyForm>({
    defaultValues: {
      name: company?.name ?? '',
      short_name: company?.short_name ?? '',
      website_url: company?.website_url ?? '',
      extra_domains: company?.extra_domains.join(', ') ?? '',
      city: company?.city ?? '',
      group: company?.group ?? 'direct_peer',
      is_client: company?.is_client ?? false,
      is_active: company?.is_active ?? true,
      sort_order: company?.sort_order ?? 100,
      notes: company?.notes ?? '',
    },
  })

  async function save(v: CompanyForm) {
    const website_url = v.website_url.trim() || null
    await upsertCompany.mutateAsync({
      id: company?.id,
      workspace_id: ws.id,
      name: v.name.trim(),
      short_name: v.short_name.trim() || null,
      website_url,
      website_domain: website_url ? domainOf(website_url) : null,
      extra_domains: v.extra_domains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
      city: v.city.trim() || null,
      group: v.is_client ? 'client' : v.group === 'client' ? 'direct_peer' : v.group,
      is_client: v.is_client,
      is_active: v.is_active,
      sort_order: Number(v.sort_order) || 100,
      notes: v.notes.trim() || null,
    })
    if (!company) onClose()
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full overflow-y-auto bg-surface border-l border-border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{company ? company.name : 'New company'}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <form onSubmit={handleSubmit(save)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input {...register('name', { required: true })} />
            </Field>
            <Field label="Short name" hint="For tight grid headers">
              <Input {...register('short_name')} />
            </Field>
            <Field label="City">
              <Input {...register('city')} />
            </Field>
            <Field label="Website URL" className="sm:col-span-2">
              <Input {...register('website_url')} placeholder="https://" />
            </Field>
            <Field label="Other domains" hint="Comma-separated. Old or redirecting domains, so search results on them count for this company." className="sm:col-span-2">
              <Input {...register('extra_domains')} />
            </Field>
            <Field label="Group">
              <Select {...register('group')}>
                {(['direct_peer', 'benchmark'] as CompanyGroup[]).map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABEL[g]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort order">
              <Input type="number" {...register('sort_order')} />
            </Field>
            <div className="sm:col-span-2 flex gap-5">
              <Checkbox label="This is the client (one per workspace)" {...register('is_client')} />
              <Checkbox label="Active" {...register('is_active')} />
            </div>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea {...register('notes')} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={upsertCompany.isPending || (!!company && !formState.isDirty)}>
              {upsertCompany.isPending ? 'Saving…' : company ? 'Save changes' : 'Create company'}
            </Button>
            {upsertCompany.isSuccess && !formState.isDirty && <span className="text-sm text-positive">Saved.</span>}
          </div>
          {upsertCompany.error && <ErrorNote error={upsertCompany.error} />}
        </form>

        {live && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-1">Profiles</h3>
            <p className="text-xs text-text-muted mb-3">
              One row per platform. The URL becomes the "Open" link in Data entry. External ID holds the Google place ID (filled in by the Places collector) or an Instagram account ID.
            </p>
            <div className="space-y-2">
              {PLATFORMS.map((platform) => {
                const p = live.company_profiles.find((x) => x.platform === platform)
                return (
                  <ProfileRowEditor
                    key={platform}
                    platform={platform}
                    url={p?.url ?? ''}
                    handle={p?.handle ?? ''}
                    externalId={p?.external_id ?? ''}
                    altUrls={(p?.alt_urls ?? []).join(', ')}
                    notes={p?.notes ?? ''}
                    onSave={(v) =>
                      upsertProfile.mutate({
                        company_id: live.id,
                        platform,
                        url: v.url || null,
                        handle: v.handle || null,
                        external_id: v.externalId || null,
                        alt_urls: v.altUrls.split(',').map((u) => u.trim()).filter(Boolean),
                        notes: v.notes || null,
                      })
                    }
                    onClear={p ? () => deleteProfile.mutate(p.id) : undefined}
                  />
                )
              })}
            </div>
            {(upsertProfile.error || deleteProfile.error) && <ErrorNote error={upsertProfile.error || deleteProfile.error} />}
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileRowEditor({
  platform,
  url,
  handle,
  externalId,
  altUrls,
  notes,
  onSave,
  onClear,
}: {
  platform: string
  url: string
  handle: string
  externalId: string
  altUrls: string
  notes: string
  onSave: (v: { url: string; handle: string; externalId: string; altUrls: string; notes: string }) => void
  onClear?: () => void
}) {
  const [v, setV] = useState({ url, handle, externalId, altUrls, notes })
  const dirty = v.url !== url || v.handle !== handle || v.externalId !== externalId || v.altUrls !== altUrls || v.notes !== notes
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{platformLabel(platform)}</div>
        <div className="flex items-center gap-2">
          {v.url && (
            <a href={v.url} target="_blank" rel="noreferrer" className="text-xs text-text-muted hover:underline inline-flex items-center gap-1">
              Open <ExternalIcon size={11} />
            </a>
          )}
          {onClear && (
            <button className="text-xs text-text-faint hover:text-negative" onClick={onClear}>
              Remove
            </button>
          )}
          <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={() => onSave(v)}>
            Save
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_160px]">
        <Input placeholder="Profile URL" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value.trim() })} className="mt-0" />
        <Input placeholder="Handle / name" value={v.handle} onChange={(e) => setV({ ...v, handle: e.target.value })} className="mt-0" />
        <Input placeholder="External ID" value={v.externalId} onChange={(e) => setV({ ...v, externalId: e.target.value.trim() })} className="mt-0 font-mono text-xs" />
        <Input placeholder="Other URLs for this company on this platform (duplicates, old slugs), comma-separated" value={v.altUrls} onChange={(e) => setV({ ...v, altUrls: e.target.value })} className="mt-0 sm:col-span-3" />
        <Input placeholder="Notes (e.g. duplicate profile exists)" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="mt-0 sm:col-span-3" />
      </div>
    </div>
  )
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}
