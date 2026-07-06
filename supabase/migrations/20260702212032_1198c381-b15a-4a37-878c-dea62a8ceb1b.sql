
CREATE TABLE public.class_schedule_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedule_template TO authenticated;
GRANT ALL ON public.class_schedule_template TO service_role;

ALTER TABLE public.class_schedule_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage schedule template"
ON public.class_schedule_template FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Anyone can read schedule template"
ON public.class_schedule_template FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE TRIGGER update_class_schedule_template_updated_at
BEFORE UPDATE ON public.class_schedule_template
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
