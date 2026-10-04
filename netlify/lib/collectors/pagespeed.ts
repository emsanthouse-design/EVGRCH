/**
 * PageSpeed Insights API v5. Free. Mobile performance score is the metric;
 * desktop score and Core Web Vitals field data are kept in `raw`.
 */
import type { CompanyCollector, MetricValue } from './types'

export const pagespeedCollector: CompanyCollector = {
  key: 'pagespeed',
  produces: ['mobile_performance_score'],
  canRun(company) {
    return !!company.website_url
  },
  async collect(company, ctx) {
    const key = ctx.env('PAGESPEED_API_KEY') ?? ctx.env('GOOGLE_MAPS_API_KEY')
    const mobile = await run(company.website_url!, 'mobile', key)
    let desktop: Awaited<ReturnType<typeof run>> | null = null
    try {
      desktop = await run(company.website_url!, 'desktop', key)
    } catch (e) {
      ctx.log('pagespeed: desktop run failed', { company: company.name, error: String(e) })
    }
    const out: MetricValue[] = []
    if (mobile.score != null) {
      out.push({
        metricKey: 'mobile_performance_score',
        kind: 'num',
        value: Math.round(mobile.score * 100),
        raw: { mobile, desktop },
      })
    }
    return out
  },
}

async function run(url: string, strategy: 'mobile' | 'desktop', key: string | undefined) {
  const params = new URLSearchParams({ url, strategy, category: 'performance' })
  if (key) params.set('key', key)
  const res = await fetch(`https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`)
  if (!res.ok) throw new Error(`PageSpeed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as {
    lighthouseResult?: { finalUrl?: string; categories?: { performance?: { score?: number } }; audits?: Record<string, { numericValue?: number; displayValue?: string }> }
    loadingExperience?: { overall_category?: string; metrics?: Record<string, { percentile?: number; category?: string }> }
  }
  const audits = json.lighthouseResult?.audits ?? {}
  return {
    strategy,
    finalUrl: json.lighthouseResult?.finalUrl,
    score: json.lighthouseResult?.categories?.performance?.score ?? null,
    lab: {
      lcp_ms: audits['largest-contentful-paint']?.numericValue,
      cls: audits['cumulative-layout-shift']?.numericValue,
      tbt_ms: audits['total-blocking-time']?.numericValue,
      speed_index_ms: audits['speed-index']?.numericValue,
    },
    field: json.loadingExperience?.metrics
      ? {
          overall: json.loadingExperience.overall_category,
          lcp: json.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS,
          inp: json.loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT,
          cls: json.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE,
        }
      : null,
  }
}
