
CREATE OR REPLACE FUNCTION public.claim_bac_payment_link(_amount numeric, _booking_id uuid)
 RETURNS TABLE(id uuid, url text, amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link RECORD;
BEGIN
  -- BAC CompraClick links are reusable — the same shared URL handles many
  -- bookings. We just look up the link for the requested amount and return
  -- it without changing its status, so the pool never depletes.
  SELECT l.id, l.url, l.amount INTO v_link
  FROM public.bac_payment_links l
  WHERE l.amount = _amount
    AND l.status <> 'void'
  ORDER BY CASE WHEN l.status = 'available' THEN 0 ELSE 1 END, l.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_link.id, v_link.url, v_link.amount;
END;
$function$;
