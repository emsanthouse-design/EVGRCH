import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCurrentWorkspace } from '../../app/Layout'
import { useUpdateWorkspace } from '../../lib/hooks'
import { Card, ErrorNote } from '../../components/ui'
import { Checkbox, Field, Input, Select } from '../../components/Field'
import { Button } from '../../components/Button'

const schema = z.object({
  name: z.string().min(1),
  search_location: z.string().min(3),
  search_device: z.enum(['desktop', 'mobile']),
  search_language: z.string().min(2).max(5),
  search_country: z.string().min(2).max(2),
  timezone: z.string().min(1),
  stale_after_days: z.number().int().min(1).max(365),
  refresh_cooldown_minutes: z.number().int().min(0).max(1440),
  weekly_refresh_enabled: z.boolean(),
  client_access_enabled: z.boolean(),
})
type Form = z.infer<typeof schema>

export function WorkspaceSettings() {
  const ws = useCurrentWorkspace()
  const update = useUpdateWorkspace()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: ws.name,
      search_location: ws.search_location,
      search_device: ws.search_device as 'desktop' | 'mobile',
      search_language: ws.search_language,
      search_country: ws.search_country,
      timezone: ws.timezone,
      stale_after_days: ws.stale_after_days,
      refresh_cooldown_minutes: ws.refresh_cooldown_minutes,
      weekly_refresh_enabled: ws.weekly_refresh_enabled,
      client_access_enabled: ws.client_access_enabled,
    },
  })
  const { register, handleSubmit, formState } = form

  return (
    <form onSubmit={handleSubmit((v) => update.mutate({ id: ws.id, patch: v }))} className="max-w-2xl space-y-4">
      <Card title="Client">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Workspace name">
            <Input {...register('name')} />
          </Field>
          <Field label="Slug" hint="Used in URLs. Fixed after creation.">
            <Input value={ws.slug} disabled />
          </Field>
        </div>
      </Card>

      <Card title="Search">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Search location" hint='Queries run as if searched from here. Use the full form, e.g. "Hilton Head Island, South Carolina, United States".' className="sm:col-span-2">
            <Input {...register('search_location')} />
          </Field>
          <Field label="Device">
            <Select {...register('search_device')}>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </Select>
          </Field>
          <Field label="Time zone">
            <Input {...register('timezone')} />
          </Field>
          <Field label="Language">
            <Input {...register('search_language')} />
          </Field>
          <Field label="Country">
            <Input {...register('search_country')} />
          </Field>
        </div>
      </Card>

      <Card title="Refresh and freshness">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Flag manual data as stale after (days)">
            <Input type="number" {...register('stale_after_days', { valueAsNumber: true })} />
          </Field>
          <Field label="Minimum minutes between manual refreshes" hint="SERP calls are billed per query.">
            <Input type="number" {...register('refresh_cooldown_minutes', { valueAsNumber: true })} />
          </Field>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <Checkbox label="Run API collectors weekly (Mondays, 6:00 AM Eastern)" {...register('weekly_refresh_enabled')} />
            <Checkbox label="Allow client logins for this workspace (client viewers and editors)" {...register('client_access_enabled')} />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={update.isPending || !formState.isDirty}>
          {update.isPending ? 'Saving…' : 'Save settings'}
        </Button>
        {update.isSuccess && !formState.isDirty && <span className="text-sm text-positive">Saved.</span>}
        {Object.values(formState.errors)[0]?.message && <span className="text-sm text-negative">{String(Object.values(formState.errors)[0]?.message)}</span>}
      </div>
      {update.error && <ErrorNote error={update.error} />}
    </form>
  )
}
