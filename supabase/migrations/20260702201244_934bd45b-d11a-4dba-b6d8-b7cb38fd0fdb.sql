
CREATE TABLE public.bac_payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount IN (10, 20)),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','assigned','used','void')),
  assigned_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_links_status_amount ON public.bac_payment_links(status, amount);
CREATE INDEX idx_bac_links_booking ON public.bac_payment_links(assigned_booking_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bac_payment_links TO authenticated;
GRANT ALL ON public.bac_payment_links TO service_role;

ALTER TABLE public.bac_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bac links"
ON public.bac_payment_links FOR ALL
TO authenticated
USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'manager'))
WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'manager'));

CREATE TRIGGER update_bac_payment_links_updated_at
BEFORE UPDATE ON public.bac_payment_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic claim function: pops the next available link for the given amount
CREATE OR REPLACE FUNCTION public.claim_bac_payment_link(_amount NUMERIC, _booking_id UUID)
RETURNS TABLE(id UUID, url TEXT, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
BEGIN
  SELECT l.id, l.url, l.amount INTO v_link
  FROM public.bac_payment_links l
  WHERE l.status = 'available' AND l.amount = _amount
  ORDER BY l.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.bac_payment_links
  SET status = 'assigned',
      assigned_booking_id = _booking_id,
      assigned_at = now()
  WHERE bac_payment_links.id = v_link.id;

  RETURN QUERY SELECT v_link.id, v_link.url, v_link.amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_bac_payment_link(NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_bac_payment_link(NUMERIC, UUID) TO authenticated, service_role;

-- Counter view
CREATE OR REPLACE VIEW public.bac_payment_link_counts AS
SELECT
  amount,
  COUNT(*) FILTER (WHERE status = 'available') AS available,
  COUNT(*) FILTER (WHERE status = 'assigned') AS assigned,
  COUNT(*) FILTER (WHERE status = 'used') AS used,
  COUNT(*) FILTER (WHERE status = 'void') AS void,
  COUNT(*) AS total
FROM public.bac_payment_links
GROUP BY amount;

GRANT SELECT ON public.bac_payment_link_counts TO authenticated, service_role;
