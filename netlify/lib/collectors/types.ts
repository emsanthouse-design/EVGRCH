/**
 * Collector contract. Every automated metric is produced by a module that
 * implements one of these interfaces. Adding a collector = one file here plus
 * flipping metrics.source to 'api' for the keys it produces.
 */
import type { Database } from '../../../src/lib/database.types'

type Tables = Database['public']['Tables']
export type Workspace = Tables['workspaces']['Row']
export type Company = Tables['companies']['Row'] & { company_profiles: Tables['company_profiles']['Row'][] }
export type Query = Tables['queries']['Row']
export type Metric = Tables['metrics']['Row']

export interface CollectorContext {
  workspace: Workspace
  runId: string
  /** Metric catalog rows whose collector_key equals this collector and source = 'api'. */
  metrics: Metric[]
  env: (name: string) => string | undefined
  log: (msg: string, extra?: Record<string, unknown>) => void
  /** Collectors call this when they discover a profile identifier (e.g. a Google place ID). */
  onProfileResolved?: (companyId: string, platform: string, patch: { external_id?: string; url?: string }) => void
}

export type MetricValue =
  | { metricKey: string; kind: 'num'; value: number; raw?: unknown }
  | { metricKey: string; kind: 'bool'; value: boolean; raw?: unknown }
  | { metricKey: string; kind: 'text'; value: string; raw?: unknown }
  | { metricKey: string; kind: 'date'; value: string; raw?: unknown } // ISO date (YYYY-MM-DD)

export interface CompanyCollector {
  key: string
  /** Metric keys this module can produce. */
  produces: string[]
  /** Whether this company has what the collector needs (e.g. a website or a place ID). */
  canRun(company: Company): boolean
  collect(company: Company, ctx: CollectorContext): Promise<MetricValue[]>
}

export interface SerpResultIn {
  resultType: 'organic' | 'local_pack' | 'ad' | 'other'
  position: number
  title?: string | null
  url?: string | null
  domain?: string | null
  placeId?: string | null
  rating?: number | null
  reviewCount?: number | null
}

export interface SerpCapture {
  provider: string
  location: string
  device: string
  totalOrganic: number
  hasLocalPack: boolean
  costUnits?: number
  results: SerpResultIn[]
  raw?: unknown
}

export interface QueryCollector {
  key: 'serp'
  collect(query: Query, ctx: CollectorContext): Promise<SerpCapture>
}
