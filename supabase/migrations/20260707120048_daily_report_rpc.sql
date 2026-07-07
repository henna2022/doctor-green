-- 오늘의 리포트(avg/min/max/count)를 서버에서 집계하는 RPC.
-- 기존 클라이언트 집계(lib/report.ts)는 .limit(2000)으로 잘려 있어
-- 측정 주기가 짧은 기기의 하루 데이터를 전부 반영하지 못했음.
-- sensor_history_range(p_device, p_start, p_end, p_buckets) RPC와 파라미터 스타일을 맞춤.
create or replace function daily_report(
  p_device uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  count bigint,
  avg_temp numeric,
  min_temp numeric,
  max_temp numeric,
  avg_hum numeric,
  min_hum numeric,
  max_hum numeric,
  avg_soil numeric,
  min_soil numeric,
  max_soil numeric
)
language sql
stable
as $$
  select
    count(*)::bigint as count,
    round(avg(temp)::numeric, 1) as avg_temp,
    min(temp) as min_temp,
    max(temp) as max_temp,
    round(avg(hum)::numeric, 1) as avg_hum,
    min(hum) as min_hum,
    max(hum) as max_hum,
    round(avg(soil)::numeric, 1) as avg_soil,
    min(soil) as min_soil,
    max(soil) as max_soil
  from sensor_readings
  where device_id = p_device
    and recorded_at >= p_start
    and recorded_at < p_end;
$$;
