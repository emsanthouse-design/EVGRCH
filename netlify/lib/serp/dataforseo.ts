/**
 * DataForSEO adapter: Google organic SERP, Live Advanced endpoint.
 * One call returns organic results, the local pack and paid results together.
 * Docs: https://docs.dataforseo.com/v3/serp-google-organic-live-advanced/
 */
import type { SerpCapture, SerpResultIn } from '../collectors/types'
import { normalizeDomain } from '../matching'

export interface SerpProvider {
  key: string
  search(input: { phrase: string; location: string; device: string; language: string; depth?: number }): Promise<SerpCapture>
}

interface DfsItem {
  type: string
  rank_group?: number
  rank_absolute?: number
  title?: string
  url?: string
  domain?: string
  cid?: string
  rating?: { value?: number; votes_count?: number } | null
  // local_pack items
  description?: string
  phone?: string
  is_paid?: boolean
  // other containers may hold nested items
  items?: DfsItem[]
}

interface DfsResponse {
  status_code: number
  status_message: string
  cost?: number
  tasks?: {
    status_code: number
    status_message: string
    cost?: number
    result?: {
      keyword: string
      location_code?: number
      items_count?: number
      se_results_count?: number
      items?: DfsItem[]
    }[]
  }[]
}

export function dataForSeoProvider(login: string, password: string, fetchImpl: typeof fetch = fetch): SerpProvider {
  const auth = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')
  return {
    key: 'dataforseo',
    async search({ phrase, location, device, language, depth = 20 }) {
      const body = [
        {
          keyword: phrase,
          location_name: location,
          language_code: language,
          device,
          os: device === 'mobile' ? 'android' : 'windows',
          depth,
          calculate_rectangles: false,
        },
      ]
      const res = await fetchImpl('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: { authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`)
      const json = (await res.json()) as DfsResponse
      return parseDataForSeo(json, { location, device })
    },
  }
}

/** Pure parser so it can be unit-tested against a recorded response. */
export function parseDataForSeo(json: DfsResponse, meta: { location: string; device: string }): SerpCapture {
  const task = json.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task?.status_code ?? json.status_code} ${task?.status_message ?? json.status_message}`)
  }
  const result = task.result?.[0]
  const items = result?.items ?? []
  const out: SerpResultIn[] = []
  let organic = 0
  let local = 0
  let ads = 0
  let hasLocalPack = false

  for (const it of items) {
    switch (it.type) {
      case 'organic':
        organic += 1
        out.push({ resultType: 'organic', position: it.rank_group ?? organic, title: it.title ?? null, url: it.url ?? null, domain: normalizeDomain(it.domain ?? it.url) })
        break
      case 'local_pack':
        hasLocalPack = true
        local += 1
        out.push({
          resultType: 'local_pack',
          position: it.rank_group ?? local,
          title: it.title ?? null,
          url: it.url ?? null,
          domain: normalizeDomain(it.domain ?? it.url),
          placeId: it.cid ?? null,
          rating: it.rating?.value ?? null,
          reviewCount: it.rating?.votes_count ?? null,
        })
        break
      case 'paid':
        ads += 1
        out.push({ resultType: 'ad', position: it.rank_group ?? ads, title: it.title ?? null, url: it.url ?? null, domain: normalizeDomain(it.domain ?? it.url) })
        break
      case 'map':
        // Map block without listings: still signals a local intent result.
        hasLocalPack = hasLocalPack || (it.items?.length ?? 0) > 0
        break
      default:
        break
    }
  }

  return {
    provider: 'dataforseo',
    location: meta.location,
    device: meta.device,
    totalOrganic: organic,
    hasLocalPack,
    costUnits: task.cost ?? json.cost,
    results: out,
    raw: { keyword: result?.keyword, se_results_count: result?.se_results_count, items_count: result?.items_count, items: items.map(slim) },
  }
}

function slim(it: DfsItem) {
  const { items: _nested, ...rest } = it
  return rest
}
