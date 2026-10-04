import type { Config } from '@netlify/functions'
import { adminClient } from '../lib/supabaseAdmin'

// Daily touch so the free-plan Supabase project is never considered idle.
export default async (_req: Request) => {
  const admin = adminClient()
  const { error } = await admin.from('workspaces').select('id').limit(1)
  if (error) console.error('keepalive failed', error.message)
  else console.log('keepalive ok')
}

export const config: Config = {
  schedule: '17 9 * * *',
}
