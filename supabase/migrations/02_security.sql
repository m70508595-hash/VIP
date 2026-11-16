create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='manager' and active=true);
$$;

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
 select public.is_manager()
 or exists(select 1 from public.employee_permissions where user_id=auth.uid() and permission_key=p_key);
$$;

create or replace function public.validate_activation_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
 select exists(select 1 from public.app_settings where key='activation_code' and value=p_code);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare r text;
begin
 select case when exists(select 1 from public.profiles where role='manager') then 'employee' else 'manager' end into r;
 insert into public.profiles(id,full_name,email,role) values(new.id,new.raw_user_meta_data->>'full_name',new.email,r)
 on conflict(id) do nothing;
 return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.recalc_attendance()
returns trigger
language plpgsql
as $$
begin
 if new.clock_in is not null and new.clock_out is not null then
   new.total_hours = round((extract(epoch from (new.clock_out-new.clock_in))/3600)::numeric,2);
 end if;
 return new;
end;
$$;

drop trigger if exists trg_recalc_attendance on public.attendance;
create trigger trg_recalc_attendance before insert or update on public.attendance
for each row execute procedure public.recalc_attendance();

create or replace function public.salary_month_summary(p_month date)
returns table(
 user_id uuid, full_name text, base_salary numeric, overtime_amount numeric,
 advances numeric, deductions numeric, final_amount numeric
)
language sql
stable
security definer
set search_path=public
as $$
 select p.id,p.full_name,coalesce(s.base_salary,0),
 coalesce((select sum(o.amount) from public.overtime o where o.user_id=p.id and o.status='approved'
   and o.work_date >= date_trunc('month',p_month)::date and o.work_date < (date_trunc('month',p_month)+interval '1 month')::date),0),
 coalesce((select sum(a.amount) from public.salary_advances a where a.user_id=p.id
   and a.advance_date >= date_trunc('month',p_month)::date and a.advance_date < (date_trunc('month',p_month)+interval '1 month')::date),0),
 coalesce(s.deduction,0),
 coalesce(s.base_salary,0)
 + coalesce((select sum(o.amount) from public.overtime o where o.user_id=p.id and o.status='approved'
   and o.work_date >= date_trunc('month',p_month)::date and o.work_date < (date_trunc('month',p_month)+interval '1 month')::date),0)
 - coalesce((select sum(a.amount) from public.salary_advances a where a.user_id=p.id
   and a.advance_date >= date_trunc('month',p_month)::date and a.advance_date < (date_trunc('month',p_month)+interval '1 month')::date),0)
 - coalesce(s.deduction,0)
 from public.profiles p left join public.salary_settings s on s.user_id=p.id
 where p.role='employee';
$$;

create or replace function public.get_my_salary_summary()
returns table(final_amount numeric)
language sql
stable
security definer
set search_path=public
as $$
 select x.final_amount from public.salary_month_summary(date_trunc('month',current_date)::date) x
 where x.user_id=auth.uid();
$$;

create or replace function public.manager_daily_summary(p_date date)
returns table(cash_total numeric,expenses_total numeric,advances_total numeric)
language sql
stable
security definer
set search_path=public
as $$
 select
 coalesce((select sum(amount) from public.cash_records where recorded_at::date=p_date),0),
 coalesce((select sum(amount) from public.expenses where spent_at::date=p_date),0),
 coalesce((select sum(amount) from public.salary_advances where advance_date=p_date),0)
 where public.is_manager();
$$;

alter table public.profiles enable row level security;
alter table public.employee_permissions enable row level security;
alter table public.attendance enable row level security;
alter table public.overtime enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_records enable row level security;
alter table public.salary_advances enable row level security;
alter table public.salary_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id=auth.uid() or public.is_manager());
drop policy if exists profiles_update_manager on public.profiles;
create policy profiles_update_manager on public.profiles for update using(public.is_manager()) with check(public.is_manager());

drop policy if exists perms_select on public.employee_permissions;
create policy perms_select on public.employee_permissions for select using(user_id=auth.uid() or public.is_manager());
drop policy if exists perms_manager on public.employee_permissions;
create policy perms_manager on public.employee_permissions for all using(public.is_manager()) with check(public.is_manager());

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select using(user_id=auth.uid() or public.is_manager());
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert with check(user_id=auth.uid() and public.has_permission('attendance'));
drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update using(public.is_manager() or (user_id=auth.uid() and public.has_permission('attendance'))) with check(public.is_manager() or user_id=auth.uid());

drop policy if exists overtime_select on public.overtime;
create policy overtime_select on public.overtime for select using(user_id=auth.uid() or public.is_manager());
drop policy if exists overtime_insert on public.overtime;
create policy overtime_insert on public.overtime for insert with check(user_id=auth.uid() and public.has_permission('overtime'));
drop policy if exists overtime_manager_update on public.overtime;
create policy overtime_manager_update on public.overtime for update using(public.is_manager()) with check(public.is_manager());

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select using(user_id=auth.uid() or public.is_manager());
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert with check(user_id=auth.uid() and public.has_permission('expenses'));
drop policy if exists expenses_manager_update on public.expenses;
create policy expenses_manager_update on public.expenses for update using(public.is_manager()) with check(public.is_manager());

drop policy if exists cash_select on public.cash_records;
create policy cash_select on public.cash_records for select using(user_id=auth.uid() or public.is_manager());
drop policy if exists cash_insert on public.cash_records;
create policy cash_insert on public.cash_records for insert with check(user_id=auth.uid() and public.has_permission('cash'));
drop policy if exists cash_manager_update on public.cash_records;
create policy cash_manager_update on public.cash_records for update using(public.is_manager()) with check(public.is_manager());

drop policy if exists advances_select on public.salary_advances;
create policy advances_select on public.salary_advances for select using(user_id=auth.uid() or public.is_manager());
drop policy if exists advances_manager on public.salary_advances;
create policy advances_manager on public.salary_advances for all using(public.is_manager()) with check(public.is_manager());

drop policy if exists salary_select on public.salary_settings;
create policy salary_select on public.salary_settings for select using(public.is_manager());
drop policy if exists salary_manager on public.salary_settings;
create policy salary_manager on public.salary_settings for all using(public.is_manager()) with check(public.is_manager());

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using(public.is_manager());

drop policy if exists app_settings_manager on public.app_settings;
create policy app_settings_manager on public.app_settings for all using(public.is_manager()) with check(public.is_manager());
