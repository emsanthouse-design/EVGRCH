/** Domain normalization and company matching for search results. Pure functions, unit-tested. */

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null
  let host = input.trim().toLowerCase()
  try {
    if (/^[a-z]+:\/\//.test(host)) host = new URL(host).hostname
    else host = host.split('/')[0]
  } catch {
    host = host.split('/')[0]
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '')
  return host || null
}

export function domainOfUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return normalizeDomain(new URL(url).hostname)
  } catch {
    return null
  }
}

export function sameOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain)
}

export interface MatchableCompany {
  id: string
  name: string
  website_domain: string | null
  extra_domains: string[]
  company_profiles: { platform: string; url: string | null; external_id: string | null; handle: string | null }[]
}

export interface MatchableResult {
  resultType: 'organic' | 'local_pack' | 'ad' | 'other'
  url?: string | null
  domain?: string | null
  title?: string | null
  placeId?: string | null
}

export type Match = { companyId: string; kind: 'own_site' | 'third_party_profile' | 'local_pack' } | null

const PROFILE_HOSTS = ['houzz.com', 'yelp.com', 'facebook.com', 'instagram.com', 'bbb.org', 'angi.com', 'nextdoor.com']

/** Strip punctuation and legal suffixes so "RCH Construction, Inc." and "RCH Construction" compare equal. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(inc|llc|co|company|corp|corporation|ltd)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchCompany(result: MatchableResult, companies: MatchableCompany[]): Match {
  const host = normalizeDomain(result.domain) ?? domainOfUrl(result.url)

  // 1. Local pack: Google CID / place id stored on the google profile, then domain, then name.
  if (result.resultType === 'local_pack') {
    if (result.placeId) {
      for (const c of companies) {
        const g = c.company_profiles.find((p) => p.platform === 'google')
        if (g?.external_id && g.external_id === result.placeId) return { companyId: c.id, kind: 'local_pack' }
      }
    }
    if (host) {
      const byDomain = companies.find((c) => ownsDomain(c, host))
      if (byDomain) return { companyId: byDomain.id, kind: 'local_pack' }
    }
    if (result.title) {
      const t = normalizeName(result.title)
      const byName = companies.find((c) => {
        const g = c.company_profiles.find((p) => p.platform === 'google')
        const candidates = [c.name, g?.handle ?? ''].filter(Boolean).map(normalizeName)
        return candidates.some((n) => n && (n === t || t.startsWith(n + ' ') || n.startsWith(t + ' ')))
      })
      if (byName) return { companyId: byName.id, kind: 'local_pack' }
    }
    return null
  }

  if (!host) return null

  // 2. Own website (or an extra domain), including subdomains.
  const own = companies.find((c) => ownsDomain(c, host))
  if (own) return { companyId: own.id, kind: 'own_site' }

  // 3. A third-party profile page we know about (Houzz, Yelp, ...): match the URL path.
  if (result.url && PROFILE_HOSTS.some((h) => sameOrSubdomain(host, h))) {
    const target = canonicalPath(result.url)
    for (const c of companies) {
      for (const p of c.company_profiles) {
        if (!p.url) continue
        const pd = domainOfUrl(p.url)
        if (!pd || !sameOrSubdomain(host, pd)) continue
        const pp = canonicalPath(p.url)
        if (pp && target && (target === pp || target.startsWith(pp + '/') || pp.startsWith(target + '/'))) {
          return { companyId: c.id, kind: 'third_party_profile' }
        }
      }
    }
  }
  return null
}

function ownsDomain(c: MatchableCompany, host: string): boolean {
  const domains = [c.website_domain, ...c.extra_domains].map((d) => normalizeDomain(d)).filter((d): d is string => !!d)
  return domains.some((d) => sameOrSubdomain(host, d))
}

function canonicalPath(url: string): string | null {
  try {
    const u = new URL(url)
    return u.pathname.replace(/\/+$/, '').toLowerCase() || null
  } catch {
    return null
  }
}
