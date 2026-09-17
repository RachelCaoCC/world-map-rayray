-- Aggregated view: country × platform stats
-- Computes totals from the latest account_stats per connection.
-- Frontend reads this instead of doing aggregation in JS.

create or replace view v_country_platform_stats as
select
  pc.country_id,
  pc.platform,
  count(*) as account_count,
  coalesce(sum(latest.followers), 0) as followers,
  coalesce(sum(latest.total_views), 0) as total_views,
  case when coalesce(sum(latest.followers), 0) > 0
    then round(
      coalesce(sum(latest.follower_growth_pct_30d * latest.followers), 0)
      / coalesce(sum(latest.followers), 1), 1)
    else 0
  end as follower_growth_pct_30d,
  case when coalesce(sum(latest.total_views), 0) > 0
    then round(
      coalesce(sum(latest.view_growth_pct_30d * latest.total_views), 0)
      / coalesce(sum(latest.total_views), 1), 1)
    else 0
  end as view_growth_pct_30d,
  max(latest.synced_at) as last_updated,
  case when count(*) > 0 then 'Updated' else 'Inactive' end as status
from platform_connections pc
left join lateral (
  select followers, total_views, follower_growth_pct_30d, view_growth_pct_30d, synced_at
  from account_stats
  where connection_id = pc.id
  order by synced_at desc
  limit 1
) latest on true
where pc.status = 'connected'
group by pc.country_id, pc.platform;