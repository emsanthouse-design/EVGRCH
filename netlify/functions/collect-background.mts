import { adminClient } from '../lib/supabaseAdmin'
import { runCollection } from '../lib/run'

/** Background function (15-minute limit). Invoked by refresh.mts and weekly-scheduled.mts. */
export default async (req: Request) => {
  const secret = Netlify.env.get('INTERNAL_SECRET') ?? ''
  if (secret && req.headers.get('x-internal-secret') !== secret) {
    console.error('collect-background: bad secret')
    return
  }
  const { runId } = (await req.json().catch(() => ({}))) as { runId?: string }
  if (!runId) {
    console.error('collect-background: missing runId')
    return
  }
  const admin = adminClient()
  await runCollection(admin, runId, (k) => Netlify.env.get(k))
}
