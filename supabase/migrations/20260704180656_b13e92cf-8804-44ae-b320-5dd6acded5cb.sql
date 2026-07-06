
CREATE OR REPLACE VIEW public.bac_link_claim_counts
WITH (security_invoker = true)
AS
SELECT
  l.id AS link_id,
  l.amount,
  l.times_used,
  COALESCE(cc.claim_count, 0)::bigint AS claim_count
FROM public.bac_payment_links l
LEFT JOIN (
  SELECT link_id, COUNT(*)::bigint AS claim_count
  FROM public.bac_link_claims
  GROUP BY link_id
) cc ON cc.link_id = l.id;

GRANT SELECT ON public.bac_link_claim_counts TO authenticated, service_role;
