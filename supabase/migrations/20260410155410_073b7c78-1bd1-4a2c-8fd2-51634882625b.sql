
-- Spa Packages table
CREATE TABLE public.spa_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_label TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  booking_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spa_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active spa packages"
  ON public.spa_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage spa packages"
  ON public.spa_packages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Spa Package Items (treatments within a package)
CREATE TABLE public.spa_package_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.spa_packages(id) ON DELETE CASCADE,
  treatment_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spa_package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spa package items"
  ON public.spa_package_items FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage spa package items"
  ON public.spa_package_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at on spa_packages
CREATE TRIGGER update_spa_packages_updated_at
  BEFORE UPDATE ON public.spa_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
