
CREATE TABLE public.custom_retreat_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  retreat_vision TEXT[] DEFAULT '{}',
  preferred_activities TEXT[] DEFAULT '{}',
  group_type TEXT DEFAULT 'solo',
  preferred_dates TEXT,
  flexible_dates BOOLEAN DEFAULT true,
  length_of_stay TEXT,
  budget_range TEXT,
  special_requests TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_retreat_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit custom retreat inquiries"
ON public.custom_retreat_inquiries
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admins can manage custom retreat inquiries"
ON public.custom_retreat_inquiries
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_custom_retreat_inquiries_updated_at
BEFORE UPDATE ON public.custom_retreat_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
