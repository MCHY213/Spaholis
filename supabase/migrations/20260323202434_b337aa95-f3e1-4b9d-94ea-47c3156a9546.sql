
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage staff" ON public.staff
  FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Anyone can view active staff" ON public.staff
  FOR SELECT TO public
  USING (is_active = true);

ALTER TABLE public.bookings ADD COLUMN staff_id uuid REFERENCES public.staff(id);
