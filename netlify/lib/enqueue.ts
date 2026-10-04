import type { AdminClient } from './supabaseAdmin'

/** Creates a queued run and kicks the background function that executes it. */
export async function enqueueRun(
  admin: AdminClient,
  opts: { workspaceId: string; trigger: 'scheduled' | 'manual'; requestedBy?: string | null; collectors?: string[]; baseUrl: string },
): Promise<string> {
  const { data, error } = await admin
    .from('collection_runs')
    .insert({ workspace_id: opts.workspaceId, trigger: opts.trigger, requested_by: opts.requestedBy ?? null, collectors: opts.collectors ?? [] })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'could not create run')
  const secret = Netlify.env.get('INTERNAL_SECRET') ?? ''
  const res = await fetch(`${opts.baseUrl}/.netlify/functions/collect-background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify({ runId: data.id }),
  })
  if (res.status !== 202 && !res.ok) {
    await admin.from('collection_runs').update({ status: 'failed', summary: { fatal: { errors: [`could not start background function: HTTP ${res.status}`] } } }).eq('id', data.id)
    throw new Error(`could not start background function: HTTP ${res.status}`)
  }
  return data.id
}

export function siteBaseUrl(req: Request): string {
  return Netlify.env.get('URL') ?? new URL(req.url).origin
}
