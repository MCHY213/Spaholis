
-- ── Services ──
UPDATE public.services SET price = ROUND(price * 530) WHERE price IS NOT NULL;

-- ── Products ──
UPDATE public.products
SET price = ROUND(price * 530),
    compare_at_price = CASE WHEN compare_at_price IS NOT NULL THEN ROUND(compare_at_price * 530) ELSE NULL END,
    currency = 'CRC';
ALTER TABLE public.products ALTER COLUMN currency SET DEFAULT 'CRC';

-- ── Offerings (memberships / class passes) ──
UPDATE public.offerings SET price = ROUND(price * 530), currency = 'CRC';
ALTER TABLE public.offerings ALTER COLUMN currency SET DEFAULT 'CRC';

-- ── Classes ──
UPDATE public.classes SET price = ROUND(price * 530) WHERE price IS NOT NULL;

-- ── Spa packages ──
UPDATE public.spa_packages SET price = ROUND(price * 530) WHERE price IS NOT NULL;

-- ── Gift cards (existing balances) ──
UPDATE public.gift_cards
SET initial_value = ROUND(initial_value * 530),
    remaining_value = ROUND(remaining_value * 530);

-- ── Bookings (historical totals) ──
UPDATE public.bookings
SET total_price = ROUND(total_price * 530),
    discount_amount = ROUND(COALESCE(discount_amount, 0) * 530)
WHERE total_price IS NOT NULL;

UPDATE public.experience_bookings
SET total_price = ROUND(total_price * 530)
WHERE total_price IS NOT NULL;

-- ── Coupons (only fixed-amount discounts; percentage stays as-is) ──
UPDATE public.coupons
SET discount_value = ROUND(discount_value * 530)
WHERE discount_type = 'fixed';

-- ── Retreats: pricing_tiers is JSON like [{price: 1234, ...}, ...] ──
UPDATE public.retreats
SET pricing_tiers = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(tier->'price') IN ('number', 'string')
        THEN tier || jsonb_build_object('price', ROUND((tier->>'price')::numeric * 530))
      ELSE tier
    END
  )
  FROM jsonb_array_elements(pricing_tiers) AS tier
)
WHERE jsonb_typeof(pricing_tiers) = 'array' AND jsonb_array_length(pricing_tiers) > 0;
