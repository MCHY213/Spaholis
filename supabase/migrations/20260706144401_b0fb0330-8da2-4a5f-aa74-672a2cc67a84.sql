
-- ============================================================
-- bookings: add WITH CHECK + immutable-column trigger
-- ============================================================
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;

CREATE POLICY "Users can update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bookings_restrict_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass column restrictions.
  IF has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager') THEN
    RETURN NEW;
  END IF;

  -- Only the row owner reaches here (RLS already enforced that).
  -- Lock down sensitive fields so a customer cannot tamper with pricing,
  -- payment, status escalation, or assignment.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change booking owner';
  END IF;
  IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN
    RAISE EXCEPTION 'Cannot change booking service';
  END IF;
  IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    RAISE EXCEPTION 'Cannot change booking room';
  END IF;
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    RAISE EXCEPTION 'Cannot change booking staff';
  END IF;
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    RAISE EXCEPTION 'Cannot change booking price';
  END IF;
  IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
    RAISE EXCEPTION 'Cannot change discount amount';
  END IF;
  IF NEW.coupon_code IS DISTINCT FROM OLD.coupon_code THEN
    RAISE EXCEPTION 'Cannot change coupon code';
  END IF;
  IF NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
    RAISE EXCEPTION 'Cannot change payment id';
  END IF;
  IF NEW.booking_date IS DISTINCT FROM OLD.booking_date THEN
    RAISE EXCEPTION 'Cannot change booking date';
  END IF;
  IF NEW.booking_time IS DISTINCT FROM OLD.booking_time THEN
    RAISE EXCEPTION 'Cannot change booking time';
  END IF;
  IF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
    RAISE EXCEPTION 'Cannot change booking start time';
  END IF;
  IF NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    RAISE EXCEPTION 'Cannot change booking end time';
  END IF;
  IF NEW.notification_sent_at IS DISTINCT FROM OLD.notification_sent_at THEN
    RAISE EXCEPTION 'Cannot change notification tracking';
  END IF;
  -- Status: customers may only cancel their own booking; no other transitions.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Customers may only cancel their bookings';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_restrict_customer_updates ON public.bookings;
CREATE TRIGGER bookings_restrict_customer_updates
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.bookings_restrict_customer_updates();

-- ============================================================
-- class_bookings: same treatment
-- ============================================================
DROP POLICY IF EXISTS "Users can cancel own class bookings" ON public.class_bookings;

CREATE POLICY "Users can cancel own class bookings"
ON public.class_bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.class_bookings_restrict_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change class booking owner';
  END IF;
  IF NEW.class_id IS DISTINCT FROM OLD.class_id THEN
    RAISE EXCEPTION 'Cannot change class';
  END IF;
  IF NEW.schedule_id IS DISTINCT FROM OLD.schedule_id THEN
    RAISE EXCEPTION 'Cannot change class schedule';
  END IF;
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    RAISE EXCEPTION 'Cannot change class booking price';
  END IF;
  IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
    RAISE EXCEPTION 'Cannot change discount amount';
  END IF;
  IF NEW.coupon_code IS DISTINCT FROM OLD.coupon_code THEN
    RAISE EXCEPTION 'Cannot change coupon code';
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Cannot change payment status';
  END IF;
  IF NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
    RAISE EXCEPTION 'Cannot change payment id';
  END IF;
  -- Only allow cancellation as a status transition from the client.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Customers may only cancel their class bookings';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_bookings_restrict_customer_updates ON public.class_bookings;
CREATE TRIGGER class_bookings_restrict_customer_updates
BEFORE UPDATE ON public.class_bookings
FOR EACH ROW
EXECUTE FUNCTION public.class_bookings_restrict_customer_updates();

-- ============================================================
-- user_progress: disallow self-completion / certificate tampering
-- ============================================================
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;

CREATE POLICY "Users can update own progress"
ON public.user_progress
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_progress_restrict_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change progress owner';
  END IF;
  IF NEW.completed IS DISTINCT FROM OLD.completed THEN
    RAISE EXCEPTION 'Completion status is set by the system';
  END IF;
  IF NEW.certificate_url IS DISTINCT FROM OLD.certificate_url THEN
    RAISE EXCEPTION 'Certificate URL is set by the system';
  END IF;
  IF NEW.completed_sessions IS DISTINCT FROM OLD.completed_sessions
     AND NEW.completed_sessions < OLD.completed_sessions THEN
    RAISE EXCEPTION 'Completed sessions cannot decrease';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_progress_restrict_customer_updates ON public.user_progress;
CREATE TRIGGER user_progress_restrict_customer_updates
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.user_progress_restrict_customer_updates();
