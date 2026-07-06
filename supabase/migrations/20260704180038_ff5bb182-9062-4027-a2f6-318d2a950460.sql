
CREATE TABLE IF NOT EXISTS public.bac_link_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.bac_payment_links(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bac_link_claims_created_at
  ON public.bac_link_claims (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bac_link_claims_booking_id
  ON public.bac_link_claims (booking_id);

GRANT SELECT ON public.bac_link_claims TO authenticated;
GRANT ALL ON public.bac_link_claims TO service_role;

ALTER TABLE public.bac_link_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view BAC claims"
  ON public.bac_link_claims FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

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

  INSERT INTO public.bac_link_claims (link_id, booking_id, amount)
  VALUES (v_link.id, _booking_id, v_link.amount);

  RETURN QUERY SELECT v_link.id, v_link.url, v_link.amount;
END;
$function$;
