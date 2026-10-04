import type { Config } from '@netlify/functions'
import { adminClient } from '../lib/supabaseAdmin'
import { enqueueRun } from '../lib/enqueue'

/** Mondays 10:00 UTC (06:00 Eastern). Only enqueues; the background function does the work. */
export default async (req: Request) => {
  const admin = adminClient()
  const { data: workspaces } = await admin.from('workspaces').select('id, slug').eq('weekly_refresh_enabled', true)
  const baseUrl = Netlify.env.get('URL') ?? new URL(req.url).origin
  for (const ws of workspaces ?? []) {
    try {
      const id = await enqueueRun(admin, { workspaceId: ws.id, trigger: 'scheduled', baseUrl })
      console.log(`weekly: enqueued run ${id} for ${ws.slug}`)
    } catch (e) {
      console.error(`weekly: failed for ${ws.slug}`, e)
    }
  }
}

export const config: Config = { schedule: '0 10 * * 1' }
