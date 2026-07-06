
-- Experience availability slots
CREATE TABLE public.experience_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  availability_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  booked_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active availability"
  ON public.experience_availability FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage availability"
  ON public.experience_availability FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_exp_avail_service_date ON public.experience_availability(service_id, availability_date);

-- Experience bookings
CREATE TABLE public.experience_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  availability_id UUID NOT NULL REFERENCES public.experience_availability(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  total_price NUMERIC,
  payment_id TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit experience bookings"
  ON public.experience_bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own experience bookings"
  ON public.experience_bookings FOR SELECT
  USING (guest_email IS NOT NULL);

CREATE POLICY "Admins can manage experience bookings"
  ON public.experience_bookings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger to update booked_count
CREATE OR REPLACE FUNCTION public.update_experience_booked_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status != 'cancelled' THEN
    UPDATE public.experience_availability
    SET booked_count = booked_count + NEW.number_of_guests
    WHERE id = NEW.availability_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
      UPDATE public.experience_availability
      SET booked_count = GREATEST(booked_count - OLD.number_of_guests, 0)
      WHERE id = NEW.availability_id;
    ELSIF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
      UPDATE public.experience_availability
      SET booked_count = booked_count + NEW.number_of_guests
      WHERE id = NEW.availability_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status != 'cancelled' THEN
    UPDATE public.experience_availability
    SET booked_count = GREATEST(booked_count - OLD.number_of_guests, 0)
    WHERE id = OLD.availability_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_experience_booked_count
AFTER INSERT OR UPDATE OR DELETE ON public.experience_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_experience_booked_count();

-- Timestamp triggers
CREATE TRIGGER update_experience_availability_updated_at
BEFORE UPDATE ON public.experience_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_experience_bookings_updated_at
BEFORE UPDATE ON public.experience_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for availability
ALTER PUBLICATION supabase_realtime ADD TABLE public.experience_availability;
