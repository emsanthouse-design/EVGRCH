import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'

export type AdminClient = SupabaseClient<Database>

/** Service-role client. Bypasses RLS; only ever used inside Netlify functions. */
export function adminClient(): AdminClient {
  const url = Netlify.env.get('SUPABASE_URL') ?? Netlify.env.get('VITE_SUPABASE_URL')
  const key = Netlify.env.get('SUPABASE_ADMIN_KEY') ?? Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ADMIN_KEY must be set on the Netlify site.')
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Verifies the caller's Supabase JWT and returns their profile, or null. */
export async function callerProfile(req: Request, admin: AdminClient) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
  return profile
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
