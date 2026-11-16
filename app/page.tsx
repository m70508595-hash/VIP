"use client";
import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const THEME = {
  bg: '#0A0A0A',
  card: '#141414',
  border: '#2A2518',
  gold: '#D4AF37',
  goldHover: '#F3E5AB',
  text: '#F5F5F5',
  muted: '#8E8E93',
  danger: '#E53935',
  success: '#2E7D32',
};

export default function AlRayyanSystem() {
  const supabase = createClientComponentClient();
  const [splash, setSplash] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [overtimeList, setOvertimeList] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [cashList, setCashList] = useState<any[]>([]);
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ activation_code: '7777', default_overtime_rate: 5 });
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1800);
    checkSession();
    return () => clearTimeout(timer);
  }, []);

  const checkSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    if (session?.user) {
      await loadUserData(session.user.id);
    }
    setLoading(false);
  };

  const loadUserData = async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(prof);
    if (prof?.role === 'employee') {
      const { data: perms } = await supabase.from('permissions').select('*').eq('user_id', userId).single();
      setPermissions(perms);
    }
    await refreshAllData(prof);
  };

  const refreshAllData = async (currentProf = profile) => {
    if (!currentProf) return;
    const isMgr = currentProf.role === 'manager';
    const [att, ovt, exp, csh, adv, sett] = await Promise.all([
      supabase.from('attendance').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('overtime').select('*, profiles(full_name, overtime_rate)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('cash_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('advances_deductions').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('system_settings').select('*').eq('id', 1).single(),
    ]);

    setAttendanceList(att.data || []);
    setOvertimeList(ovt.data || []);
    setExpensesList(exp.data || []);
    setCashList(csh.data || []);
    setAdvancesList(adv.data || []);
    if (sett.data) setSettings(sett.data);

    if (isMgr) {
      const [emps, logs] = await Promise.all([
        supabase.from('profiles').select('*, permissions(*)').order('created_at', { ascending: true }),
        supabase.from('audit_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(50),
      ]);
      setEmployees(emps.data || []);
      setAuditLogs(logs.data || []);
    }
  };

  const logAudit = async (action: string, target_table: string, details: any = {}) => {
    if (!profile) return;
    await supabase.from('audit_logs').insert({
      actor_id: profile.id,
      action,
      target_table,
      details,
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg('');
    if (authMode === 'register') {
      const { data: sys } = await supabase.from('system_settings').select('activation_code').eq('id', 1).single();
      if (!sys || activationCode !== sys.activation_code) {
        setAuthMsg(' صحيح. تواصل مع الإدارة.');
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthMsg(error.message);
        return;
      }
      if (data.user) {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const assignedRole = count === 0 ? 'manager' : 'employee';
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          role: assignedRole,
        });
        if (assignedRole === 'employee') {
          await supabase.from('permissions').insert({ user_id: data.user.id });
        }
        notify('تم إنشاء الحساب بنجاح!');
        checkSession();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMsg('وني أو كلمة المرور غير صحيحة.');
      } else {
        checkSession();
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setActiveTab('home');
  };

  const handleCheckIn = async () => {
    const openShift = attendanceList.find((a) => a.user_id === profile.id && !a.check_out);
    if (openShift) return notify('لديك وردية مفتوحة بالفعل!');
    await supabase.from('attendance').insert({ user_id: profile.id });
    await logAudit('تسجيل بداية دوام', 'attendance');
    notify('✅ تم تسجيل بداية الدوام');
    refreshAllData();
  };

  const handleCheckOut = async (record: any) => {
    const now = new Date();
    const start = new Date(record.check_in);
    const hours = Number(((now.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2));
    await supabase.from('attendance').update({ check_out: now.toISOString(), total_hours: hours }).eq('id', record.id);
    await logAudit('تسجيل نهاية دوام', 'attendance', { hours });
    notify(`✅ تم إنهاء الدوام (${hours} ساعة)`);
    refreshAllData();
  };

  const handleEditAttendance = async (id: string, newHours: number) => {
    await supabase.from('attendance').update({ total_hours: newHours, edited_by: profile.id }).eq('id', id);
    await logAudit('تعديل ساعات دوام موظف', 'attendance', { record_id: id, newHours });
    notify('✅ تم تعديل الساعات وتسجيل العملية');
    refreshAllData();
  };

  const handleAddOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeHours) return;
    await supabase.from('overtime').insert({
      user_id: profile.id,
      hours: Number(overtimeHours),
      rate_at_time: profile.overtime_rate || settings.default_overtime_rate,
    });
    setOvertimeHours('');
    notify('✅ تم إرسال طلب الساعات الإضافية للمدير');
    refreshAllData();
  };

  const handleOvertimeDecision = async (item: any, status: 'approved' | 'rejected') => {
    const rate = item.profiles?.overtime_rate || settings.default_overtime_rate;
    await supabase.from('overtime').update({ status, rate_at_time: rate }).eq('id', item.id);
    await logAudit(`قرار إضافي: ${status}`, 'overtime', { id: item.id, employee: item.profiles?.full_name });
    notify(status === 'approved' ? '✅ تم اعتماد الساعات الإضافية' : '❌ تم رفض الطلب');
    refreshAllData();
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount) return;
    await supabase.from('expenses').insert({
      user_id: profile.id,
      title: expenseTitle,
      amount: Number(expenseAmount),
    });
    await logAudit('إضافة مصروف', 'expenses', { title: expenseTitle, amount: expenseAmount });
    setExpenseTitle('');
    setExpenseAmount('');
    notify('✅ تم تسجيل المصروف تلقائياً باسمك والوقت الحالي');
    refreshAllData();
  };

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount) return;
    await supabase.from('cash_logs').insert({
      user_id: profile.id,
      amount: Number(cashAmount),
    });
    await logAudit('تسجيل مبلغ كاش', 'cash_logs', { amount: cashAmount });
    setCashAmount('');
    notify('✅ تم حفظ مبلغ الكاش بنجاح');
    refreshAllData();
  };

  const calculateNetSalary = (emp: any) => {
    const base = Number(emp.base_salary || 0);
    const approvedOvertime = overtimeList
      .filter((o) => o.user_id === emp.id && o.status === 'approved')
      .reduce((sum, o) => sum + Number(o.hours) * Number(o.rate_at_time), 0);
    const advances = advancesList
      .filter((a) => a.user_id === emp.id && a.type === 'advance')
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const deductions = advancesList
      .filter((a) => a.user_id === emp.id && a.type === 'deduction')
      .reduce((sum, a) => sum + Number(a.amount), 0);

    return {
      base,
      approvedOvertime,
      advances,
      deductions,
      net: base + approvedOvertime - advances - deductions,
    };
  };

  if (splash) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.gold, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', border: `2px solid ${THEME.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, marginBottom: 20, boxShadow: `0 0 25px rgba(212,175,55,0.3)` }}>
          👑
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 1 }}>معجنات الريان</h1>
        <p style={{ color: THEME.muted, marginTop: 8 }}>نظام الإدارة المتكامل</p>
      </div>
    );
  }

  if (loading) {
    return <div dir="rtl" style={{ background: THEME.bg, color: THEME.gold, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري تحميل النظام...</div>;
  }

  if (!session || !profile) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ color: THEME.gold, fontSize: 26, margin: 0 }}>معجنات الريان</h2>
            <p style={{ color: THEME.muted, fontSize: 14, marginTop: 6 }}>
              {authMode === 'login' ? 'تسجيل الدخول إلى لوحة التحكم' : 'إنشاء حساب موظف جديد'}
            </p>
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {authMode === 'register' && (
              <>
                <input type="text" placeholder="الاسم الكامل" required value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="كود التفعيل الخاص بالمحل" required value={activationCode} onChange={(e) => setActivationCode(e.target.value)} style={inputStyle} />
              </>
            )}
            <input type="email" placeholder="البريد الإلكتروني" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="كلمة المرور" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            {authMsg && <p style={{ color: THEME.danger, fontSize: 13, textAlign: 'center' }}>{authMsg}</p>}
            <button type="submit" style={goldBtnStyle}>{authMode === 'login' ? 'دخول' : 'تفعيل وإنشاء الحساب'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthMsg(''); }} style={{ background: 'none', border: 'none', color: THEME.gold, cursor: 'pointer', fontSize: 14 }}>
              {authMode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isManager = profile.role === 'manager';
  const navItems = isManager
    ? [
        { id: 'home', label: 'الرئيسية', icon: '🏛️' },
        { id: 'employees', label: 'الموظفين', icon: '👥' },
        { id: 'attendance', label: 'الدوام والإضافي', icon: '🕐' },
        { id: 'expenses', label: 'مصاريف المحل', icon: '💸' },
        { id: 'cash', label: 'مبلغ الكاش', icon: '💰' },
        { id: 'salaries', label: 'الرواتب والسلف', icon: '💵' },
        { id: 'reports', label: 'التقارير', icon: '📊' },
        { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
      ]
    : [
        { id: 'home', label: 'الرئيسية', icon: '🏛️', allowed: true },
        { id: 'attendance', label: 'الدوام', icon: '🕐', allowed: permissions?.can_attendance },
        { id: 'overtime', label: 'الإضافي', icon: '⏱️', allowed: permissions?.can_overtime },
        { id: 'expenses', label: 'المصاريف', icon: '💸', allowed: permissions?.can_expenses },
        { id: 'cash', label: 'الكاش', icon: '💰', allowed: permissions?.can_cash },
        { id: 'salaries', label: 'الراتب', icon: '💵', allowed: permissions?.can_salary },
      ].filter((item) => item.allowed);

  return (
    <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: '100vh', fontFamily: 'system-ui, sans-serif', paddingBottom: 40 }}>
      <header style={{ background: THEME.card, borderBottom: `1px solid ${THEME.border}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ color: THEME.gold, fontSize: 20, margin: 0 }}>معجنات الريان</h1>
          <span style={{ fontSize: 12, color: THEME.muted }}>مرحباً، {profile.full_name} ({isManager ? 'المدير العام' : 'موظف'})</span>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: `1px solid ${THEME.danger}`, color: THEME.danger, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>تسجيل الخروج</button>
      </header>

      {toast && (
        <div style={{ background: THEME.gold, color: '#000', textAlign: 'center', padding: '10px', fontWeight: 'bold', fontSize: 14 }}>{toast}</div>
      )}

      <main style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
        {activeTab !== 'home' && (
          <button onClick={() => setActiveTab('home')} style={{ background: THEME.card, color: THEME.gold, border: `1px solid ${THEME.border}`, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: 20 }}>→ العودة للقائمة الرئيسية</button>
        )}

        {activeTab === 'home' && (
          <div>
            <h2 style={{ color: THEME.gold, marginBottom: 20, fontSize: 22 }}>لوحة التحكم</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              {navItems.filter((i) => i.id !== 'home').map((item) => (
                <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 24, textAlign: 'center', cursor: 'pointer', transition: '0.2s' }}>
                  <div style={{ fontSize: 34, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ color: THEME.gold, fontWeight: 'bold', fontSize: 16 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'employees' && isManager && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>👥 إدارة الموظفين والصلاحيات</h2>
            {employees.map((emp) => {
              const p = emp.permissions?.[0] || emp.permissions || {};
              return (
                <div key={emp.id} style={{ borderBottom: `1px solid ${THEME.border}`, padding: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: 17, color: THEME.gold }}>{emp.full_name}</strong>
                      <span style={{ marginRight: 10, fontSize: 12, color: THEME.muted }}>({emp.role === 'manager' ? 'مدير' : 'موظف'})</span>
                    </div>
                    {emp.role === 'employee' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { key: 'can_attendance', label: 'الدوام' },
                          { key: 'can_overtime', label: 'الإضافي' },
                          { key: 'can_expenses', label: 'المصاريف' },
                          { key: 'can_cash', label: 'الكاش' },
                          { key: 'can_salary', label: 'الراتب' },
                        ].map((perm) => (
                          <label key={perm.key} style={{ fontSize: 13, background: '#1f1f1f', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!p[perm.key]} onChange={async (e) => {
                              await supabase.from('permissions').update({ [perm.key]: e.target.checked }).eq('user_id', emp.id);
                              await logAudit('تعديل صلاحية موظف', 'permissions', { emp: emp.full_name, perm: perm.key, val: e.target.checked });
                              notify('تم تحديث الصلاحية');
                              refreshAllData();
                            }} /> {perm.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(activeTab === 'attendance' || activeTab === 'overtime') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(isManager || (activeTab === 'attendance' && permissions?.can_attendance)) && (
              <div style={cardStyle}>
                <h2 style={{ color: THEME.gold, marginTop: 0 }}>🕐 سجل الدوام</h2>
                {!isManager && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <button onClick={handleCheckIn} style={goldBtnStyle}>تسجيل بداية الدوام</button>
                    {attendanceList.find((a) => a.user_id === profile.id && !a.check_out) && (
                      <button onClick={() => handleCheckOut(attendanceList.find((a) => a.user_id === profile.id && !a.check_out))} style={{ ...goldBtnStyle, background: THEME.danger, color: '#fff' }}>تسجيل نهاية الدوام</button>
                    )}
                  </div>
                )}
                {attendanceList.map((rec) => (
                  <div key={rec.id} style={rowStyle}>
                    <div>
                      <strong>{rec.profiles?.full_name}</strong>
                      <div style={{ fontSize: 12, color: THEME.muted }}>دخول: {new Date(rec.check_in).toLocaleString('ar-JO')} | خروج: {rec.check_out ? new Date(rec.check_out).toLocaleString('ar-JO') : 'على رأس عمله'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: THEME.gold, fontWeight: 'bold' }}>{rec.total_hours ? `${rec.total_hours} ساعة` : '-'}</span>
                      {isManager && rec.check_out && (
                        <button onClick={() => {
                          const val = prompt('أدخل عدد الساعات المعدل:', rec.total_hours);
                          if (val && !isNaN(Number(val))) handleEditAttendance(rec.id, Number(val));
                        }} style={smallBtnStyle}>تعديل</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(isManager || (activeTab === 'overtime' && permissions?.can_overtime)) && (
              <div style={cardStyle}>
                <h2 style={{ color: THEME.gold, marginTop: 0 }}>⏱️ الساعات الإضافية</h2>
                {!isManager && (
                  <form onSubmit={handleAddOvertime} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <input type="number" step="0.5" placeholder="عدد الساعات الإضافية" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} style={inputStyle} required />
                    <button type="submit" style={goldBtnStyle}>تسجيل</button>
                  </form>
                )}
                {overtimeList.map((ov) => (
                  <div key={ov.id} style={rowStyle}>
                    <div>
                      <strong>{ov.profiles?.full_name}</strong> — <span style={{ color: THEME.gold }}>{ov.hours} ساعة</span>
                      <div style={{ fontSize: 12, color: THEME.muted }}>التاريخ: {ov.work_date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: ov.status === 'approved' ? '#4CAF50' : ov.status === 'rejected' ? THEME.danger : THEME.gold }}>
                        {ov.status === 'approved' ? 'معتمد' : ov.status === 'rejected' ? 'مرفوض' : 'بانتظار الاعتماد'}
                      </span>
                      {isManager && ov.status === 'pending' && (
                        <>
                          <button onClick={() => handleOvertimeDecision(ov, 'approved')} style={{ ...smallBtnStyle, background: THEME.success }}>اعتماد</button>
                          <button onClick={() => handleOvertimeDecision(ov, 'rejected')} style={{ ...smallBtnStyle, background: THEME.danger }}>رفض</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'expenses' && (isManager || permissions?.can_expenses) && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>💸 مصاريف المحل</h2>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <input type="text" placeholder="اسم الفاتورة / البيان" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} style={{ ...inputStyle, flex: 2 }} required />
              <input type="number" step="0.01" placeholder="المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
              <button type="submit" style={goldBtnStyle}>حفظ المصروف</button>
            </form>
            {expensesList.map((exp) => (
              <div key={exp.id} style={rowStyle}>
                <div>
                  <strong>{exp.title}</strong>
                  <div style={{ fontSize: 12, color: THEME.muted }}>بواسطة: {exp.profiles?.full_name} | {new Date(exp.created_at).toLocaleString('ar-JO')}</div>
                </div>
                <strong style={{ color: THEME.gold }}>{exp.amount} د.أ</strong>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cash' && (isManager || permissions?.can_cash) && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>💰 تسليم مبلغ الكاش</h2>
            <form onSubmit={handleAddCash} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input type="number" step="0.01" placeholder="أدخل مبلغ الكاش فقط" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} style={inputStyle} required />
              <button type="submit" style={goldBtnStyle}>تسجيل الكاش</button>
            </form>
            {cashList.map((c) => (
              <div key={c.id} style={rowStyle}>
                <div>
                  <strong>{c.profiles?.full_name}</strong>
                  <div style={{ fontSize: 12, color: THEME.muted }}>{new Date(c.created_at).toLocaleString('ar-JO')}</div>
                </div>
                <strong style={{ color: THEME.gold, fontSize: 18 }}>{c.amount} د.أ</strong>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'salaries' && (isManager || permissions?.can_salary) && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>💵 {isManager ? 'إدارة الرواتب والسلف' : 'الراتب المستحق'}</h2>
            {!isManager ? (
              <div style={{ textAlign: 'center', padding: 30, background: '#111', borderRadius: 12, border: `1px solid ${THEME.gold}` }}>
                <p style={{ color: THEME.muted, marginBottom: 8 }}>صافي المبلغ المستحق لك حالياً</p>
                <div style={{ fontSize: 38, fontWeight: 'bold', color: THEME.gold }}>{calculateNetSalary(profile).net.toFixed(2)} د.أ</div>
              </div>
            ) : (
              employees.map((emp) => {
                const calc = calculateNetSalary(emp);
                return (
                  <div key={emp.id} style={{ borderBottom: `1px solid ${THEME.border}`, padding: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <strong style={{ fontSize: 18, color: THEME.gold }}>{emp.full_name}</strong>
                        <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4 }}>الاساسي: {calc.base} | الإضافي المعتمد: +{calc.approvedOvertime} | السلف: -{calc.advances} | الخصومات: -{calc.deductions}</div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#4CAF50' }}>المستحق: {calc.net.toFixed(2)} د.أ</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <button onClick={async () => {
                        const val = prompt('الراتب الأساسي الجديد:', emp.base_salary);
                        if (val !== null && !isNaN(Number(val))) {
                          await supabase.from('profiles').update({ base_salary: Number(val) }).eq('id', emp.id);
                          await logAudit('تعديل راتب أساسي', 'profiles', { emp: emp.full_name, val });
                          refreshAllData();
                        }
                      }} style={smallBtnStyle}>تعديل الأساسي</button>
                      <button onClick={async () => {
                        const val = prompt('سعر ساعة الإضافي للموظف:', emp.overtime_rate);
                        if (val !== null && !isNaN(Number(val))) {
                          await supabase.from('profiles').update({ overtime_rate: Number(val) }).eq('id', emp.id);
                          refreshAllData();
                        }
                      }} style={smallBtnStyle}>سعر الإضافي ({emp.overtime_rate})</button>
                      <button onClick={async () => {
                        const val = prompt('قيمة السلفة:');
                        if (val && !isNaN(Number(val))) {
                          await supabase.from('advances_deductions').insert({ user_id: emp.id, type: 'advance', amount: Number(val), month_year: new Date().toISOString().slice(0, 7) });
                          await logAudit('تسجيل سلفة', 'advances_deductions', { emp: emp.full_name, val });
                          refreshAllData();
                        }
                      }} style={smallBtnStyle}>+ تسجيل سلفة</button>
                      <button onClick={async () => {
                        const val = prompt('قيمة الخصم:');
                        if (val && !isNaN(Number(val))) {
                          await supabase.from('advances_deductions').insert({ user_id: emp.id, type: 'deduction', amount: Number(val), month_year: new Date().toISOString().slice(0, 7) });
                          await logAudit('تسجيل خصم', 'advances_deductions', { emp: emp.full_name, val });
                          refreshAllData();
                        }
                      }} style={{ ...smallBtnStyle, borderColor: THEME.danger, color: THEME.danger }}>+ تسجيل خصم</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'reports' && isManager && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={cardStyle}>
              <h2 style={{ color: THEME.gold, marginTop: 0 }}>📊 ملخص التقارير المالية</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ background: '#111', padding: 16, borderRadius: 10 }}>
                  <div style={{ color: THEME.muted, fontSize: 13 }}>إجمالي الكاش المسجل</div>
                  <div style={{ color: '#4CAF50', fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>{cashList.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)} د.أ</div>
                </div>
                <div style={{ background: '#111', padding: 16, borderRadius: 10 }}>
                  <div style={{ color: THEME.muted, fontSize: 13 }}>إجمالي مصاريف المحل</div>
                  <div style={{ color: THEME.danger, fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>{expensesList.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)} د.أ</div>
                </div>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: THEME.gold, marginTop: 0 }}>🛡️ سجل العمليات والمراقبة (Audit Log)</h3>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ fontSize: 13, borderBottom: `1px solid ${THEME.border}`, padding: '8px 0', color: THEME.muted }}>
                  <strong style={{ color: THEME.text }}>{log.profiles?.full_name || 'النظام'}</strong>: {log.action} — <span>{new Date(log.created_at).toLocaleString('ar-JO')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && isManager && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>⚙️ إعدادات النظام</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: THEME.muted }}>كود التفعيل لتسجيل الموظفين الجدد</label>
                <input type="text" value={settings.activation_code} onChange={(e) => setSettings({ ...settings, activation_code: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: THEME.muted }}>سعر ساعة الإضافي الافتراضي</label>
                <input type="number" value={settings.default_overtime_rate} onChange={(e) => setSettings({ ...settings, default_overtime_rate: Number(e.target.value) })} style={inputStyle} />
              </div>
              <button onClick={async () => {
                await supabase.from('system_settings').update({ activation_code: settings.activation_code, default_overtime_rate: settings.default_overtime_rate }).eq('id', 1);
                await logAudit('تحديث إعدادات النظام', 'system_settings');
                notify('✅ تم حفظ الإعدادات');
              }} style={goldBtnStyle}>حفظ الإعدادات</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 24 };
const inputStyle: React.CSSProperties = { background: '#0A0A0A', border: `1px solid ${THEME.border}`, color: '#FFF', padding: '12px 14px', borderRadius: 10, fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' };
const goldBtnStyle: React.CSSProperties = { background: THEME.gold, color: '#000', border: 'none', padding: '12px 20px', borderRadius: 10, fontWeight: 'bold', fontSize: 15, cursor: 'pointer' };
const smallBtnStyle: React.CSSProperties = { background: 'transparent', border: `1px solid ${THEME.gold}`, color: THEME.gold, padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' };
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${THEME.border}` };
"use client";
import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const THEME = {
  bg: '#0A0A0A',
  card: '#141414',
  border: '#2A2518',
  gold: '#D4AF37',
  goldHover: '#F3E5AB',
  text: '#F5F5F5',
  muted: '#8E8E93',
  danger: '#E53935',
  success: '#2E7D32',
};

export default function AlRayyanSystem() {
  const supabase = createClientComponentClient();
  const [splash, setSplash] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [overtimeList, setOvertimeList] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [cashList, setCashList] = useState<any[]>([]);
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ activation_code: '7777', default_overtime_rate: 5 });
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1800);
    checkSession();
    return () => clearTimeout(timer);
  }, []);

  const checkSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    if (session?.user) {
      await loadUserData(session.user.id);
    }
    setLoading(false);
  };

  const loadUserData = async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(prof);
    if (prof?.role === 'employee') {
      const { data: perms } = await supabase.from('permissions').select('*').eq('user_id', userId).single();
      setPermissions(perms);
    }
    await refreshAllData(prof);
  };

  const refreshAllData = async (currentProf = profile) => {
    if (!currentProf) return;
    const isMgr = currentProf.role === 'manager';
    const [att, ovt, exp, csh, adv, sett] = await Promise.all([
      supabase.from('attendance').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('overtime').select('*, profiles(full_name, overtime_rate)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('cash_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('advances_deductions').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('system_settings').select('*').eq('id', 1).single(),
    ]);

    setAttendanceList(att.data || []);
    setOvertimeList(ovt.data || []);
    setExpensesList(exp.data || []);
    setCashList(csh.data || []);
    setAdvancesList(adv.data || []);
    if (sett.data) setSettings(sett.data);

    if (isMgr) {
      const [emps, logs] = await Promise.all([
        supabase.from('profiles').select('*, permissions(*)').order('created_at', { ascending: true }),
        supabase.from('audit_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(50),
      ]);
      setEmployees(emps.data || []);
      setAuditLogs(logs.data || []);
    }
  };

  const logAudit = async (action: string, target_table: string, details: any = {}) => {
    if (!profile) return;
    await supabase.from('audit_logs').insert({
      actor_id: profile.id,
      action,
      target_table,
      details,
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg('');
    if (authMode === 'register') {
      const { data: sys } = await supabase.from('system_settings').select('activation_code').eq('id', 1).single();
      if (!sys || activationCode !== sys.activation_code) {
        setAuthMsg(' صحيح. تواصل مع الإدارة.');
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthMsg(error.message);
        return;
      }
      if (data.user) {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const assignedRole = count === 0 ? 'manager' : 'employee';
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          role: assignedRole,
        });
        if (assignedRole === 'employee') {
          await supabase.from('permissions').insert({ user_id: data.user.id });
        }
        notify('تم إنشاء الحساب بنجاح!');
        checkSession();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMsg('وني أو كلمة المرور غير صحيحة.');
      } else {
        checkSession();
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setActiveTab('home');
  };

  const handleCheckIn = async () => {
    const openShift = attendanceList.find((a) => a.user_id === profile.id && !a.check_out);
    if (openShift) return notify('لديك وردية مفتوحة بالفعل!');
    await supabase.from('attendance').insert({ user_id: profile.id });
    await logAudit('تسجيل بداية دوام', 'attendance');
    notify('✅ تم تسجيل بداية الدوام');
    refreshAllData();
  };

  const handleCheckOut = async (record: any) => {
    const now = new Date();
    const start = new Date(record.check_in);
    const hours = Number(((now.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2));
    await supabase.from('attendance').update({ check_out: now.toISOString(), total_hours: hours }).eq('id', record.id);
    await logAudit('تسجيل نهاية دوام', 'attendance', { hours });
    notify(`✅ تم إنهاء الدوام (${hours} ساعة)`);
    refreshAllData();
  };

  const handleEditAttendance = async (id: string, newHours: number) => {
    await supabase.from('attendance').update({ total_hours: newHours, edited_by: profile.id }).eq('id', id);
    await logAudit('تعديل ساعات دوام موظف', 'attendance', { record_id: id, newHours });
    notify('✅ تم تعديل الساعات وتسجيل العملية');
    refreshAllData();
  };

  const handleAddOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeHours) return;
    await supabase.from('overtime').insert({
      user_id: profile.id,
      hours: Number(overtimeHours),
      rate_at_time: profile.overtime_rate || settings.default_overtime_rate,
    });
    setOvertimeHours('');
    notify('✅ تم إرسال طلب الساعات الإضافية للمدير');
    refreshAllData();
  };

  const handleOvertimeDecision = async (item: any, status: 'approved' | 'rejected') => {
    const rate = item.profiles?.overtime_rate || settings.default_overtime_rate;
    await supabase.from('overtime').update({ status, rate_at_time: rate }).eq('id', item.id);
    await logAudit(`قرار إضافي: ${status}`, 'overtime', { id: item.id, employee: item.profiles?.full_name });
    notify(status === 'approved' ? '✅ تم اعتماد الساعات الإضافية' : '❌ تم رفض الطلب');
    refreshAllData();
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount) return;
    await supabase.from('expenses').insert({
      user_id: profile.id,
      title: expenseTitle,
      amount: Number(expenseAmount),
    });
    await logAudit('إضافة مصروف', 'expenses', { title: expenseTitle, amount: expenseAmount });
    setExpenseTitle('');
    setExpenseAmount('');
    notify('✅ تم تسجيل المصروف تلقائياً باسمك والوقت الحالي');
    refreshAllData();
  };

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount) return;
    await supabase.from('cash_logs').insert({
      user_id: profile.id,
      amount: Number(cashAmount),
    });
    await logAudit('تسجيل مبلغ كاش', 'cash_logs', { amount: cashAmount });
    setCashAmount('');
    notify('✅ تم حفظ مبلغ الكاش بنجاح');
    refreshAllData();
  };

  const calculateNetSalary = (emp: any) => {
    const base = Number(emp.base_salary || 0);
    const approvedOvertime = overtimeList
      .filter((o) => o.user_id === emp.id && o.status === 'approved')
      .reduce((sum, o) => sum + Number(o.hours) * Number(o.rate_at_time), 0);
    const advances = advancesList
      .filter((a) => a.user_id === emp.id && a.type === 'advance')
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const deductions = advancesList
      .filter((a) => a.user_id === emp.id && a.type === 'deduction')
      .reduce((sum, a) => sum + Number(a.amount), 0);

    return {
      base,
      approvedOvertime,
      advances,
      deductions,
      net: base + approvedOvertime - advances - deductions,
    };
  };

  if (splash) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.gold, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', border: `2px solid ${THEME.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, marginBottom: 20, boxShadow: `0 0 25px rgba(212,175,55,0.3)` }}>
          👑
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 1 }}>معجنات الريان</h1>
        <p style={{ color: THEME.muted, marginTop: 8 }}>نظام الإدارة المتكامل</p>
      </div>
    );
  }

  if (loading) {
    return <div dir="rtl" style={{ background: THEME.bg, color: THEME.gold, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري تحميل النظام...</div>;
  }

  if (!session || !profile) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ color: THEME.gold, fontSize: 26, margin: 0 }}>معجنات الريان</h2>
            <p style={{ color: THEME.muted, fontSize: 14, marginTop: 6 }}>
              {authMode === 'login' ? 'تسجيل الدخول إلى لوحة التحكم' : 'إنشاء حساب موظف جديد'}
            </p>
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {authMode === 'register' && (
              <>
                <input type="text" placeholder="الاسم الكامل" required value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="كود التفعيل الخاص بالمحل" required value={activationCode} onChange={(e) => setActivationCode(e.target.value)} style={inputStyle} />
              </>
            )}
            <input type="email" placeholder="البريد الإلكتروني" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="كلمة المرور" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            {authMsg && <p style={{ color: THEME.danger, fontSize: 13, textAlign: 'center' }}>{authMsg}</p>}
            <button type="submit" style={goldBtnStyle}>{authMode === 'login' ? 'دخول' : 'تفعيل وإنشاء الحساب'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthMsg(''); }} style={{ background: 'none', border: 'none', color: THEME.gold, cursor: 'pointer', fontSize: 14 }}>
              {authMode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isManager = profile.role === 'manager';
  const navItems = isManager
    ? [
        { id: 'home', label: 'الرئيسية', icon: '🏛️' },
        { id: 'employees', label: 'الموظفين', icon: '👥' },
        { id: 'attendance', label: 'الدوام والإضافي', icon: '🕐' },
        { id: 'expenses', label: 'مصاريف المحل', icon: '💸' },
        { id: 'cash', label: 'مبلغ الكاش', icon: '💰' },
        { id: 'salaries', label: 'الرواتب والسلف', icon: '💵' },
        { id: 'reports', label: 'التقارير', icon: '📊' },
        { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
      ]
    : [
        { id: 'home', label: 'الرئيسية', icon: '🏛️', allowed: true },
        { id: 'attendance', label: 'الدوام', icon: '🕐', allowed: permissions?.can_attendance },
        { id: 'overtime', label: 'الإضافي', icon: '⏱️', allowed: permissions?.can_overtime },
        { id: 'expenses', label: 'المصاريف', icon: '💸', allowed: permissions?.can_expenses },
        { id: 'cash', label: 'الكاش', icon: '💰', allowed: permissions?.can_cash },
        { id: 'salaries', label: 'الراتب', icon: '💵', allowed: permissions?.can_salary },
      ].filter((item) => item.allowed);

  return (
    <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: '100vh', fontFamily: 'system-ui, sans-serif', paddingBottom: 40 }}>
      <header style={{ background: THEME.card, borderBottom: `1px solid ${THEME.border}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ color: THEME.gold, fontSize: 20, margin: 0 }}>معجنات الريان</h1>
          <span style={{ fontSize: 12, color: THEME.muted }}>مرحباً، {profile.full_name} ({isManager ? 'المدير العام' : 'موظف'})</span>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: `1px solid ${THEME.danger}`, color: THEME.danger, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>تسجيل الخروج</button>
      </header>

      {toast && (
        <div style={{ background: THEME.gold, color: '#000', textAlign: 'center', padding: '10px', fontWeight: 'bold', fontSize: 14 }}>{toast}</div>
      )}

      <main style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
        {activeTab !== 'home' && (
          <button onClick={() => setActiveTab('home')} style={{ background: THEME.card, color: THEME.gold, border: `1px solid ${THEME.border}`, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: 20 }}>→ العودة للقائمة الرئيسية</button>
        )}

        {activeTab === 'home' && (
          <div>
            <h2 style={{ color: THEME.gold, marginBottom: 20, fontSize: 22 }}>لوحة التحكم</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              {navItems.filter((i) => i.id !== 'home').map((item) => (
                <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 24, textAlign: 'center', cursor: 'pointer', transition: '0.2s' }}>
                  <div style={{ fontSize: 34, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ color: THEME.gold, fontWeight: 'bold', fontSize: 16 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'employees' && isManager && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>👥 إدارة الموظفين والصلاحيات</h2>
            {employees.map((emp) => {
              const p = emp.permissions?.[0] || emp.permissions || {};
              return (
                <div key={emp.id} style={{ borderBottom: `1px solid ${THEME.border}`, padding: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: 17, color: THEME.gold }}>{emp.full_name}</strong>
                      <span style={{ marginRight: 10, fontSize: 12, color: THEME.muted }}>({emp.role === 'manager' ? 'مدير' : 'موظف'})</span>
                    </div>
                    {emp.role === 'employee' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { key: 'can_attendance', label: 'الدوام' },
                          { key: 'can_overtime', label: 'الإضافي' },
                          { key: 'can_expenses', label: 'المصاريف' },
                          { key: 'can_cash', label: 'الكاش' },
                          { key: 'can_salary', label: 'الراتب' },
                        ].map((perm) => (
                          <label key={perm.key} style={{ fontSize: 13, background: '#1f1f1f', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!p[perm.key]} onChange={async (e) => {
                              await supabase.from('permissions').update({ [perm.key]: e.target.checked }).eq('user_id', emp.id);
                              await logAudit('تعديل صلاحية موظف', 'permissions', { emp: emp.full_name, perm: perm.key, val: e.target.checked });
                              notify('تم تحديث الصلاحية');
                              refreshAllData();
                            }} /> {perm.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(activeTab === 'attendance' || activeTab === 'overtime') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(isManager || (activeTab === 'attendance' && permissions?.can_attendance)) && (
              <div style={cardStyle}>
                <h2 style={{ color: THEME.gold, marginTop: 0 }}>🕐 سجل الدوام</h2>
                {!isManager && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <button onClick={handleCheckIn} style={goldBtnStyle}>تسجيل بداية الدوام</button>
                    {attendanceList.find((a) => a.user_id === profile.id && !a.check_out) && (
                      <button onClick={() => handleCheckOut(attendanceList.find((a) => a.user_id === profile.id && !a.check_out))} style={{ ...goldBtnStyle, background: THEME.danger, color: '#fff' }}>تسجيل نهاية الدوام</button>
                    )}
                  </div>
                )}
                {attendanceList.map((rec) => (
                  <div key={rec.id} style={rowStyle}>
                    <div>
                      <strong>{rec.profiles?.full_name}</strong>
                      <div style={{ fontSize: 12, color: THEME.muted }}>دخول: {new Date(rec.check_in).toLocaleString('ar-JO')} | خروج: {rec.check_out ? new Date(rec.check_out).toLocaleString('ar-JO') : 'على رأس عمله'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: THEME.gold, fontWeight: 'bold' }}>{rec.total_hours ? `${rec.total_hours} ساعة` : '-'}</span>
                      {isManager && rec.check_out && (
                        <button onClick={() => {
                          const val = prompt('أدخل عدد الساعات المعدل:', rec.total_hours);
                          if (val && !isNaN(Number(val))) handleEditAttendance(rec.id, Number(val));
                        }} style={smallBtnStyle}>تعديل</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(isManager || (activeTab === 'overtime' && permissions?.can_overtime)) && (
              <div style={cardStyle}>
                <h2 style={{ color: THEME.gold, marginTop: 0 }}>⏱️ الساعات الإضافية</h2>
                {!isManager && (
                  <form onSubmit={handleAddOvertime} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <input type="number" step="0.5" placeholder="عدد الساعات الإضافية" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} style={inputStyle} required />
                    <button type="submit" style={goldBtnStyle}>تسجيل</button>
                  </form>
                )}
                {overtimeList.map((ov) => (
                  <div key={ov.id} style={rowStyle}>
                    <div>
                      <strong>{ov.profiles?.full_name}</strong> — <span style={{ color: THEME.gold }}>{ov.hours} ساعة</span>
                      <div style={{ fontSize: 12, color: THEME.muted }}>التاريخ: {ov.work_date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: ov.status === 'approved' ? '#4CAF50' : ov.status === 'rejected' ? THEME.danger : THEME.gold }}>
                        {ov.status === 'approved' ? 'معتمد' : ov.status === 'rejected' ? 'مرفوض' : 'بانتظار الاعتماد'}
                      </span>
                      {isManager && ov.status === 'pending' && (
                        <>
                          <button onClick={() => handleOvertimeDecision(ov, 'approved')} style={{ ...smallBtnStyle, background: THEME.success }}>اعتماد</button>
                          <button onClick={() => handleOvertimeDecision(ov, 'rejected')} style={{ ...smallBtnStyle, background: THEME.danger }}>رفض</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'expenses' && (isManager || permissions?.can_expenses) && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>💸 مصاريف المحل</h2>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <input type="text" placeholder="اسم الفاتورة / البيان" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} style={{ ...inputStyle, flex: 2 }} required />
              <input type="number" step="0.01" placeholder="المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
              <button type="submit" style={goldBtnStyle}>حفظ المصروف</button>
            </form>
            {expensesList.map((exp) => (
              <div key={exp.id} style={rowStyle}>
                <div>
                  <strong>{exp.title}</strong>
                  <div style={{ fontSize: 12, color: THEME.muted }}>بواسطة: {exp.profiles?.full_name} | {new Date(exp.created_at).toLocaleString('ar-JO')}</div>
                </div>
                <strong style={{ color: THEME.gold }}>{exp.amount} د.أ</strong>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cash' && (isManager || permissions?.can_cash) && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>💰 تسليم مبلغ الكاش</h2>
            <form onSubmit={handleAddCash} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input type="number" step="0.01" placeholder="أدخل مبلغ الكاش فقط" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} style={inputStyle} required />
              <button type="submit" style={goldBtnStyle}>تسجيل الكاش</button>
            </form>
            {cashList.map((c) => (
              <div key={c.id} style={rowStyle}>
                <div>
                  <strong>{c.profiles?.full_name}</strong>
                  <div style={{ fontSize: 12, color: THEME.muted }}>{new Date(c.created_at).toLocaleString('ar-JO')}</div>
                </div>
                <strong style={{ color: THEME.gold, fontSize: 18 }}>{c.amount} د.أ</strong>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'salaries' && (isManager || permissions?.can_salary) && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>💵 {isManager ? 'إدارة الرواتب والسلف' : 'الراتب المستحق'}</h2>
            {!isManager ? (
              <div style={{ textAlign: 'center', padding: 30, background: '#111', borderRadius: 12, border: `1px solid ${THEME.gold}` }}>
                <p style={{ color: THEME.muted, marginBottom: 8 }}>صافي المبلغ المستحق لك حالياً</p>
                <div style={{ fontSize: 38, fontWeight: 'bold', color: THEME.gold }}>{calculateNetSalary(profile).net.toFixed(2)} د.أ</div>
              </div>
            ) : (
              employees.map((emp) => {
                const calc = calculateNetSalary(emp);
                return (
                  <div key={emp.id} style={{ borderBottom: `1px solid ${THEME.border}`, padding: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <strong style={{ fontSize: 18, color: THEME.gold }}>{emp.full_name}</strong>
                        <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4 }}>الاساسي: {calc.base} | الإضافي المعتمد: +{calc.approvedOvertime} | السلف: -{calc.advances} | الخصومات: -{calc.deductions}</div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#4CAF50' }}>المستحق: {calc.net.toFixed(2)} د.أ</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <button onClick={async () => {
                        const val = prompt('الراتب الأساسي الجديد:', emp.base_salary);
                        if (val !== null && !isNaN(Number(val))) {
                          await supabase.from('profiles').update({ base_salary: Number(val) }).eq('id', emp.id);
                          await logAudit('تعديل راتب أساسي', 'profiles', { emp: emp.full_name, val });
                          refreshAllData();
                        }
                      }} style={smallBtnStyle}>تعديل الأساسي</button>
                      <button onClick={async () => {
                        const val = prompt('سعر ساعة الإضافي للموظف:', emp.overtime_rate);
                        if (val !== null && !isNaN(Number(val))) {
                          await supabase.from('profiles').update({ overtime_rate: Number(val) }).eq('id', emp.id);
                          refreshAllData();
                        }
                      }} style={smallBtnStyle}>سعر الإضافي ({emp.overtime_rate})</button>
                      <button onClick={async () => {
                        const val = prompt('قيمة السلفة:');
                        if (val && !isNaN(Number(val))) {
                          await supabase.from('advances_deductions').insert({ user_id: emp.id, type: 'advance', amount: Number(val), month_year: new Date().toISOString().slice(0, 7) });
                          await logAudit('تسجيل سلفة', 'advances_deductions', { emp: emp.full_name, val });
                          refreshAllData();
                        }
                      }} style={smallBtnStyle}>+ تسجيل سلفة</button>
                      <button onClick={async () => {
                        const val = prompt('قيمة الخصم:');
                        if (val && !isNaN(Number(val))) {
                          await supabase.from('advances_deductions').insert({ user_id: emp.id, type: 'deduction', amount: Number(val), month_year: new Date().toISOString().slice(0, 7) });
                          await logAudit('تسجيل خصم', 'advances_deductions', { emp: emp.full_name, val });
                          refreshAllData();
                        }
                      }} style={{ ...smallBtnStyle, borderColor: THEME.danger, color: THEME.danger }}>+ تسجيل خصم</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'reports' && isManager && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={cardStyle}>
              <h2 style={{ color: THEME.gold, marginTop: 0 }}>📊 ملخص التقارير المالية</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ background: '#111', padding: 16, borderRadius: 10 }}>
                  <div style={{ color: THEME.muted, fontSize: 13 }}>إجمالي الكاش المسجل</div>
                  <div style={{ color: '#4CAF50', fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>{cashList.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)} د.أ</div>
                </div>
                <div style={{ background: '#111', padding: 16, borderRadius: 10 }}>
                  <div style={{ color: THEME.muted, fontSize: 13 }}>إجمالي مصاريف المحل</div>
                  <div style={{ color: THEME.danger, fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>{expensesList.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)} د.أ</div>
                </div>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: THEME.gold, marginTop: 0 }}>🛡️ سجل العمليات والمراقبة (Audit Log)</h3>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ fontSize: 13, borderBottom: `1px solid ${THEME.border}`, padding: '8px 0', color: THEME.muted }}>
                  <strong style={{ color: THEME.text }}>{log.profiles?.full_name || 'النظام'}</strong>: {log.action} — <span>{new Date(log.created_at).toLocaleString('ar-JO')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && isManager && (
          <div style={cardStyle}>
            <h2 style={{ color: THEME.gold, marginTop: 0 }}>⚙️ إعدادات النظام</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: THEME.muted }}>كود التفعيل لتسجيل الموظفين الجدد</label>
                <input type="text" value={settings.activation_code} onChange={(e) => setSettings({ ...settings, activation_code: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: THEME.muted }}>سعر ساعة الإضافي الافتراضي</label>
                <input type="number" value={settings.default_overtime_rate} onChange={(e) => setSettings({ ...settings, default_overtime_rate: Number(e.target.value) })} style={inputStyle} />
              </div>
              <button onClick={async () => {
