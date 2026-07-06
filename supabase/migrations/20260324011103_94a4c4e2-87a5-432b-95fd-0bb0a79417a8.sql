
-- Create rooms table
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  forbidden_categories text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Anyone can view active rooms" ON public.rooms
  FOR SELECT TO public
  USING (is_active = true);

-- Seed the 4 rooms
INSERT INTO public.rooms (name, forbidden_categories) VALUES
  ('Room 1', ARRAY['facial','wrap']),
  ('Room 2', ARRAY[]::text[]),
  ('Room 3A', ARRAY[]::text[]),
  ('Room 3B', ARRAY['facial']);

-- Add room_id, start_time, end_time to bookings
ALTER TABLE public.bookings
  ADD COLUMN room_id uuid REFERENCES public.rooms(id),
  ADD COLUMN start_time timestamptz,
  ADD COLUMN end_time timestamptz;
