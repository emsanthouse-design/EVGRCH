/**
 * Google Places API (New). Place Details with rating + userRatingCount is the
 * Enterprise SKU (1,000 free requests/month, then $20 per 1,000). We do not
 * request `reviews`, which would raise it to Enterprise + Atmosphere.
 * Place ID resolution uses Text Search with an IDs-only field mask (free).
 */
import type { CompanyCollector, Company, CollectorContext, MetricValue } from './types'

const DETAILS_FIELDS = 'id,displayName,rating,userRatingCount,websiteUri,googleMapsUri,formattedAddress,businessStatus'

export const googlePlacesCollector: CompanyCollector = {
  key: 'google_places',
  produces: ['google_rating', 'google_review_count'],
  canRun(company) {
    // Needs either a stored place ID or enough to search for one.
    const g = company.company_profiles.find((p) => p.platform === 'google')
    return !!(g?.external_id || company.name)
  },
  async collect(company, ctx) {
    const key = ctx.env('GOOGLE_MAPS_API_KEY')
    if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set')
    const g = company.company_profiles.find((p) => p.platform === 'google')
    let placeId = g?.external_id ?? null
    if (!placeId) {
      placeId = await resolvePlaceId(company, ctx, key)
      if (!placeId) {
        ctx.log('google_places: no place found', { company: company.name })
        return []
      }
      ctx.onProfileResolved?.(company.id, 'google', { external_id: placeId })
    }
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAILS_FIELDS },
    })
    if (!res.ok) throw new Error(`Places details HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const place = (await res.json()) as {
      id: string
      displayName?: { text: string }
      rating?: number
      userRatingCount?: number
      websiteUri?: string
      googleMapsUri?: string
      formattedAddress?: string
      businessStatus?: string
    }
    if (place.googleMapsUri && !g?.url) ctx.onProfileResolved?.(company.id, 'google', { url: place.googleMapsUri })
    const raw = { id: place.id, name: place.displayName?.text, address: place.formattedAddress, status: place.businessStatus, website: place.websiteUri }
    const out: MetricValue[] = []
    if (typeof place.rating === 'number') out.push({ metricKey: 'google_rating', kind: 'num', value: place.rating, raw })
    if (typeof place.userRatingCount === 'number') out.push({ metricKey: 'google_review_count', kind: 'num', value: place.userRatingCount, raw })
    return out
  },
}

async function resolvePlaceId(company: Company, ctx: CollectorContext, key: string): Promise<string | null> {
  const g = company.company_profiles.find((p) => p.platform === 'google')
  const query = `${g?.handle || company.name} ${company.city ?? ''} ${ctx.workspace.search_location.split(',')[1] ?? ''}`.trim()
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri', 'content-type': 'application/json' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5, languageCode: 'en', regionCode: 'us' }),
  })
  if (!res.ok) throw new Error(`Places search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { places?: { id: string; displayName?: { text: string }; websiteUri?: string }[] }
  const places = json.places ?? []
  if (places.length === 0) return null
  // Prefer the candidate whose website matches the company domain; else the first.
  const dom = company.website_domain?.toLowerCase()
  const byDomain = dom
    ? places.find((p) => {
        try {
          return p.websiteUri && new URL(p.websiteUri).hostname.replace(/^www\./, '').toLowerCase().endsWith(dom)
        } catch {
          return false
        }
      })
    : undefined
  const chosen = byDomain ?? places[0]
  ctx.log('google_places: resolved place id', { company: company.name, query, chosen: chosen.displayName?.text, byDomain: !!byDomain })
  return chosen.id
}
