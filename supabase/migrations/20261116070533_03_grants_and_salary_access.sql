/*
# Grant app access and restrict salary and report functions

Plain-English summary
The schema and security rules from the earlier files control which rows each person can see. This migration lets signed-in staff reach those tables at all, and closes two gaps.

1. Table access
- Signed-in users get the table permissions their row rules need (for example, employees can add expenses, managers can edit them).
- Anonymous visitors get no table access. The only thing they can call is the activation code check used during sign-up.
- Activation settings are readable only by signed-in managers.

2. Function access
- The full monthly salary report no longer returns other people's salaries to employees; it runs with the caller's own permissions.
- The daily manager report and the personal salary lookup are callable only by signed-in users, never by anonymous visitors.

3. Important notes
- Row-level rules from the earlier files still decide which rows are visible; this migration only adds the permissions they depend on.
*/

GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE ON overtime TO authenticated;
GRANT SELECT, INSERT, UPDATE ON expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cash_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON salary_advances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON salary_settings TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_activation_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_activation_code(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.salary_month_summary(date) FROM PUBLIC, anon;
ALTER FUNCTION public.salary_month_summary(date) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.salary_month_summary(date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_salary_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_salary_summary() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.manager_daily_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_daily_summary(date) TO authenticated;
