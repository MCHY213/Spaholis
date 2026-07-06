UPDATE services 
SET title = REPLACE(title, 'Pure Bliss Swedish Massage', 'PURE BLISS') 
WHERE title LIKE 'Pure Bliss Swedish Massage%';