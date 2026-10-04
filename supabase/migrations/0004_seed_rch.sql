-- 0004_seed_rch: the RCH Construction workspace, companies, profiles, queries, first admin invite
insert into workspaces (slug, name, search_location)
values ('rch', 'RCH Construction', 'Hilton Head Island, South Carolina, United States');

-- first agency admin (bootstrap). Further invites are managed in Settings.
insert into invites (email, is_agency_admin) values ('emsanthouse@gmail.com', true);

with ws as (select id from workspaces where slug = 'rch'),
co as (
  insert into companies (workspace_id, name, short_name, website_url, website_domain, extra_domains, city, is_client, "group", sort_order)
  select ws.id, v.name, v.short_name, v.website_url, v.website_domain, v.extra_domains, v.city, v.is_client, v.grp::company_group, v.sort_order
  from ws, (values
    ('RCH Construction',            'RCH',       'https://rchconstruction.com/',        'rchconstruction.com',        array['rchconco.com'],                                'Hilton Head Island', true,  'client',      1),
    ('HHI Builders',                'HHI',       'https://www.hhi-builders.com/',       'hhi-builders.com',           array[]::text[],                                      'Hilton Head Island', false, 'direct_peer', 10),
    ('Roberts Construction Company','Roberts',   'https://rconstructionhhi.com/',       'rconstructionhhi.com',       array[]::text[],                                      'Hilton Head Island', false, 'direct_peer', 20),
    ('TDC Builders',                'TDC',       'https://tdc-builders.com/',           'tdc-builders.com',           array['totaldesignhhi.com','tdc-builders.pages.dev'], 'Hilton Head Island', false, 'direct_peer', 30),
    ('Esposito Construction',       'Esposito',  'https://espositoconstructioninc.com/','espositoconstructioninc.com',array[]::text[],                                      'Hilton Head Island', false, 'direct_peer', 40),
    ('Bellwether Design + Build',   'Bellwether','https://www.bellwethersc.com/',       'bellwethersc.com',           array[]::text[],                                      'Bluffton',           false, 'direct_peer', 50),
    ('Allen Patterson Builders',    'Allen P.',  'https://allenpattersonbuilders.com/', 'allenpattersonbuilders.com', array[]::text[],                                      'Beaufort',           false, 'direct_peer', 60),
    ('H2 Builders',                 'H2',        'https://www.h2builders.com/',         'h2builders.com',             array[]::text[],                                      'Bluffton',           false, 'benchmark',   100)
  ) as v(name, short_name, website_url, website_domain, extra_domains, city, is_client, grp, sort_order)
  returning id, name
)
insert into company_profiles (company_id, platform, url, handle, notes)
select co.id, p.platform, p.url, p.handle, p.notes
from co join (values
  ('RCH Construction', 'google',    null, 'RCH Construction, Inc.', 'Place ID to be resolved by the Places collector.'),
  ('RCH Construction', 'yelp',      'https://www.yelp.com/biz/rch-construction-hilton-head-island-2', null, null),
  ('RCH Construction', 'houzz',     'https://www.houzz.com/professionals/general-contractors/rch-construction-inc-pfvwus-pf~1104226863', null, 'Duplicate profile exists: .../home-builders/rch-construction-inc-pfvwus-pf~1704615005'),
  ('RCH Construction', 'instagram', 'https://www.instagram.com/rchconco/', 'rchconco', null),
  ('RCH Construction', 'facebook',  null, null, 'No page found as of 2026-10-04.'),
  ('HHI Builders', 'google',    null, 'HHI Builders', null),
  ('HHI Builders', 'yelp',      'https://www.yelp.com/biz/hhi-builders-hilton-head-island', null, null),
  ('HHI Builders', 'houzz',     'https://www.houzz.com/professionals/kitchen-and-bath-remodelers/hhi-builders-pfvwus-pf~1513956710', null, null),
  ('HHI Builders', 'instagram', 'https://www.instagram.com/hhibuilders/', 'hhibuilders', null),
  ('HHI Builders', 'facebook',  'https://www.facebook.com/hhibuilders/', null, null),
  ('Roberts Construction Company', 'google',    null, 'Roberts Construction Company', null),
  ('Roberts Construction Company', 'yelp',      'https://www.yelp.com/biz/roberts-construction-hilton-head-island-2', null, null),
  ('Roberts Construction Company', 'houzz',     'https://www.houzz.com/professionals/general-contractors/roberts-construction-company-pfvwus-pf~1864388060', null, null),
  ('Roberts Construction Company', 'instagram', 'https://www.instagram.com/roberts.construction.company/', 'roberts.construction.company', null),
  ('Roberts Construction Company', 'facebook',  'https://www.facebook.com/rconstructionhhi/', null, null),
  ('Roberts Construction Company', 'bbb',       'https://www.bbb.org/us/sc/hilton-head-island/profile/home-builders/roberts-construction-0403-235958693', null, null),
  ('TDC Builders', 'google',    null, 'TDC Builders', 'Aggregators show the name as "Total Designs Concepts Inc".'),
  ('TDC Builders', 'facebook',  'https://www.facebook.com/totaldesignconcepts/', null, null),
  ('TDC Builders', 'bbb',       'https://www.bbb.org/us/sc/hilton-head/profile/bathroom-design/total-design-concepts-llc-0403-235958439', null, null),
  ('Esposito Construction', 'google',    null, 'Esposito Construction', null),
  ('Esposito Construction', 'yelp',      'https://www.yelp.com/biz/esposito-construction-hilton-head-island', null, null),
  ('Esposito Construction', 'houzz',     'https://www.houzz.com/professionals/home-builders/esposito-construction-inc-pfvwus-pf~503329436', null, null),
  ('Esposito Construction', 'instagram', 'https://www.instagram.com/espositoconstructioninc/', 'espositoconstructioninc', null),
  ('Esposito Construction', 'facebook',  'https://www.facebook.com/brianespositoconstructioninc/', null, null),
  ('Bellwether Design + Build', 'google',    null, 'Bellwether Design + Build', null),
  ('Bellwether Design + Build', 'houzz',     'https://www.houzz.com/professionals/general-contractors/bellwether-design-build-pfvwus-pf~474679281', null, null),
  ('Bellwether Design + Build', 'instagram', 'https://www.instagram.com/bellwetherdesignbuildsc/', 'bellwetherdesignbuildsc', null),
  ('Bellwether Design + Build', 'facebook',  'https://www.facebook.com/Bellwetherdesignbuildsc/', null, null),
  ('Allen Patterson Builders', 'google',    null, 'Allen Patterson Builders', null),
  ('Allen Patterson Builders', 'yelp',      'https://www.yelp.com/biz/allen-patterson-residential-ladys-island', null, 'Listed under the old name.'),
  ('Allen Patterson Builders', 'houzz',     'https://www.houzz.com/professionals/home-builders/allen-patterson-builders-pfvwus-pf~1921037146', null, null),
  ('Allen Patterson Builders', 'instagram', 'https://www.instagram.com/allenpattersonbuilders/', 'allenpattersonbuilders', null),
  ('Allen Patterson Builders', 'facebook',  'https://www.facebook.com/allenpattersonbuilders/', null, null),
  ('Allen Patterson Builders', 'bbb',       'https://www.bbb.org/us/sc/beaufort/profile/construction-services/allen-patterson-residential-0403-235948947', null, 'Listed under the old name.'),
  ('H2 Builders', 'google',    null, 'H2 Builders', null),
  ('H2 Builders', 'yelp',      'https://www.yelp.com/biz/h2-builders-bluffton', null, 'URL unverified.'),
  ('H2 Builders', 'houzz',     'https://www.houzz.com/professionals/home-builders/h2-builders-pfvwus-pf~345614621', null, null),
  ('H2 Builders', 'instagram', 'https://www.instagram.com/h2.builders/', 'h2.builders', null),
  ('H2 Builders', 'facebook',  'https://www.facebook.com/schomebuilder/', null, null)
) as p(company, platform, url, handle, notes) on p.company = co.name;

