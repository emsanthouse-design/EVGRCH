import { dataForSeoProvider, type SerpProvider } from './dataforseo'
import { serpApiProvider } from './serpapi'

/**
 * Picks the SERP provider from environment variables.
 * SERPAPI_KEY wins when set (free plan to start); otherwise DataForSEO credentials.
 */
export function serpProviderFromEnv(env: (k: string) => string | undefined): SerpProvider | null {
  const serpapi = env('SERPAPI_KEY')
  if (serpapi) return serpApiProvider(serpapi)
  const login = env('DATAFORSEO_LOGIN')
  const password = env('DATAFORSEO_PASSWORD')
  if (login && password) return dataForSeoProvider(login, password)
  return null
}
