/*
# Remove anonymous access to app tables and internal helper functions

Plain-English summary
New tables were automatically open to anonymous visitors by the database defaults. Row rules already blocked them, but this removes that access entirely. Internal permission helpers are now callable only by signed-in users. The sign-up activation check stays available to anonymous visitors because sign-up needs it.

1. Security changes
- Anonymous visitors lose all table access.
- Permission helper functions are no longer callable by anonymous visitors.
- The attendance helper function has a fixed search path.

2. Important notes
- Row rules still decide which rows each signed-in person sees.
*/

REVOKE ALL ON profiles, employee_permissions, attendance, overtime, expenses, cash_records, salary_advances, salary_settings, audit_logs, app_settings FROM anon;

REVOKE EXECUTE ON FUNCTION public.is_manager() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_attendance() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.recalc_attendance() SET search_path = public;
