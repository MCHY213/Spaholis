CREATE TABLE public.offering_eligible_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offering_id UUID NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (offering_id, class_id)
);

CREATE INDEX idx_oec_offering ON public.offering_eligible_classes(offering_id);
CREATE INDEX idx_oec_class ON public.offering_eligible_classes(class_id);

ALTER TABLE public.offering_eligible_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view eligibility"
ON public.offering_eligible_classes
FOR SELECT USING (true);

CREATE POLICY "Admins can manage eligibility"
ON public.offering_eligible_classes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));