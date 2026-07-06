
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_experience_booked_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_visits_on_completion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_offering(uuid, uuid) FROM PUBLIC, anon;
