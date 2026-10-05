/**
 * Orchestrates one collection run: company collectors for every active api
 * metric, then the SERP collector for every active query, then derived metrics.
 */
import type { AdminClient } from './supabaseAdmin'
import { companyCollectors } from './collectors'
import type { Company, CollectorContext, Metric, MetricValue, Query, Workspace } from './collectors/types'
import { serpProviderFromEnv } from './serp'
import { matchCompany, type MatchableCompany } from './matching'
import type { Database } from '../../src/lib/database.types'

type SnapshotInsert = Database['public']['Tables']['snapshots']['Insert']
type SerpResultInsert = Database['public']['Tables']['serp_results']['Insert']

interface CollectorSummary {
  companies?: number
  queries?: number
  snapshots?: number
  results?: number
  errors: string[]
  cost?: number
  skipped?: string[]
}

export async function runCollection(admin: AdminClient, runId: string, env: (k: string) => string | undefined): Promise<void> {
  const log = (msg: string, extra?: Record<string, unknown>) => console.log(`[run ${runId.slice(0, 8)}] ${msg}`, extra ? JSON.stringify(extra) : '')
  const { data: run, error: runErr } = await admin.from('collection_runs').select('*').eq('id', runId).single()
  if (runErr || !run) throw new Error(`run not found: ${runErr?.message}`)
  await admin.from('collection_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', runId)

  const summary: Record<string, CollectorSummary> = {}
  let hadError = false
  let hadSuccess = false

  try {
    const [{ data: workspace }, { data: companies }, { data: queries }, { data: metrics }] = await Promise.all([
      admin.from('workspaces').select('*').eq('id', run.workspace_id).single(),
      admin.from('companies').select('*, company_profiles(*)').eq('workspace_id', run.workspace_id).eq('is_active', true).order('sort_order'),
      admin.from('queries').select('*').eq('workspace_id', run.workspace_id).eq('is_active', true).order('sort_order'),
      admin.from('metrics').select('*').eq('is_active', true).eq('source', 'api'),
    ])
    if (!workspace) throw new Error('workspace not found')
    const cos = (companies ?? []) as Company[]
    const qs = (queries ?? []) as Query[]
    const apiMetrics = (metrics ?? []) as Metric[]
    const wanted = new Set(run.collectors)

    // ---- company collectors --------------------------------------------------
    for (const collector of companyCollectors) {
      if (wanted.size > 0 && !wanted.has(collector.key)) continue
      const mine = apiMetrics.filter((m) => m.collector_key === collector.key)
      if (mine.length === 0) continue // nothing in the catalog points at this module
      const s: CollectorSummary = { companies: 0, snapshots: 0, errors: [], skipped: [] }
      summary[collector.key] = s
      const ctx: CollectorContext = {
        workspace: workspace as Workspace,
        runId,
        metrics: mine,
        env,
        log,
        onProfileResolved: (companyId, platform, patch) => {
          void admin.from('company_profiles').upsert({ company_id: companyId, platform, ...patch }, { onConflict: 'company_id,platform' })
        },
      }
      const allowedKeys = new Set(mine.map((m) => m.key))
      await mapLimit(cos, collector.key === 'pagespeed' ? 1 : 3, async (company) => {
        if (!collector.canRun(company)) {
          s.skipped!.push(company.name)
          return
        }
        try {
          const values = await collector.collect(company, ctx)
          const rows = values.filter((v) => allowedKeys.has(v.metricKey)).map((v) => toSnapshot(v, company.id, collector.key, runId))
          if (rows.length > 0) {
            const { error } = await admin.from('snapshots').insert(rows)
            if (error) throw new Error(error.message)
          }
          s.companies! += 1
          s.snapshots! += rows.length
          hadSuccess = true
        } catch (e) {
          hadError = true
          s.errors.push(`${company.name}: ${errMsg(e)}`)
          log(`${collector.key} failed`, { company: company.name, error: errMsg(e) })
        }
      })
    }

    // ---- SERP ------------------------------------------------------------------
    if (wanted.size === 0 || wanted.has('serp')) {
      const provider = serpProviderFromEnv(env)
      const s: CollectorSummary = { queries: 0, results: 0, errors: [], cost: 0 }
      summary.serp = s
      if (!provider) {
        s.errors.push('No SERP provider configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).')
        hadError = true
      } else {
        const matchable: MatchableCompany[] = cos.map((c) => ({
          id: c.id,
          name: c.name,
          website_domain: c.website_domain,
          extra_domains: c.extra_domains,
          company_profiles: c.company_profiles.map((p) => ({ platform: p.platform, url: p.url, alt_urls: p.alt_urls, external_id: p.external_id, handle: p.handle })),
        }))
        const client = cos.find((c) => c.is_client)
        const brandedOwners: string[] = []

        await mapLimit(qs, 2, async (q) => {
          try {
            const cap = await provider.search({
              phrase: q.phrase,
              location: workspace.search_location,
              device: workspace.search_device,
              language: workspace.search_language,
            })
            const { data: serpRun, error: srErr } = await admin
              .from('serp_runs')
              .insert({
                query_id: q.id,
                run_id: runId,
                provider: cap.provider,
                location: cap.location,
                device: cap.device,
                total_organic: cap.totalOrganic,
                has_local_pack: cap.hasLocalPack,
                cost_units: cap.costUnits ?? null,
                raw: cap.raw as never,
              })
              .select('id')
              .single()
            if (srErr || !serpRun) throw new Error(srErr?.message ?? 'serp_runs insert failed')
            const rows: SerpResultInsert[] = cap.results.map((r) => {
              const m = matchCompany(r, matchable)
              return {
                serp_run_id: serpRun.id,
                result_type: r.resultType,
                position: r.position,
                title: r.title ?? null,
                url: r.url ?? null,
                domain: r.domain ?? null,
                place_id: r.placeId ?? null,
                rating: r.rating ?? null,
                review_count: r.reviewCount ?? null,
                matched_company_id: m?.companyId ?? null,
                match_kind: m?.kind ?? null,
              }
            })
            if (rows.length > 0) {
              const { error } = await admin.from('serp_results').insert(rows)
              if (error) throw new Error(error.message)
            }
            s.queries! += 1
            s.results! += rows.length
            s.cost! += cap.costUnits ?? 0
            hadSuccess = true
            if (q.is_branded) {
              const top = rows.find((r) => r.result_type === 'organic' && r.position === 1)
              if (top) {
                const owner = top.matched_company_id ? cos.find((c) => c.id === top.matched_company_id)?.name : null
                brandedOwners.push(`${q.phrase}: ${owner ?? top.domain ?? 'unknown'}`)
              }
            }
          } catch (e) {
            hadError = true
            s.errors.push(`${q.phrase}: ${errMsg(e)}`)
            log('serp failed', { query: q.phrase, error: errMsg(e) })
          }
        })

        // Derived: who holds position 1 on the client's branded queries.
        if (client && brandedOwners.length > 0 && apiMetrics.some((m) => m.key === 'branded_top_result_owner')) {
          await admin.from('snapshots').insert({
            company_id: client.id,
            metric_key: 'branded_top_result_owner',
            source: 'api',
            collector_key: 'serp',
            run_id: runId,
            value_text: brandedOwners.join(' · '),
          })
        }
      }
    }
  } catch (e) {
    hadError = true
    summary.fatal = { errors: [errMsg(e)] }
    log('fatal', { error: errMsg(e) })
  }

  const status = hadError ? (hadSuccess ? 'partial' : 'failed') : 'succeeded'
  await admin.from('collection_runs').update({ status, finished_at: new Date().toISOString(), summary: summary as never }).eq('id', runId)
  log('done', { status })
}

function toSnapshot(v: MetricValue, companyId: string, collectorKey: string, runId: string): SnapshotInsert {
  const base: SnapshotInsert = { company_id: companyId, metric_key: v.metricKey, source: 'api', collector_key: collectorKey, run_id: runId, raw: (v.raw ?? null) as never }
  switch (v.kind) {
    case 'num':
      return { ...base, value_num: v.value }
    case 'bool':
      return { ...base, value_bool: v.value }
    case 'text':
      return { ...base, value_text: v.value }
    case 'date':
      return { ...base, value_date: v.value }
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
