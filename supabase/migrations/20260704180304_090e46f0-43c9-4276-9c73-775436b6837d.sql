
-- Hard invariant: times_used stays within [0, 9999] regardless of caller.
ALTER TABLE public.bac_payment_links
  DROP CONSTRAINT IF EXISTS bac_payment_links_times_used_bounds;
ALTER TABLE public.bac_payment_links
  ADD CONSTRAINT bac_payment_links_times_used_bounds
  CHECK (times_used >= 0 AND times_used <= 9999);

-- Single-statement atomic claim.
-- Using UPDATE ... WHERE times_used < capacity RETURNING removes any
-- read-then-write race window: two concurrent transactions both trying
-- to claim the last credit will serialize on the row lock, and the loser
-- will see times_used already at capacity and match zero rows.
CREATE OR REPLACE FUNCTION public.claim_bac_payment_link(_amount numeric, _booking_id uuid)
 RETURNS TABLE(id uuid, url text, amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_capacity CONSTANT integer := 9999;
  v_link RECORD;
BEGIN
  -- Atomically pick + increment the best-available link for the amount.
  -- Ties are broken by lowest times_used, then oldest created_at, to
  -- spread load evenly if multiple links exist for a tier.
  WITH candidate AS (
    SELECT l.id
    FROM public.bac_payment_links l
    WHERE l.amount = _amount
      AND l.status <> 'void'
      AND l.times_used < v_capacity
    ORDER BY l.times_used ASC, l.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.bac_payment_links l
     SET times_used = l.times_used + 1,
         assigned_booking_id = _booking_id,
         assigned_at = now()
    FROM candidate
   WHERE l.id = candidate.id
     AND l.times_used < v_capacity  -- belt-and-braces guard
  RETURNING l.id, l.url, l.amount, l.times_used
  INTO v_link;

  IF NOT FOUND THEN
    -- Either no link exists for this tier, or capacity is fully consumed.
    RETURN;
  END IF;

  INSERT INTO public.bac_link_claims (link_id, booking_id, amount)
  VALUES (v_link.id, _booking_id, v_link.amount);

  RETURN QUERY SELECT v_link.id, v_link.url, v_link.amount;
END;
$function$;
