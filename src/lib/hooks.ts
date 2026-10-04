import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { CompanyWithProfiles, InviteRow, MetricRow, ProfileRow, QueryRow, ScorecardCell, WorkspaceMemberRow, WorkspaceRow } from './models'
import type { Database } from './database.types'

type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
type Update<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

// ----- workspaces -----------------------------------------------------------
export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => unwrap<WorkspaceRow[]>(supabase.from('workspaces').select('*').order('name')),
  })
}

export function useWorkspace(slug: string | undefined) {
  return useQuery({
    queryKey: ['workspace', slug],
    enabled: !!slug,
    queryFn: () => unwrap<WorkspaceRow>(supabase.from('workspaces').select('*').eq('slug', slug!).single()),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Update<'workspaces'> }) =>
      unwrap<WorkspaceRow>(supabase.from('workspaces').update(patch).eq('id', id).select().single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      qc.invalidateQueries({ queryKey: ['workspace'] })
    },
  })
}

// ----- companies --------------------------------------------------------------
export function useCompanies(workspaceId: string | undefined, opts: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['companies', workspaceId, opts.includeInactive ?? false],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase
        .from('companies')
        .select('*, company_profiles(*)')
        .eq('workspace_id', workspaceId!)
        .order('sort_order')
        .order('name')
      if (!opts.includeInactive) q = q.eq('is_active', true)
      const rows = await unwrap<CompanyWithProfiles[]>(q)
      // client first, then peers, then benchmark
      const rank = { client: 0, direct_peer: 1, benchmark: 2 }
      return rows.sort((a, b) => rank[a.group] - rank[b.group] || a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    },
  })
}

export function useCompanyMutations(workspaceId: string | undefined) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['companies', workspaceId] })
    qc.invalidateQueries({ queryKey: ['scorecard', workspaceId] })
  }
  const upsertCompany = useMutation({
    mutationFn: async (row: Insert<'companies'> & { id?: string }) => {
      if (row.id) {
        const { id, ...patch } = row
        return unwrap(supabase.from('companies').update(patch).eq('id', id).select().single())
      }
      return unwrap(supabase.from('companies').insert(row).select().single())
    },
    onSuccess: invalidate,
  })
  const deleteCompany = useMutation({
    mutationFn: async (id: string) => unwrap(supabase.from('companies').delete().eq('id', id)),
    onSuccess: invalidate,
  })
  const upsertProfile = useMutation({
    mutationFn: async (row: Insert<'company_profiles'>) =>
      unwrap(supabase.from('company_profiles').upsert(row, { onConflict: 'company_id,platform' }).select().single()),
    onSuccess: invalidate,
  })
  const deleteProfile = useMutation({
    mutationFn: async (id: string) => unwrap(supabase.from('company_profiles').delete().eq('id', id)),
    onSuccess: invalidate,
  })
  return { upsertCompany, deleteCompany, upsertProfile, deleteProfile }
}

// ----- metrics ---------------------------------------------------------------
export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await unwrap<MetricRow[]>(supabase.from('metrics').select('*').eq('is_active', true))
      const areaRank = { search: 0, reviews: 1, listings: 2, social: 3, website: 4 }
      return rows.sort((a, b) => areaRank[a.area] - areaRank[b.area] || (a.platform ?? '').localeCompare(b.platform ?? '') || a.sort_order - b.sort_order)
    },
  })
}

// ----- scorecard -------------------------------------------------------------
export function useScorecard(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['scorecard', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => unwrap<ScorecardCell[]>(supabase.from('scorecard_cells').select('*').eq('workspace_id', workspaceId!)),
  })
}

export function useInsertSnapshots(workspaceId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Insert<'snapshots'>[]) => {
      if (rows.length === 0) return []
      return unwrap(supabase.from('snapshots').insert(rows).select())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scorecard', workspaceId] })
      qc.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

// ----- queries ---------------------------------------------------------------
export function useSearchQueries(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['queries', workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      unwrap<QueryRow[]>(
        supabase.from('queries').select('*').eq('workspace_id', workspaceId!).order('is_branded', { ascending: false }).order('sort_order').order('phrase'),
      ),
  })
}

export function useQueryMutations(workspaceId: string | undefined) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['queries', workspaceId] })
  const upsert = useMutation({
    mutationFn: async (row: Insert<'queries'> & { id?: string }) => {
      if (row.id) {
        const { id, ...patch } = row
        return unwrap(supabase.from('queries').update(patch).eq('id', id).select().single())
      }
      return unwrap(supabase.from('queries').insert(row).select().single())
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(supabase.from('queries').delete().eq('id', id)),
    onSuccess: invalidate,
  })
  return { upsert, remove }
}

// ----- users -----------------------------------------------------------------
export function useProfiles() {
  return useQuery({ queryKey: ['profiles'], queryFn: () => unwrap<ProfileRow[]>(supabase.from('profiles').select('*').order('email')) })
}
export function useInvites() {
  return useQuery({ queryKey: ['invites'], queryFn: () => unwrap<InviteRow[]>(supabase.from('invites').select('*').order('created_at')) })
}
export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: () => unwrap<WorkspaceMemberRow[]>(supabase.from('workspace_members').select('*')) })
}

export function useUserMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['profiles'] })
    qc.invalidateQueries({ queryKey: ['invites'] })
    qc.invalidateQueries({ queryKey: ['members'] })
  }
  const addInvite = useMutation({
    mutationFn: async (row: Insert<'invites'>) => unwrap(supabase.from('invites').upsert({ ...row, email: row.email.trim().toLowerCase() }).select().single()),
    onSuccess: invalidate,
  })
  const removeInvite = useMutation({
    mutationFn: async (email: string) => unwrap(supabase.from('invites').delete().eq('email', email)),
    onSuccess: invalidate,
  })
  const setAdmin = useMutation({
    mutationFn: async ({ id, is_agency_admin }: { id: string; is_agency_admin: boolean }) =>
      unwrap(supabase.from('profiles').update({ is_agency_admin }).eq('id', id).select().single()),
    onSuccess: invalidate,
  })
  const upsertMember = useMutation({
    mutationFn: async (row: Insert<'workspace_members'>) => unwrap(supabase.from('workspace_members').upsert(row).select().single()),
    onSuccess: invalidate,
  })
  const removeMember = useMutation({
    mutationFn: async ({ workspace_id, user_id }: { workspace_id: string; user_id: string }) =>
      unwrap(supabase.from('workspace_members').delete().eq('workspace_id', workspace_id).eq('user_id', user_id)),
    onSuccess: invalidate,
  })
  return { addInvite, removeInvite, setAdmin, upsertMember, removeMember }
}

// ----- history (company detail, phase 3 uses the full version) ----------------
export function useCompanyHistory(companyId: string | undefined) {
  return useQuery({
    queryKey: ['history', companyId],
    enabled: !!companyId,
    queryFn: () =>
      unwrap(
        supabase
          .from('snapshots')
          .select('id, metric_key, value_num, value_bool, value_text, value_date, captured_at, source, note')
          .eq('company_id', companyId!)
          .order('captured_at', { ascending: false })
          .limit(2000),
      ),
  })
}

// ----- collection runs (phase 2 shows status; phase 1 shows "never") ----------
export function useLatestRun(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['latest-run', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const rows = await unwrap(
        supabase.from('collection_runs').select('*').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }).limit(1),
      )
      return rows[0] ?? null
    },
  })
}
