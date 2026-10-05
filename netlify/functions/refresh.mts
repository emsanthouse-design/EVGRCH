import type { Config } from '@netlify/functions'
import { adminClient, callerProfile, json } from '../lib/supabaseAdmin'
import { enqueueRun, siteBaseUrl } from '../lib/enqueue'

/**
 * POST /api/refresh { workspaceId, collectors?: string[] } — agency admins only.
 * The per-workspace cooldown applies to runs that include the SERP collector (billed per query);
 * collector-only runs (e.g. ["google_places", "pagespeed"]) can be repeated freely.
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = adminClient()
  const me = await callerProfile(req, admin)
  if (!me?.is_agency_admin) return json({ error: 'Agency admins only' }, 403)

  const { workspaceId, collectors } = (await req.json().catch(() => ({}))) as { workspaceId?: string; collectors?: string[] }
  if (!workspaceId) return json({ error: 'workspaceId required' }, 400)
  const wanted = Array.isArray(collectors) ? collectors.filter((c) => typeof c === 'string') : []
  const includesSerp = wanted.length === 0 || wanted.includes('serp')
  const { data: ws } = await admin.from('workspaces').select('id, refresh_cooldown_minutes').eq('id', workspaceId).single()
  if (!ws) return json({ error: 'Workspace not found' }, 404)

  const { data: last } = await admin
    .from('collection_runs')
    .select('created_at, status')
    .eq('workspace_id', workspaceId)
    .eq('trigger', 'manual')
    .or('collectors.eq.{},collectors.cs.{serp}')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last && includesSerp) {
    const ageMin = (Date.now() - new Date(last.created_at).getTime()) / 60000
    if (ageMin < ws.refresh_cooldown_minutes) {
      const wait = Math.ceil(ws.refresh_cooldown_minutes - ageMin)
      return json({ error: `Refresh is limited to once every ${ws.refresh_cooldown_minutes} minutes. Try again in ${wait} min.`, retryInMinutes: wait }, 429)
    }
  }
  const { data: active } = await admin.from('collection_runs').select('id').eq('workspace_id', workspaceId).in('status', ['queued', 'running']).limit(1)
  if (active && active.length > 0) return json({ error: 'A run is already in progress.' }, 409)

  try {
    const runId = await enqueueRun(admin, { workspaceId, trigger: 'manual', requestedBy: me.id, collectors: wanted, baseUrl: siteBaseUrl(req) })
    return json({ ok: true, runId }, 202)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
}

export const config: Config = { path: '/api/refresh' }
