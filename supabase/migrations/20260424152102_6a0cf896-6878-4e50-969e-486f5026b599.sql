-- Bilingual content rollout: add *_es columns next to user-visible text fields
-- and seed them with current English values so nothing appears blank.

-- services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS description_rich_es jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery_images_es jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.services SET
  title_es = COALESCE(title_es, title),
  description_es = COALESCE(description_es, description),
  description_rich_es = CASE WHEN description_rich_es = '{}'::jsonb THEN description_rich ELSE description_rich_es END;

-- spa_packages
ALTER TABLE public.spa_packages
  ADD COLUMN IF NOT EXISTS name_es text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS description_rich_es jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS duration_label_es text;
UPDATE public.spa_packages SET
  name_es = COALESCE(name_es, name),
  description_es = COALESCE(description_es, description),
  description_rich_es = CASE WHEN description_rich_es = '{}'::jsonb THEN description_rich ELSE description_rich_es END,
  duration_label_es = COALESCE(duration_label_es, duration_label);

-- spa_package_items
ALTER TABLE public.spa_package_items
  ADD COLUMN IF NOT EXISTS treatment_name_es text;
UPDATE public.spa_package_items SET treatment_name_es = COALESCE(treatment_name_es, treatment_name);

-- offerings
ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS name_es text,
  ADD COLUMN IF NOT EXISTS description_es text;
UPDATE public.offerings SET
  name_es = COALESCE(name_es, name),
  description_es = COALESCE(description_es, description);

-- products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_es text,
  ADD COLUMN IF NOT EXISTS short_description_es text,
  ADD COLUMN IF NOT EXISTS description_es jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title_es text,
  ADD COLUMN IF NOT EXISTS seo_description_es text;
UPDATE public.products SET
  name_es = COALESCE(name_es, name),
  short_description_es = COALESCE(short_description_es, short_description),
  description_es = CASE WHEN description_es = '{}'::jsonb THEN description ELSE description_es END,
  seo_title_es = COALESCE(seo_title_es, seo_title),
  seo_description_es = COALESCE(seo_description_es, seo_description);

-- classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS location_es text,
  ADD COLUMN IF NOT EXISTS instructor_es text;
UPDATE public.classes SET
  title_es = COALESCE(title_es, title),
  description_es = COALESCE(description_es, description),
  location_es = COALESCE(location_es, location),
  instructor_es = COALESCE(instructor_es, instructor);

-- faqs
ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS question_es text,
  ADD COLUMN IF NOT EXISTS answer_es jsonb,
  ADD COLUMN IF NOT EXISTS answer_html_es text;
UPDATE public.faqs SET
  question_es = COALESCE(question_es, question),
  answer_es = COALESCE(answer_es, answer),
  answer_html_es = COALESCE(answer_html_es, answer_html);

-- faq_categories
ALTER TABLE public.faq_categories
  ADD COLUMN IF NOT EXISTS name_es text,
  ADD COLUMN IF NOT EXISTS description_es text;
UPDATE public.faq_categories SET
  name_es = COALESCE(name_es, name),
  description_es = COALESCE(description_es, description);

-- blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS excerpt_es text,
  ADD COLUMN IF NOT EXISTS content_es jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title_es text,
  ADD COLUMN IF NOT EXISTS seo_description_es text;
UPDATE public.blog_posts SET
  title_es = COALESCE(title_es, title),
  excerpt_es = COALESCE(excerpt_es, excerpt),
  content_es = CASE WHEN content_es = '{}'::jsonb THEN content ELSE content_es END,
  seo_title_es = COALESCE(seo_title_es, seo_title),
  seo_description_es = COALESCE(seo_description_es, seo_description);

-- retreats
ALTER TABLE public.retreats
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS short_description_es text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS booking_policies_es text,
  ADD COLUMN IF NOT EXISTS inclusions_es jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS itinerary_es jsonb DEFAULT '[]'::jsonb;
UPDATE public.retreats SET
  title_es = COALESCE(title_es, title),
  short_description_es = COALESCE(short_description_es, short_description),
  description_es = COALESCE(description_es, description),
  booking_policies_es = COALESCE(booking_policies_es, booking_policies),
  inclusions_es = COALESCE(inclusions_es, inclusions),
  itinerary_es = COALESCE(itinerary_es, itinerary);

-- site_content (parallel jsonb tree for Spanish)
ALTER TABLE public.site_content
  ADD COLUMN IF NOT EXISTS content_es jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.site_content SET
  content_es = CASE WHEN content_es = '{}'::jsonb THEN content ELSE content_es END;

-- tags
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS label_es text,
  ADD COLUMN IF NOT EXISTS description_es text;
UPDATE public.tags SET
  label_es = COALESCE(label_es, label),
  description_es = COALESCE(description_es, description);

-- collections
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS tagline_es text,
  ADD COLUMN IF NOT EXISTS intent_es text;
UPDATE public.collections SET
  title_es = COALESCE(title_es, title),
  tagline_es = COALESCE(tagline_es, tagline),
  intent_es = COALESCE(intent_es, intent);
