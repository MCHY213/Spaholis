
-- Fix experience_bookings: restrict SELECT to owner / admins
DROP POLICY IF EXISTS "Users can view own experience bookings" ON public.experience_bookings;

CREATE POLICY "Users can view own experience bookings"
ON public.experience_bookings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix user_offerings: remove self-grant INSERT; only service role / admins can insert
DROP POLICY IF EXISTS "Users can purchase own offerings" ON public.user_offerings;

CREATE POLICY "Admins can insert user offerings"
ON public.user_offerings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
