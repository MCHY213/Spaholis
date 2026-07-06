
-- Add image_url and location to classes table
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS location text;

-- Create storage bucket for class and service images
INSERT INTO storage.buckets (id, name, public) VALUES ('class-images', 'class-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true) ON CONFLICT DO NOTHING;

-- Storage policies for class-images
CREATE POLICY "Anyone can view class images" ON storage.objects FOR SELECT USING (bucket_id = 'class-images');
CREATE POLICY "Admins can upload class images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'class-images' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Admins can update class images" ON storage.objects FOR UPDATE USING (bucket_id = 'class-images' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Admins can delete class images" ON storage.objects FOR DELETE USING (bucket_id = 'class-images' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')));

-- Storage policies for service-images
CREATE POLICY "Anyone can view service images" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');
CREATE POLICY "Admins can upload service images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Admins can update service images" ON storage.objects FOR UPDATE USING (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Admins can delete service images" ON storage.objects FOR DELETE USING (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')));
