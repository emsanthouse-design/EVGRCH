-- 0006_search_views: latest SERP capture per query, for the Search view
create view latest_serp_runs with (security_invoker = true) as
select distinct on (query_id) *
from serp_runs
order by query_id, captured_at desc;

create view latest_serp_results with (security_invoker = true) as
select r.*, lr.query_id, lr.captured_at, lr.has_local_pack, lr.provider, lr.device
from serp_results r
join latest_serp_runs lr on lr.id = r.serp_run_id;

-- Previous capture per query (for rank deltas)
create view previous_serp_runs with (security_invoker = true) as
select distinct on (s.query_id) s.*
from serp_runs s
join latest_serp_runs lr on lr.query_id = s.query_id and s.captured_at < lr.captured_at
order by s.query_id, s.captured_at desc;

create view previous_serp_results with (security_invoker = true) as
select r.*, pr.query_id, pr.captured_at
from serp_results r
join previous_serp_runs pr on pr.id = r.serp_run_id;
