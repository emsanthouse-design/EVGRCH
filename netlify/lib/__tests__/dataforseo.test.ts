import { describe, expect, it } from 'vitest'
import { parseDataForSeo } from '../serp/dataforseo'

const sample = {
  status_code: 20000,
  status_message: 'Ok.',
  cost: 0.002,
  tasks: [
    {
      status_code: 20000,
      status_message: 'Ok.',
      cost: 0.002,
      result: [
        {
          keyword: 'RCH Construction',
          se_results_count: 12345,
          items_count: 6,
          items: [
            { type: 'paid', rank_group: 1, rank_absolute: 1, title: 'HHI Builders - Remodeling', url: 'https://www.hhi-builders.com/lp', domain: 'www.hhi-builders.com' },
            {
              type: 'local_pack',
              rank_group: 1,
              rank_absolute: 2,
              title: 'RCH Construction, Inc.',
              domain: 'rchconstruction.com',
              url: 'https://rchconstruction.com/',
              cid: '9876',
              rating: { value: 4.8, votes_count: 27 },
            },
            { type: 'local_pack', rank_group: 2, rank_absolute: 3, title: 'HHI Builders', domain: 'hhi-builders.com', url: null, cid: '555', rating: { value: 4.6, votes_count: 21 } },
            { type: 'organic', rank_group: 1, rank_absolute: 4, title: 'RCH Construction', url: 'https://rchconstruction.com/', domain: 'rchconstruction.com' },
            { type: 'organic', rank_group: 2, rank_absolute: 5, title: 'RCH Construction - Houzz', url: 'https://www.houzz.com/professionals/x', domain: 'www.houzz.com' },
            { type: 'people_also_ask', rank_group: 1, rank_absolute: 6, items: [{ type: 'people_also_ask_element', title: 'q' }] },
          ],
        },
      ],
    },
  ],
}

describe('parseDataForSeo', () => {
  it('separates organic, local pack and ads with normalized domains', () => {
    const cap = parseDataForSeo(sample as never, { location: 'Hilton Head Island, South Carolina, United States', device: 'desktop' })
    expect(cap.provider).toBe('dataforseo')
    expect(cap.totalOrganic).toBe(2)
    expect(cap.hasLocalPack).toBe(true)
    expect(cap.costUnits).toBe(0.002)
    const organic = cap.results.filter((r) => r.resultType === 'organic')
    expect(organic.map((r) => [r.position, r.domain])).toEqual([
      [1, 'rchconstruction.com'],
      [2, 'houzz.com'],
    ])
    const local = cap.results.filter((r) => r.resultType === 'local_pack')
    expect(local[0]).toMatchObject({ position: 1, placeId: '9876', rating: 4.8, reviewCount: 27, domain: 'rchconstruction.com' })
    const ads = cap.results.filter((r) => r.resultType === 'ad')
    expect(ads[0]).toMatchObject({ position: 1, domain: 'hhi-builders.com' })
  })
  it('throws on a failed task', () => {
    expect(() => parseDataForSeo({ status_code: 20000, status_message: 'Ok.', tasks: [{ status_code: 40501, status_message: 'Invalid Field' }] } as never, { location: 'x', device: 'desktop' })).toThrow(/40501/)
  })
})
