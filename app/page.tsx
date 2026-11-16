"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dbjdtskrgueclkqinlck.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Mi8XqXRgMNRzwU9-uMepkg_RI0E7Aer";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const [att, ovt, exp, csh, adv, setRes] = await Promise.all([
      supabase.from('attendance').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('overtime').select('*, profiles(full_name, overtime_rate)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('cash_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('advances_deductions').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value').eq('key', 'activation_code').single(),
    ]);

    setAttendanceList(att.data || []);
    setOvertimeList(ovt.data || []);
    setExpensesList(exp.data || []);
    setCashList(csh.data || []);
    setAdvancesList(adv.data || []);
    if (setRes.data) {
      setSettings(prev => ({ ...prev, [setRes.data.key]: setRes.data.value }));
    }

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
      const { data: sys, error: sysErr } = await supabase.from('app_settings').select('value').eq('key', 'activation_code').single();
      if (sysErr || !sys || activationCode !== sys.value) {
        setAuthMsg('❌ كود التفعيل غير صحيح.');
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
        setAuthMsg('ور غير صحيحة.');
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
    notify('✅ تم تسجيل المصروف تلقائياً');
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
    notify('✅ تم حفظ مبلغ الكاش');
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
        <h1 style={{ fontSize: 32 }}>معجنات الريان</h1>
      </div>
    );
  }

  if (loading) {
    return <div dir="rtl" style={{ background: THEME.bg, color: THEME.gold, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري التحميل...</div>;
  }

  if (!session || !profile) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 420 }}>
          <h2>معجنات الريان</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {authMode === 'register' && (
              <>
                <input type="text" placeholder="الاسم الكامل" required value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="كود التفعيل" required value={activationCode} onChange={(e) => setActivationCode(e.target.value)} style={inputStyle} />
              </>
            )}
            <input type="email" placeholder="البريد الإلكتروني" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="كلمة المرور" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            {authMsg && <p style={{ color: THEME.danger }}>{authMsg}</p>}
            <button type="submit" style={goldBtnStyle}>{authMode === 'login' ? 'دخول' : 'تسجيل'}</button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', color: THEME.gold, marginTop: 15, cursor: 'pointer' }}>
            {authMode === 'login' ? 'حساب جديد؟' : 'لديك حساب؟'}
          </button>
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
      {/* الشريط العلوي */}
      <header style={{ background: THEME.card, borderBottom: `1px solid ${THEME.border}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ color: THEME.gold, fontSize: 20, margin: 0 }}>معجنات الريان</h1>
          <span style={{ fontSize: 12, color: THEME.muted }}>مرحباً، {profile.full_name} ({isManager ? 'مدير' : 'موظف'})</span>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: `1px solid ${THEME.danger}`, color: THEME.danger, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>تسجيل الخروج</button>
      </header>

      {toast && <div style={{ background: THEME.gold, color: '#000', textAlign: 'center', padding: 10, fontWeight: 'bold' }}>{toast}</div>}

      <main style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
        {activeTab !== 'home' && (
          <button onClick={() => setActiveTab('home')} style={{ background: THEME.card, color: THEME.gold, border: `1px solid ${THEME.border}`, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: 20 }}>← العودة للرئيسية</button>
        )}

        {activeTab === 'home' && (
          <div>
            <h2 style={{ color: THEME.gold, marginBottom: 20 }}>لوحة التحكم</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              {navItems.filter((i) => i.id !== 'home').map((item) => (
                <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 24, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 34, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ color: THEME.gold, fontWeight: 'bold' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'employees' && isManager && (
          <div style={cardStyle}>
            <h2>👥 إدارة الموظفين</h2>
            {employees.map((emp) => (
              <div key={emp.id} style={{ borderBottom: `1px solid ${THEME.border}`, padding: '16px 0' }}>
                <strong>{emp.full_name}</strong>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div style={cardStyle}>
            <h2>🕐 سجل الدوام</h2>
            {!isManager && <button onClick={handleCheckIn} style={goldBtnStyle}>بدء الدوام</button>}
          </div>
        )}

        {activeTab === 'expenses' && (
          <div style={cardStyle}>
            <h2>💸 المصاريف</h2>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input type="text" placeholder="اسم المصروف" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} style={inputStyle} required />
              <input type="number" step="0.01" placeholder="المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={inputStyle} required />
              <button type="submit" style={goldBtnStyle}>حفظ</button>
            </form>
          </div>
        )}

        {activeTab === 'cash' && (
          <div style={cardStyle}>
            <h2>💰 تسليم الكاش</h2>
            <form onSubmit={handleAddCash} style={{ display: 'flex', gap: 10 }}>
              <input type="number" step="0.01" placeholder="المبلغ" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} style={inputStyle} required />
              <button type="submit" style={goldBtnStyle}>حفظ</button>
            </form>
          </div>
        )}

        {activeTab === 'salaries' && (
          <div style={cardStyle}>
            <h2>💵 الرواتب</h2>
            {!isManager && <div>صافي المستحق: {calculateNetSalary(profile).net.toFixed(2)} د.أ</div>}
          </div>
        )}
      </main>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 24 };
const inputStyle: React.CSSProperties = { background: '#0A0A0A', border: `1px solid ${THEME.border}`, color: '#FFF', padding: 12, borderRadius: 10, width: '100%', boxSizing: 'border-box' };
const goldBtnStyle: React.CSSProperties = { background: THEME.gold, color: '#000', border: 'none', padding: 12, borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' };