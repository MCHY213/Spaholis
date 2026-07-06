-- Create retreats table
CREATE TABLE public.retreats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'retreat' CHECK (type IN ('retreat', 'experience')),
  duration_days INTEGER NOT NULL DEFAULT 4,
  image_url TEXT,
  gallery_images JSONB DEFAULT '[]'::jsonb,
  pricing_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  itinerary JSONB DEFAULT '[]'::jsonb,
  inclusions JSONB DEFAULT '[]'::jsonb,
  deposit_percentage INTEGER NOT NULL DEFAULT 40,
  booking_policies TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retreats ENABLE ROW LEVEL SECURITY;

-- Anyone can view active retreats
CREATE POLICY "Anyone can view active retreats"
ON public.retreats
FOR SELECT
USING (is_active = true);

-- Admins can manage retreats
CREATE POLICY "Admins can manage retreats"
ON public.retreats
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_retreats_updated_at
BEFORE UPDATE ON public.retreats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create retreat inquiries table for the inquiry form
CREATE TABLE public.retreat_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retreat_id UUID REFERENCES public.retreats(id) ON DELETE SET NULL,
  retreat_title TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_start_date DATE,
  number_of_guests INTEGER DEFAULT 1,
  occupancy_type TEXT DEFAULT 'single',
  with_accommodation BOOLEAN DEFAULT true,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retreat_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
CREATE POLICY "Anyone can submit retreat inquiries"
ON public.retreat_inquiries
FOR INSERT
WITH CHECK (true);

-- Admins can view and manage inquiries
CREATE POLICY "Admins can manage retreat inquiries"
ON public.retreat_inquiries
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));