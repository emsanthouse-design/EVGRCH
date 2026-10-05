-- 0007: a profile can have alternate URLs (duplicate listings, old slugs) that still count as the company
alter table company_profiles add column alt_urls text[] not null default '{}';
update company_profiles p set alt_urls = array['https://www.houzz.com/professionals/home-builders/rch-construction-inc-pfvwus-pf~1704615005']
from companies c where c.id = p.company_id and c.name = 'RCH Construction' and p.platform = 'houzz';
