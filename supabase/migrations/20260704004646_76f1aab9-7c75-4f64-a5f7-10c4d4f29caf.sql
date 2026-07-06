
CREATE TABLE public.business_hours (
  weekday SMALLINT PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_closed BOOLEAN NOT NULL DEFAULT false,
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '19:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_hours_window_valid CHECK (is_closed OR close_time > open_time)
);

GRANT SELECT ON public.business_hours TO anon, authenticated;
GRANT UPDATE ON public.business_hours TO authenticated;
GRANT ALL ON public.business_hours TO service_role;

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_hours readable by everyone"
  ON public.business_hours FOR SELECT
  USING (true);

CREATE POLICY "business_hours editable by admins"
  ON public.business_hours FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON public.business_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default hours (Sun 9-17:30, Mon–Sat 9-19:00) to match prior hardcoded values.
INSERT INTO public.business_hours (weekday, is_closed, open_time, close_time) VALUES
  (0, false, '09:00', '17:30'),
  (1, false, '09:00', '19:00'),
  (2, false, '09:00', '19:00'),
  (3, false, '09:00', '19:00'),
  (4, false, '09:00', '19:00'),
  (5, false, '09:00', '19:00'),
  (6, false, '09:00', '19:00');
