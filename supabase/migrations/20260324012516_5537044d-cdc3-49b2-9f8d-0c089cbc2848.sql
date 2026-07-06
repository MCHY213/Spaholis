ALTER TABLE public.bookings ADD COLUMN intake_form jsonb DEFAULT null;
ALTER TABLE public.bookings ADD COLUMN card_authorization jsonb DEFAULT null;