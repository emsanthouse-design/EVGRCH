/**
 * SerpApi adapter: engine=google. Free plan is 250 searches/month, 50/hour.
 * One call returns organic results, the local pack and ads together.
 * Docs: https://serpapi.com/search-api, https://serpapi.com/local-pack
 */
import type { SerpCapture, SerpResultIn } from '../collectors/types'
import { normalizeDomain } from '../matching'
import type { SerpProvider } from './dataforseo'

interface SerpApiResponse {
  search_metadata?: { id?: string; status?: string; total_time_taken?: number }
  search_information?: { total_results?: number; organic_results_state?: string }
  error?: string
  organic_results?: { position: number; title?: string; link?: string; displayed_link?: string }[]
  local_results?:
    | { places?: SerpApiPlace[]; more_locations_link?: string }
    | SerpApiPlace[]
  ads?: { position?: number; block_position?: string; title?: string; link?: string; displayed_link?: string; tracking_link?: string }[]
  knowledge_graph?: { title?: string; type?: string; website?: string; rating?: number; review_count?: number; reviews?: number; place_id?: string; address?: string }
}
interface SerpApiPlace {
  position: number
  title?: string
  place_id?: string
  data_cid?: string
  rating?: number
  reviews?: number
  links?: { website?: string; directions?: string }
  website?: string
  address?: string
}

export function serpApiProvider(apiKey: string, fetchImpl: typeof fetch = fetch): SerpProvider {
  return {
    key: 'serpapi',
    async search({ phrase, location, device, language, depth = 20 }) {
      const params = new URLSearchParams({
        engine: 'google',
        q: phrase,
        location,
        hl: language,
        gl: 'us',
        google_domain: 'google.com',
        device,
        num: String(depth),
        api_key: apiKey,
      })
      const res = await fetchImpl(`https://serpapi.com/search.json?${params}`)
      if (!res.ok && res.status !== 400) throw new Error(`SerpApi HTTP ${res.status}`)
      const json = (await res.json()) as SerpApiResponse
      return parseSerpApi(json, { location, device })
    },
  }
}

/** Pure parser, unit-tested against a recorded response shape. */
export function parseSerpApi(json: SerpApiResponse, meta: { location: string; device: string }): SerpCapture {
  if (json.error) throw new Error(`SerpApi: ${json.error}`)
  const out: SerpResultIn[] = []

  const organic = json.organic_results ?? []
  organic.forEach((r, i) => {
    out.push({ resultType: 'organic', position: r.position ?? i + 1, title: r.title ?? null, url: r.link ?? null, domain: normalizeDomain(r.link ?? r.displayed_link) })
  })

  const places: SerpApiPlace[] = Array.isArray(json.local_results) ? json.local_results : (json.local_results?.places ?? [])
  places.forEach((p, i) => {
    const site = p.links?.website ?? p.website ?? null
    out.push({
      resultType: 'local_pack',
      position: p.position ?? i + 1,
      title: p.title ?? null,
      url: site,
      domain: normalizeDomain(site),
      placeId: p.data_cid ?? p.place_id ?? null,
      rating: p.rating ?? null,
      reviewCount: p.reviews ?? null,
    })
  })

  const ads = json.ads ?? []
  ads.forEach((a, i) => {
    const link = a.link ?? a.tracking_link ?? null
    out.push({ resultType: 'ad', position: a.position ?? i + 1, title: a.title ?? null, url: link, domain: normalizeDomain(a.link ?? a.displayed_link) })
  })

  // Knowledge panel (branded searches): recorded as an 'other' result at position 0 so the
  // Search view can show whose panel Google displays for the query.
  const kg = json.knowledge_graph
  if (kg?.title) {
    out.push({
      resultType: 'other',
      position: 0,
      title: `Knowledge panel: ${kg.title}`,
      url: kg.website ?? null,
      domain: normalizeDomain(kg.website),
      placeId: kg.place_id ?? null,
      rating: kg.rating ?? null,
      reviewCount: kg.review_count ?? kg.reviews ?? null,
    })
  }

  return {
    provider: 'serpapi',
    location: meta.location,
    device: meta.device,
    totalOrganic: organic.length,
    hasLocalPack: places.length > 0,
    costUnits: 1,
    results: out,
    raw: {
      search_id: json.search_metadata?.id,
      total_results: json.search_information?.total_results,
      organic_results: organic,
      local_results: places,
      ads,
      knowledge_graph: kg ? { title: kg.title, type: kg.type, website: kg.website, rating: kg.rating, review_count: kg.review_count ?? kg.reviews, address: kg.address } : null,
    },
  }
}
