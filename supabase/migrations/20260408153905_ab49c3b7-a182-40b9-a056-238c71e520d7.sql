
CREATE TABLE public.admin_calendar_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_type TEXT NOT NULL DEFAULT 'treatment',
  title TEXT NOT NULL,
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_calendar_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage calendar entries"
ON public.admin_calendar_entries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_admin_calendar_entries_updated_at
BEFORE UPDATE ON public.admin_calendar_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_admin_calendar_type_date ON public.admin_calendar_entries (calendar_type, entry_date);
