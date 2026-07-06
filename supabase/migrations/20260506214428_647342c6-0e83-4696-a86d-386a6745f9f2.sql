
-- Extend coupons to support restriction across classes and products in addition to services
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS restricted_class_ids uuid[],
  ADD COLUMN IF NOT EXISTS restricted_product_ids uuid[];

-- Allow class bookings to record coupon usage
ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price numeric;
