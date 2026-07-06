-- Revert every CRC-stored price back to USD by dividing by 530.
-- The forward migration lives at supabase/migrations/20260424145426_*.sql.

BEGIN;

-- Services
UPDATE public.services
SET price = ROUND((price / 530.0)::numeric, 2)
WHERE price IS NOT NULL;

-- Classes
UPDATE public.classes
SET price = ROUND((price / 530.0)::numeric, 2)
WHERE price IS NOT NULL;

-- Spa packages
UPDATE public.spa_packages
SET price = ROUND((price / 530.0)::numeric, 2)
WHERE price IS NOT NULL;

-- Products
UPDATE public.products
SET price = ROUND((price / 530.0)::numeric, 2),
    compare_at_price = CASE
      WHEN compare_at_price IS NOT NULL
        THEN ROUND((compare_at_price / 530.0)::numeric, 2)
      ELSE NULL
    END,
    currency = 'USD';
ALTER TABLE public.products ALTER COLUMN currency SET DEFAULT 'USD';

-- Offerings
UPDATE public.offerings
SET price = ROUND((price / 530.0)::numeric, 2),
    currency = 'USD';
ALTER TABLE public.offerings ALTER COLUMN currency SET DEFAULT 'USD';

-- Gift cards
UPDATE public.gift_cards
SET initial_value = ROUND((initial_value / 530.0)::numeric, 2),
    remaining_value = ROUND((remaining_value / 530.0)::numeric, 2);

-- Historical bookings
UPDATE public.bookings
SET total_price = ROUND((total_price / 530.0)::numeric, 2),
    discount_amount = ROUND((COALESCE(discount_amount, 0) / 530.0)::numeric, 2)
WHERE total_price IS NOT NULL;

UPDATE public.experience_bookings
SET total_price = ROUND((total_price / 530.0)::numeric, 2)
WHERE total_price IS NOT NULL;

UPDATE public.class_bookings
SET total_price = CASE WHEN total_price IS NOT NULL THEN ROUND((total_price / 530.0)::numeric, 2) ELSE NULL END,
    discount_amount = CASE WHEN discount_amount IS NOT NULL THEN ROUND((discount_amount / 530.0)::numeric, 2) ELSE NULL END;

UPDATE public.user_offerings
SET price_paid = ROUND((price_paid / 530.0)::numeric, 2)
WHERE price_paid IS NOT NULL;

-- Coupons: only fixed-amount discounts stored a CRC value
UPDATE public.coupons
SET discount_value = ROUND((discount_value / 530.0)::numeric, 2)
WHERE discount_type = 'fixed';

-- Retreats.pricing_tiers is JSON like [{price: 1234, ...}, ...]
UPDATE public.retreats
SET pricing_tiers = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(tier->'price') IN ('number', 'string')
        THEN tier || jsonb_build_object(
          'price',
          ROUND(((tier->>'price')::numeric / 530.0)::numeric, 2)
        )
      ELSE tier
    END
  )
  FROM jsonb_array_elements(pricing_tiers) AS tier
)
WHERE jsonb_typeof(pricing_tiers) = 'array' AND jsonb_array_length(pricing_tiers) > 0;

COMMIT;