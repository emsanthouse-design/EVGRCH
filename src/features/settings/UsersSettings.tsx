import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useCurrentWorkspace } from '../../app/Layout'
import { useInvites, useMembers, useProfiles, useUserMutations, useWorkspaces } from '../../lib/hooks'
import { Badge, Card, ErrorNote, Spinner } from '../../components/ui'
import { Input, Select } from '../../components/Field'
import { Button } from '../../components/Button'
import { useAuth } from '../auth/AuthProvider'
import type { MemberRole } from '../../lib/models'
import { formatDate } from '../../lib/format'

type InviteKind = 'agency_admin' | MemberRole

export function UsersSettings() {
  const ws = useCurrentWorkspace()
  const { profile: me } = useAuth()
  const profiles = useProfiles()
  const invites = useInvites()
  const members = useMembers()
  const workspaces = useWorkspaces()
  const { addInvite, removeInvite, setAdmin, upsertMember, removeMember } = useUserMutations()
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<InviteKind>('agency_admin')

  async function invite(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await addInvite.mutateAsync({
      email,
      is_agency_admin: kind === 'agency_admin',
      workspace_id: kind === 'agency_admin' ? null : ws.id,
      role: kind === 'agency_admin' ? null : kind,
      invited_by: me?.id ?? null,
    })
    setEmail('')
  }

  if (profiles.isLoading || invites.isLoading || members.isLoading) return <Spinner />
  const err = profiles.error || invites.error || members.error
  if (err) return <ErrorNote error={err} />

  const pending = (invites.data ?? []).filter((i) => !i.accepted_at)
  const wsName = (id: string | null) => workspaces.data?.find((w) => w.id === id)?.name ?? '—'

  return (
    <div className="max-w-3xl space-y-4">
      <Card title="Invite someone">
        <form onSubmit={invite} className="flex flex-wrap gap-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="mt-0 flex-1 min-w-60" required />
          <Select value={kind} onChange={(e) => setKind(e.target.value as InviteKind)} className="mt-0 w-56">
            <option value="agency_admin">Agency admin (all workspaces)</option>
            <option value="client_viewer">Client viewer · {ws.name}</option>
            <option value="client_editor">Client editor · {ws.name}</option>
          </Select>
          <Button type="submit" disabled={addInvite.isPending}>
            Add to allow list
          </Button>
        </form>
        <p className="text-xs text-text-muted mt-2">
          Sign-in is by magic link and only works for addresses on this list. Once added, the person goes to{' '}
          <span className="font-mono">{window.location.origin}/login</span> and requests a link. Client roles only work after "Allow client logins" is turned on
          in Workspace settings.
        </p>
        {addInvite.error && <ErrorNote error={addInvite.error} />}
      </Card>

      {pending.length > 0 && (
        <Card title={`Pending invitations (${pending.length})`}>
          <ul className="divide-y divide-border/60">
            {pending.map((i) => (
              <li key={i.email} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{i.email}</span>
                  <span className="text-text-muted ml-2 text-xs">
                    {i.is_agency_admin ? 'Agency admin' : `${roleLabel(i.role)} · ${wsName(i.workspace_id)}`} · invited {formatDate(i.created_at)}
                  </span>
                </div>
                <button className="text-text-faint hover:text-negative" onClick={() => removeInvite.mutate(i.email)} title="Revoke invitation">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`People (${profiles.data?.length ?? 0})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-muted text-left border-b border-border">
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Agency admin</th>
              <th className="py-2 pr-3">Role in {ws.name}</th>
              <th className="py-2 pr-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(profiles.data ?? []).map((p) => {
              const m = (members.data ?? []).find((x) => x.user_id === p.id && x.workspace_id === ws.id)
              const isMe = p.id === me?.id
              return (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3">
                    {p.email} {isMe && <Badge className="ml-1">you</Badge>}
                  </td>
                  <td className="py-2 pr-3">
                    <Select
                      value={p.is_agency_admin ? 'yes' : 'no'}
                      disabled={isMe}
                      onChange={(e) => setAdmin.mutate({ id: p.id, is_agency_admin: e.target.value === 'yes' })}
                      className="mt-0 py-1 w-24"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </Select>
                  </td>
                  <td className="py-2 pr-3">
                    {p.is_agency_admin ? (
                      <span className="text-xs text-text-faint">Full access</span>
                    ) : (
                      <Select
                        value={m?.role ?? ''}
                        onChange={(e) =>
                          e.target.value
                            ? upsertMember.mutate({ workspace_id: ws.id, user_id: p.id, role: e.target.value as MemberRole, invited_by: me?.id ?? null })
                            : removeMember.mutate({ workspace_id: ws.id, user_id: p.id })
                        }
                        className="mt-0 py-1 w-40"
                      >
                        <option value="">No access</option>
                        <option value="client_viewer">Client viewer</option>
                        <option value="client_editor">Client editor</option>
                      </Select>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-text-muted">{formatDate(p.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(setAdmin.error || upsertMember.error || removeMember.error) && <ErrorNote error={setAdmin.error || upsertMember.error || removeMember.error} />}
      </Card>
    </div>
  )
}

function roleLabel(r: MemberRole | null): string {
  return r === 'client_editor' ? 'Client editor' : r === 'client_viewer' ? 'Client viewer' : '—'
}
