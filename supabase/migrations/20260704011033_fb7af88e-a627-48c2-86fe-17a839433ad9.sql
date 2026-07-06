ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_class_bookings_paypal_order_id
  ON public.class_bookings (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;