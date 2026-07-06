-- Revert: RLS policies across the schema call has_role(auth.uid(), 'admin')
-- when evaluating anonymous requests (e.g. public booking availability).
-- PostgREST evaluates those policies as the calling role, so anon MUST
-- retain EXECUTE on this SECURITY DEFINER helper or otherwise-public reads
-- start returning empty results. The linter warning is a known false
-- positive for the standard user_roles pattern documented by Supabase.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;