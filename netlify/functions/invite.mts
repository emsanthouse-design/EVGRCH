import type { Config } from '@netlify/functions'
import { adminClient, callerProfile, json } from '../lib/supabaseAdmin'

/**
 * POST /api/invite { email, is_agency_admin, workspace_id?, role? }
 * Agency admins only. Adds the address to the allow list and sends a Supabase
 * invitation email (through whatever SMTP the project is configured with).
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = adminClient()
  const me = await callerProfile(req, admin)
  if (!me?.is_agency_admin) return json({ error: 'Agency admins only' }, 403)

  const body = (await req.json().catch(() => null)) as
    | { email?: string; is_agency_admin?: boolean; workspace_id?: string | null; role?: 'client_viewer' | 'client_editor' | null }
    | null
  const email = body?.email?.trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400)
  const isAdmin = !!body?.is_agency_admin
  if (!isAdmin && (!body?.workspace_id || !body?.role)) return json({ error: 'Client invites need a workspace and role' }, 400)

  const { error: invErr } = await admin.from('invites').upsert({
    email,
    is_agency_admin: isAdmin,
    workspace_id: isAdmin ? null : body!.workspace_id,
    role: isAdmin ? null : body!.role,
    invited_by: me.id,
  })
  if (invErr) return json({ error: invErr.message }, 500)

  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/` })
  // The allow-list row is the important part; the email is best-effort.
  return json({ ok: true, emailed: !mailErr, emailError: mailErr?.message ?? null })
}

export const config: Config = { path: '/api/invite' }