insert into queries (workspace_id, phrase, "group", is_branded, sort_order)
select w.id, q.phrase, q.grp, q.branded, q.ord
from workspaces w, (values
  ('RCH Construction',                           'branded',         true,  1),
  ('RCH Construction Hilton Head reviews',       'branded',         true,  2),
  ('Hilton Head home renovation contractor',     'category',        false, 3),
  ('Hilton Head custom home builder',            'category',        false, 4),
  ('luxury home builder Hilton Head Island',     'category',        false, 5),
  ('whole home remodel Hilton Head',             'category',        false, 6),
  ('best contractors Hilton Head Island',        'category',        false, 7),
  ('Sea Pines home renovation',                  'community',       false, 8),
  ('Long Cove Hilton Head remodel',              'community',       false, 9),
  ('Hilton Head Plantation renovation contractor','community',      false, 10),
  ('Palmetto Dunes home remodel',                'community',       false, 11),
  ('Hilton Head kitchen remodel cost',           'buyer_situation', false, 12),
  ('Hilton Head home addition contractor',       'buyer_situation', false, 13),
  ('how to choose a builder Hilton Head',        'buyer_situation', false, 14),
  ('aging in place remodel Hilton Head',         'buyer_situation', false, 15)
) as q(phrase, grp, branded, ord)
where w.slug = 'rch';
