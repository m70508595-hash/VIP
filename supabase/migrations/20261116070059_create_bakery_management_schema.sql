/*
# Create bakery management schema

Plain-English summary
This sets up everything the Al-Rayyan bakery app stores: staff profiles, attendance (clock in/out), shop expenses, cash records, salary advances, and a manager-only daily report.

1. New Tables
- `profiles`: one row per staff member (name and role: 'manager' or 'employee'). Created automatically when an account is added.
- `attendance`: clock-in and clock-out times per employee per day.
- `expenses`: shop expense invoices with amount.
- `cash_records`: cash amounts recorded by staff.
- `salary_advances`: salary advances per employee.

2. Functions
- `manager_daily_summary(p_date)`: returns today's cash, expense and advance totals. Only managers can call it.
- `handle_new_user()`: copies new sign-ups into `profiles`.

3. Security
- Row level security is enabled on every table.
- Employees can only read and write their own rows. Clock-out is the only attendance column employees may change.
- Managers can read all advances and record advances for anyone.
- The daily summary function is not callable by anonymous visitors and checks the manager role itself.

4. Important notes
- Existing accounts get a profile row automatically during this migration.
- New accounts must be given a role (manager or employee) by an administrator; employees cannot change their own role.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (clock_out IS NULL OR clock_out >= clock_in)
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_name text NOT NULL CHECK (length(trim(invoice_name)) > 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_user_date_idx ON attendance (user_id, work_date);
CREATE INDEX IF NOT EXISTS expenses_created_idx ON expenses (created_at);
CREATE INDEX IF NOT EXISTS cash_records_recorded_idx ON cash_records (recorded_at);
CREATE INDEX IF NOT EXISTS salary_advances_created_idx ON salary_advances (created_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (full_name) ON profiles TO authenticated;
GRANT SELECT, INSERT ON attendance TO authenticated;
GRANT UPDATE (clock_out) ON attendance TO authenticated;
GRANT SELECT, INSERT ON expenses TO authenticated;
GRANT SELECT, INSERT ON cash_records TO authenticated;
GRANT SELECT, INSERT ON salary_advances TO authenticated;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "select_own_attendance" ON attendance;
CREATE POLICY "select_own_attendance" ON attendance FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_attendance" ON attendance;
CREATE POLICY "insert_own_attendance" ON attendance FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_attendance" ON attendance;
CREATE POLICY "update_own_attendance" ON attendance FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_expenses" ON expenses;
CREATE POLICY "select_own_expenses" ON expenses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_expenses" ON expenses;
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_cash_records" ON cash_records;
CREATE POLICY "select_own_cash_records" ON cash_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cash_records" ON cash_records;
CREATE POLICY "insert_own_cash_records" ON cash_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_advances_own_or_manager" ON salary_advances;
CREATE POLICY "select_advances_own_or_manager" ON salary_advances FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
  );

DROP POLICY IF EXISTS "insert_advances_by_manager" ON salary_advances;
CREATE POLICY "insert_advances_by_manager" ON salary_advances FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.manager_daily_summary(p_date date)
RETURNS TABLE (cash_total numeric, expenses_total numeric, advances_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') THEN
    RAISE EXCEPTION 'manager role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COALESCE(SUM(c.amount), 0) FROM cash_records c WHERE c.recorded_at::date = p_date),
    (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.created_at::date = p_date),
    (SELECT COALESCE(SUM(s.amount), 0) FROM salary_advances s WHERE s.created_at::date = p_date);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.manager_daily_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_daily_summary(date) TO authenticated;
