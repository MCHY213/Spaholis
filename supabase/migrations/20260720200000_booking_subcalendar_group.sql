-- Let a booking be assigned to an internal sub-calendar (group), which drives
-- its color on the treatments calendar (falls back to the status color when null).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.calendar_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bookings.group_id IS 'Optional internal sub-calendar (calendar_groups) — sets the booking color on the treatments calendar.';
