-- Update the services table
UPDATE public.services 
SET title = 'CranioSacral Therapy (90min)' 
WHERE title = 'Somato Awareness System Massage (90min)';

UPDATE public.services 
SET title = 'CranioSacral Therapy (2hr)' 
WHERE title = 'Somato Awareness System Massage (2hr)';

-- Update site_content if it exists
DO $$ 
DECLARE 
  v_content jsonb;
BEGIN
  SELECT content INTO v_content FROM public.site_content WHERE section_key = 'content';
  
  IF v_content IS NOT NULL THEN
    v_content := jsonb_set(
      v_content, 
      '{signatureExperiences,items}', 
      (
        SELECT jsonb_agg(
          CASE 
            WHEN item->>'title' = 'Somato Awareness System' THEN jsonb_set(item, '{title}', '"CranioSacral Therapy (90min)"')
            ELSE item 
          END
        )
        FROM jsonb_array_elements(v_content->'signatureExperiences'->'items') AS item
      )
    );
    
    UPDATE public.site_content SET content = v_content WHERE section_key = 'content';
  END IF;
END $$;