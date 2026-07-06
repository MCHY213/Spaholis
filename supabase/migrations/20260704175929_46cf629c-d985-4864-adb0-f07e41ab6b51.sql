
ALTER TABLE public.bac_payment_links
  ADD COLUMN IF NOT EXISTS times_used integer NOT NULL DEFAULT 0;

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
  -- BAC CompraClick links are reusable — the same shared URL handles many
  -- bookings. We pick the link for the requested amount that still has
  -- capacity left, lock the row, and increment times_used so remaining
  -- capacity is tracked per claim without ever marking the link "assigned".
  SELECT l.id, l.url, l.amount, l.times_used
    INTO v_link
  FROM public.bac_payment_links l
  WHERE l.amount = _amount
    AND l.status <> 'void'
    AND l.times_used < v_capacity
  ORDER BY l.times_used ASC, l.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.bac_payment_links
     SET times_used = times_used + 1,
         assigned_booking_id = _booking_id,
         assigned_at = now()
   WHERE bac_payment_links.id = v_link.id;

  RETURN QUERY SELECT v_link.id, v_link.url, v_link.amount;
END;
$function$;
