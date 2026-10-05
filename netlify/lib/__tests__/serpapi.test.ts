import { describe, expect, it } from 'vitest'
import { parseSerpApi } from '../serp/serpapi'

const sample = {
  search_metadata: { id: 'abc', status: 'Success' },
  search_information: { total_results: 4210 },
  ads: [{ position: 1, block_position: 'top', title: 'HHI Builders | Remodeling', link: 'https://www.hhi-builders.com/landing', displayed_link: 'https://www.hhi-builders.com' }],
  local_results: {
    places: [
      { position: 1, title: 'RCH Construction, Inc.', place_id: 'ChIJabc', data_cid: '9876', rating: 4.8, reviews: 27, links: { website: 'https://rchconstruction.com/' } },
      { position: 2, title: 'HHI Builders', place_id: 'ChIJdef', data_cid: '555', rating: 4.6, reviews: 21 },
    ],
    more_locations_link: 'https://google.com/maps',
  },
  organic_results: [
    { position: 1, title: 'RCH Construction', link: 'https://rchconstruction.com/', displayed_link: 'https://rchconstruction.com' },
    { position: 2, title: 'RCH Construction - Houzz', link: 'https://www.houzz.com/professionals/x', displayed_link: 'https://www.houzz.com › ...' },
  ],
}

describe('parseSerpApi', () => {
  it('separates organic, local pack and ads with normalized domains', () => {
    const cap = parseSerpApi(sample, { location: 'Hilton Head Island, South Carolina, United States', device: 'desktop' })
    expect(cap.provider).toBe('serpapi')
    expect(cap.totalOrganic).toBe(2)
    expect(cap.hasLocalPack).toBe(true)
    const organic = cap.results.filter((r) => r.resultType === 'organic')
    expect(organic.map((r) => [r.position, r.domain])).toEqual([
      [1, 'rchconstruction.com'],
      [2, 'houzz.com'],
    ])
    const local = cap.results.filter((r) => r.resultType === 'local_pack')
    expect(local[0]).toMatchObject({ position: 1, placeId: '9876', rating: 4.8, reviewCount: 27, domain: 'rchconstruction.com' })
    expect(local[1]).toMatchObject({ position: 2, placeId: '555', domain: null })
    const ads = cap.results.filter((r) => r.resultType === 'ad')
    expect(ads[0]).toMatchObject({ position: 1, domain: 'hhi-builders.com' })
  })
  it('accepts local_results as a bare array', () => {
    const cap = parseSerpApi({ organic_results: [], local_results: [{ position: 1, title: 'X', data_cid: '1' }] }, { location: 'x', device: 'desktop' })
    expect(cap.hasLocalPack).toBe(true)
    expect(cap.results[0]).toMatchObject({ resultType: 'local_pack', placeId: '1' })
  })
  it('throws on an API error payload', () => {
    expect(() => parseSerpApi({ error: 'Invalid API key' }, { location: 'x', device: 'desktop' })).toThrow(/Invalid API key/)
  })
})
