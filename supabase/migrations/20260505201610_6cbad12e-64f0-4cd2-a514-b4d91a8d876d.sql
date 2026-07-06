-- Update the service in the services table
UPDATE public.services 
SET title = 'Essenthya Deluxe' || chr(10) || 'Facial 75min' 
WHERE title = 'Essenthya Deluxe Facial (75min)';

-- Update site_content if it exists
DO $$ 
DECLARE 
  v_content jsonb;
BEGIN
  SELECT content INTO v_content FROM public.site_content WHERE section_key = 'content';
  
  IF v_content IS NOT NULL THEN
    -- This is a bit complex as it's an array of objects inside the jsonb.
    -- We can try to replace the string directly in the jsonb.
    v_content := jsonb_set(
      v_content, 
      '{signatureExperiences,items}', 
      (
        SELECT jsonb_agg(
          CASE 
            WHEN item->>'title' = 'Essenthya Deluxe Facial' THEN jsonb_set(item, '{title}', '"Essenthya Deluxe\nFacial 75min"')
            ELSE item 
          END
        )
        FROM jsonb_array_elements(v_content->'signatureExperiences'->'items') AS item
      )
    );
    
    UPDATE public.site_content SET content = v_content WHERE section_key = 'content';
  END IF;
END $$;