import type { CompanyCollector } from './types'
import { googlePlacesCollector } from './google_places'
import { pagespeedCollector } from './pagespeed'

/** Registry. Add a module here and flip the metric's source to 'api'. */
export const companyCollectors: CompanyCollector[] = [googlePlacesCollector, pagespeedCollector]

export function collectorByKey(key: string): CompanyCollector | undefined {
  return companyCollectors.find((c) => c.key === key)
}
