import type { Database } from './database.types'

type Tables = Database['public']['Tables']
type Views = Database['public']['Views']
type Enums = Database['public']['Enums']

export type WorkspaceRow = Tables['workspaces']['Row']
export type CompanyRow = Tables['companies']['Row']
export type CompanyProfileRow = Tables['company_profiles']['Row']
export type MetricRow = Tables['metrics']['Row']
export type SnapshotRow = Tables['snapshots']['Row']
export type QueryRow = Tables['queries']['Row']
export type ProfileRow = Tables['profiles']['Row']
export type InviteRow = Tables['invites']['Row']
export type WorkspaceMemberRow = Tables['workspace_members']['Row']
export type CollectionRunRow = Tables['collection_runs']['Row']
export type ScorecardCell = Views['scorecard_cells']['Row']

export type MetricArea = Enums['metric_area']
export type CompanyGroup = Enums['company_group']
export type MemberRole = Enums['member_role']

export type CompanyWithProfiles = CompanyRow & { company_profiles: CompanyProfileRow[] }

export const AREA_ORDER: MetricArea[] = ['search', 'reviews', 'listings', 'social', 'website']
export const AREA_LABEL: Record<MetricArea, string> = {
  search: 'Search',
  reviews: 'Reviews',
  listings: 'Listings',
  social: 'Social',
  website: 'Website',
}

export const GROUP_LABEL: Record<CompanyGroup, string> = {
  client: 'Client',
  direct_peer: 'Direct peer',
  benchmark: 'Benchmark',
}

export const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google Business Profile',
  yelp: 'Yelp',
  houzz: 'Houzz',
  instagram: 'Instagram',
  facebook: 'Facebook',
  bbb: 'BBB',
  angi: 'Angi',
  nextdoor: 'Nextdoor',
  website: 'Website',
}

export const PLATFORMS = ['google', 'yelp', 'houzz', 'instagram', 'facebook', 'bbb', 'angi', 'nextdoor']

export function platformLabel(p: string | null | undefined): string {
  if (!p) return ''
  return PLATFORM_LABEL[p] ?? p.charAt(0).toUpperCase() + p.slice(1)
}
