-- Update the services table
-- Target the specific IDs that were originally Somato Awareness System
UPDATE public.services 
SET title = 'Somato Awareness System Massage (90min)' 
WHERE id = '4a65592e-d174-4c79-9282-90433723fa2f';

UPDATE public.services 
SET title = 'Somato Awareness System Massage (2hr)' 
WHERE id = '5729288d-6041-4ccb-adba-d228da5d68a5';

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
            WHEN item->>'title' = 'CranioSacral Therapy (90min)' THEN jsonb_set(item, '{title}', '"Somato Awareness System Massage (90min)"')
            ELSE item 
          END
        )
        FROM jsonb_array_elements(v_content->'signatureExperiences'->'items') AS item
      )
    );
    
    UPDATE public.site_content SET content = v_content WHERE section_key = 'content';
  END IF;
END $$;