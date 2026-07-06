
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-images', 'content-images', true);

CREATE POLICY "Anyone can view content images"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-images');

CREATE POLICY "Admins can upload content images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-images'
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins can update content images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'content-images'
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins can delete content images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'content-images'
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
);
