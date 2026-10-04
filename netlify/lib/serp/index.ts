import { dataForSeoProvider, type SerpProvider } from './dataforseo'

export function serpProviderFromEnv(env: (k: string) => string | undefined): SerpProvider | null {
  const login = env('DATAFORSEO_LOGIN')
  const password = env('DATAFORSEO_PASSWORD')
  if (login && password) return dataForSeoProvider(login, password)
  return null
}
