-- Update site_content
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
            WHEN item->>'title' LIKE 'Somato Awareness System%' THEN 
              jsonb_set(item, '{benefit}', '"\nA gentle reset for your nervous system; Arrive as you are, leave renewed"')
            ELSE item 
          END
        )
        FROM jsonb_array_elements(v_content->'signatureExperiences'->'items') AS item
      )
    );
    
    UPDATE public.site_content SET content = v_content WHERE section_key = 'content';
  END IF;
END $$;