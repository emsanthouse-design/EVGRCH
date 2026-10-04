import { describe, expect, it } from 'vitest'
import { matchCompany, normalizeDomain, normalizeName, type MatchableCompany } from '../matching'

const companies: MatchableCompany[] = [
  {
    id: 'rch',
    name: 'RCH Construction',
    website_domain: 'rchconstruction.com',
    extra_domains: ['rchconco.com'],
    company_profiles: [
      { platform: 'google', url: null, external_id: '123456', handle: 'RCH Construction, Inc.' },
      { platform: 'houzz', url: 'https://www.houzz.com/professionals/general-contractors/rch-construction-inc-pfvwus-pf~1104226863', external_id: null, handle: null },
    ],
  },
  {
    id: 'hhi',
    name: 'HHI Builders',
    website_domain: 'hhi-builders.com',
    extra_domains: [],
    company_profiles: [{ platform: 'google', url: null, external_id: null, handle: 'HHI Builders' }],
  },
]

describe('normalizeDomain', () => {
  it('strips scheme, www and trailing dot', () => {
    expect(normalizeDomain('https://www.RCHConstruction.com/path')).toBe('rchconstruction.com')
    expect(normalizeDomain('www.hhi-builders.com.')).toBe('hhi-builders.com')
    expect(normalizeDomain(null)).toBeNull()
  })
})

describe('normalizeName', () => {
  it('drops legal suffixes and punctuation', () => {
    expect(normalizeName('RCH Construction, Inc.')).toBe('rch construction')
    expect(normalizeName('Bellwether Design + Build LLC')).toBe('bellwether design build')
  })
})

describe('matchCompany', () => {
  it('matches organic results by own domain and subdomains', () => {
    expect(matchCompany({ resultType: 'organic', url: 'https://www.rchconstruction.com/about' }, companies)).toEqual({ companyId: 'rch', kind: 'own_site' })
    expect(matchCompany({ resultType: 'organic', domain: 'blog.hhi-builders.com' }, companies)).toEqual({ companyId: 'hhi', kind: 'own_site' })
  })
  it('matches legacy domains listed in extra_domains', () => {
    expect(matchCompany({ resultType: 'organic', url: 'http://www.rchconco.com/' }, companies)).toEqual({ companyId: 'rch', kind: 'own_site' })
  })
  it('does not match a different domain that merely contains the name', () => {
    expect(matchCompany({ resultType: 'organic', url: 'https://notrchconstruction.com/' }, companies)).toBeNull()
  })
  it('matches a known third-party profile page', () => {
    expect(
      matchCompany({ resultType: 'organic', url: 'https://www.houzz.com/professionals/general-contractors/rch-construction-inc-pfvwus-pf~1104226863/' }, companies),
    ).toEqual({ companyId: 'rch', kind: 'third_party_profile' })
  })
  it('does not match a different Houzz profile', () => {
    expect(matchCompany({ resultType: 'organic', url: 'https://www.houzz.com/professionals/home-builders/h2-builders-pfvwus-pf~345614621' }, companies)).toBeNull()
  })
  it('matches local pack by cid first', () => {
    expect(matchCompany({ resultType: 'local_pack', placeId: '123456', title: 'Something else' }, companies)).toEqual({ companyId: 'rch', kind: 'local_pack' })
  })
  it('matches local pack by domain, then by name', () => {
    expect(matchCompany({ resultType: 'local_pack', domain: 'hhi-builders.com', title: 'x' }, companies)).toEqual({ companyId: 'hhi', kind: 'local_pack' })
    expect(matchCompany({ resultType: 'local_pack', title: 'RCH Construction, Inc.' }, companies)).toEqual({ companyId: 'rch', kind: 'local_pack' })
    expect(matchCompany({ resultType: 'local_pack', title: 'Esposito Construction' }, companies)).toBeNull()
  })
})
