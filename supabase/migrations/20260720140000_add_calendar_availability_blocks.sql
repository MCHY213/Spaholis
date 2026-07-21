-- A calendar entry flagged blocks_availability hides ALL website slots during
-- its window (e.g. lunch, or off-site with no therapist coverage), regardless
-- of room. Manual and per-entry — the coordinator decides when there is no
-- coverage; the app cannot infer it.
ALTER TABLE public.admin_calendar_entries
  ADD COLUMN IF NOT EXISTS blocks_availability boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.admin_calendar_entries.blocks_availability IS
  'When true, blocks ALL website availability during the entry window (lunch, off-site with no coverage), regardless of room.';

-- Returns the time windows during which the website must show NO availability.
-- Mirrors get_internal_busy_intervals timezone handling; whole-day for all-day
-- / multi-day entries, else start_time + duration.
CREATE OR REPLACE FUNCTION public.get_availability_blocks(_from timestamptz, _to timestamptz)
RETURNS TABLE(block_start timestamptz, block_end timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select x.block_start, x.block_end
  from (
    select
      case
        when e.is_all_day or (e.end_date is not null and e.end_date > e.entry_date)
          then (e.entry_date::timestamp at time zone 'America/Costa_Rica')
        else ((e.entry_date + e.start_time) at time zone 'America/Costa_Rica')
      end as block_start,
      case
        when e.is_all_day or (e.end_date is not null and e.end_date > e.entry_date)
          then (((coalesce(e.end_date, e.entry_date) + 1)::timestamp) at time zone 'America/Costa_Rica')
        else ((e.entry_date + e.start_time) at time zone 'America/Costa_Rica')
               + make_interval(mins => greatest(e.duration_minutes, 0))
      end as block_end
    from public.admin_calendar_entries e
    where e.blocks_availability = true
  ) x
  where x.block_start <= _to and x.block_end >= _from;
$function$;

GRANT EXECUTE ON FUNCTION public.get_availability_blocks(timestamptz, timestamptz) TO anon, authenticated;
