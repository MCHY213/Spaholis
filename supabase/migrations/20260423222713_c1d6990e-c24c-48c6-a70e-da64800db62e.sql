
-- Add gallery + rich text fields to services and spa_packages
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description_rich jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.spa_packages
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description_rich jsonb NOT NULL DEFAULT '{}'::jsonb;
