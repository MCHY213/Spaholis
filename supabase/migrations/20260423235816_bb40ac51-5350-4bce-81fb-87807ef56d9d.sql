-- ============================================
-- OFFERINGS SYSTEM (memberships, class passes, drop-ins)
-- ============================================

-- 1. Offerings catalog (admin-managed)
CREATE TABLE public.offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('membership', 'class_pass', 'drop_in')),
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits INTEGER, -- # of classes for class_pass
  duration_days INTEGER, -- validity for membership
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active offerings" ON public.offerings
  FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can view all offerings" ON public.offerings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins can insert offerings" ON public.offerings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins can update offerings" ON public.offerings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins can delete offerings" ON public.offerings
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_offerings_updated_at BEFORE UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. User-owned purchases / grants
CREATE TABLE public.user_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  offering_id UUID NOT NULL REFERENCES public.offerings(id) ON DELETE RESTRICT,
  -- snapshot at time of purchase (so changing offering price later doesn't mutate history)
  type TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  price_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  credits_total INTEGER, -- null for memberships
  credits_remaining INTEGER, -- decremented as used
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- computed from duration_days for memberships
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'depleted', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'admin_grant')),
  payment_id TEXT,
  granted_by UUID, -- admin user_id when source = 'admin_grant'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_offerings_user ON public.user_offerings(user_id, status);

ALTER TABLE public.user_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own offerings" ON public.user_offerings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all user offerings" ON public.user_offerings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins can manage user offerings" ON public.user_offerings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Users can purchase own offerings" ON public.user_offerings
  FOR INSERT WITH CHECK (auth.uid() = user_id AND source = 'purchase');

CREATE TRIGGER update_user_offerings_updated_at BEFORE UPDATE ON public.user_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Redemption ledger (audit trail of every credit/membership use)
CREATE TABLE public.offering_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_offering_id UUID NOT NULL REFERENCES public.user_offerings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  class_booking_id UUID, -- references class_bookings.id (no FK to keep flexible)
  credits_used INTEGER NOT NULL DEFAULT 1,
  redemption_type TEXT NOT NULL CHECK (redemption_type IN ('membership', 'credits')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemptions_user ON public.offering_redemptions(user_id);
CREATE INDEX idx_redemptions_booking ON public.offering_redemptions(class_booking_id);

ALTER TABLE public.offering_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.offering_redemptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage redemptions" ON public.offering_redemptions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "System can insert redemptions for self" ON public.offering_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Add payment method tracking to class_bookings
ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'paypal' CHECK (payment_method IN ('paypal', 'membership', 'credits', 'free', 'admin')),
  ADD COLUMN IF NOT EXISTS user_offering_id UUID REFERENCES public.user_offerings(id) ON DELETE SET NULL;

-- 5. Atomic redeem function: validates eligibility, decrements credits, writes ledger
CREATE OR REPLACE FUNCTION public.redeem_offering(
  _user_offering_id UUID,
  _class_booking_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uo RECORD;
  v_redemption_type TEXT;
BEGIN
  SELECT * INTO uo FROM public.user_offerings WHERE id = _user_offering_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offering not found';
  END IF;
  IF uo.user_id <> auth.uid() AND NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized to redeem this offering';
  END IF;
  IF uo.status <> 'active' THEN
    RAISE EXCEPTION 'Offering is not active (status: %)', uo.status;
  END IF;
  IF uo.expires_at IS NOT NULL AND uo.expires_at < now() THEN
    UPDATE public.user_offerings SET status = 'expired' WHERE id = uo.id;
    RAISE EXCEPTION 'Offering has expired';
  END IF;

  IF uo.is_unlimited THEN
    v_redemption_type := 'membership';
  ELSIF uo.credits_remaining IS NOT NULL AND uo.credits_remaining > 0 THEN
    v_redemption_type := 'credits';
    UPDATE public.user_offerings
    SET credits_remaining = credits_remaining - 1,
        status = CASE WHEN credits_remaining - 1 <= 0 THEN 'depleted' ELSE 'active' END
    WHERE id = uo.id;
  ELSE
    RAISE EXCEPTION 'No credits remaining';
  END IF;

  INSERT INTO public.offering_redemptions (user_offering_id, user_id, class_booking_id, credits_used, redemption_type)
  VALUES (uo.id, uo.user_id, _class_booking_id, CASE WHEN v_redemption_type = 'membership' THEN 0 ELSE 1 END, v_redemption_type);

  RETURN jsonb_build_object('success', true, 'redemption_type', v_redemption_type);
END;
$$;