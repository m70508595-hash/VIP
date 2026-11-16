"use client";
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');
  const [stats, setStats] = useState<any>(null);
  const [message, setMessage] = useState('');

  const sb = createClientComponentClient();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }
    checkUser();
  }, [sb]);

  async function fetchProfile(uid: string) {
    const { data } = await sb.from('profiles').select('*').eq('id', uid).single();
    if (data) setProfile(data);
    setLoading(false);
  }

  const isManager = profile?.role === 'manager';

  const menuItems = [
    { id: 'attendance', label: 'الدوام والساعات الإضافية', icon: '🕐', role: 'employee' },
    { id: 'expenses', label: 'مصاريف المحل', icon: '💸', role: 'employee' },
    { id: 'cash', label: 'مبلغ الكاش', icon: '💰', role: 'employee' },
    { id: 'salary', label: 'الرواتب والسلف', icon: '💵', role: 'employee' },
    { id: 'reports', label: 'التقارير', icon: '📊', role: 'manager' },
  ].filter(item => isManager || item.role === 'employee');

  async function loadSection(sectionId: string) {
    setView(sectionId);
    setMessage('');
    if (sectionId === 'reports' && isManager) {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await sb.rpc('manager_daily_summary', { p_date: today });
      if (data) setStats(data[0]);
    }
  }

  if (loading) return <div style={{ background: '#070707', color: '#d4ad55', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري التحميل...</div>;

  if (!user) {
    return (
      <div style={{ background: '#070707', minHeight: '100v', color: '#fff', padding: '40px', textAlign: 'center', fontFamily: 'Tahoma' }}>
        <h1 style={{ fontSize: '40px', fontWeight: '900', color: '#d4ad55' }}>معجنات الريان</h1>
        <div style={{ width: '80px', height: '3px', background: '#d4ad55', margin: '20px auto' }}></div>
        <p style={{ color: '#aaa' }}>نظام الإدارة - يرجى تسجيل الدخول</p>
        <div style={{ maxWidth: '400px', margin: '40px auto', background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
          <input id="email" type="email" placeholder="البريد الإلكتروني" style={{ width: '100%', padding: '10px', background: '#080808', border: '1px solid #444', color: '#fff', borderRadius: '5px', marginBottom: '10px' }} />
          <input id="pass" type="password" placeholder="كلمة المرور" style={{ width: '100%', padding: '10px', background: '#080808', border: '1px solid #444', color: '#fff', borderRadius: '5px', marginBottom: '20px' }} />
          <button onClick={async () => {
            const email = (document.getElementById('email') as HTMLInputElement).value;
            const pass = (document.getElementById('pass') as HTMLInputElement).value;
            const { error } = await sb.auth.signInWithPassword({ email, password: pass });
            if (error) setMessage(error.message);
            else window.location.reload();
          }} style={{ width: '100%', padding: '12px', background: '#d4ad55', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '5px', cursor: 'pointer' }}>دخول</button>
          {message && <p style={{ color: '#ff4444', marginTop: '15px' }}>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#070707', minHeight: '100vh', color: '#f7f7f7', fontFamily: 'Tahoma', paddingBottom: '50px' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #282828', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#d4ad55' }}>معجنات الريان</h2>
          <small style={{ color: '#888' }}>{profile?.full_name} ({isManager ? 'مدير' : 'موظف'})</small>
        </div>
        <button onClick={() => sb.auth.signOut().then(() => window.location.reload())} style={{ background: '#222', border: '1px solid #444', color: '#aaa', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>تسجيل الخروج</button>
      </header>

      <main style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
        {view === 'home' && (
          <div>
            <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>لوحة التحكم الرئيسية</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {menuItems.map(item => (
                <button key={item.id} onClick={() => loadSection(item.id)} style={{ background: '#111', border: '1px solid #292929', borderRadius: '15px', padding: '25px', color: '#fff', textAlign: 'center', cursor: 'pointer', transition: 'border 0.3s' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>{item.icon}</div>
                  <h3 style={{ margin: '0 0 10px 0' }}>{item.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {view !== 'home' && (
          <button onClick={() => setView('home')} style={{ background: 'transparent', border: '1px solid #444', color: '#d4ad55', padding: '8px 15px', borderRadius: '5px', marginBottom: '20px', cursor: 'pointer' }}>← العودة للرئيسية</button>
        )}

        {view === 'attendance' && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #292929' }}>
            <h2>الدوام والساعات الإضافية</h2>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={async () => {
                await sb.from('attendance').insert({ user_id: user.id, work_date: new Date().toISOString().slice(0, 10), clock_in: new Date().toISOString() });
                alert('تم تسجيل الحضور');
              }} style={{ background: '#2e7d32', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>تسجيل الحضور</button>
              <button onClick={async () => {
                const { data } = await sb.from('attendance').select('id').eq('user_id', user.id).eq('work_date', new Date().toISOString().slice(0, 10)).is('clock_out', null).single();
                if (data) {
                  await sb.from('attendance').update({ clock_out: new Date().toISOString() }).eq('id', data.id);
                  alert('تم تسجيل الانصراف');
                } else {
                  alert('لا يوجد سجل حضور مفتوح اليوم');
                }
              }} style={{ background: '#c62828', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>تسجيل الانصراف</button>
            </div>
          </div>
        )}

        {view === 'expenses' && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #292929' }}>
            <h2>مصاريف المحل</h2>
            <input id="inv_name" type="text" placeholder="اسم الفاتورة" style={{ width: '100%', padding: '10px', background: '#080808', border: '1px solid #444', color: '#fff', borderRadius: '5px', marginBottom: '10px' }} />
            <input id="inv_amount" type="number" placeholder="المبلغ" style={{ width: '100%', padding: '10px', background: '#080808', border: '1px solid #444', color: '#fff', borderRadius: '5px', marginBottom: '20px' }} />
            <button onClick={async () => {
              const name = (document.getElementById('inv_name') as HTMLInputElement).value;
              const amount = (document.getElementById('inv_amount') as HTMLInputElement).value;
              if (name && amount) {
                await sb.from('expenses').insert({ user_id: user.id, invoice_name: name, amount: parseFloat(amount) });
                alert('تمت إضافة المصروف');
              }
            }} style={{ background: '#d4ad55', color: '#000', border: 'none', padding: '10px', width: '100%', fontWeight: 'bold', borderRadius: '5px', cursor: 'pointer' }}>حفظ المصروف</button>
          </div>
        )}

        {view === 'cash' && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #292929' }}>
            <h2>تسجيل مبلغ الكاش</h2>
            <input id="cash_amount" type="number" placeholder="المبلغ الحالي" style={{ width: '100%', padding: '10px', background: '#080808', border: '1px solid #444', color: '#fff', borderRadius: '5px', marginBottom: '20px' }} />
            <button onClick={async () => {
              const amount = (document.getElementById('cash_amount') as HTMLInputElement).value;
              if (amount) {
                await sb.from('cash_records').insert({ user_id: user.id, amount: parseFloat(amount) });
                alert('تم حفظ المبلغ');
              }
            }} style={{ background: '#d4ad55', color: '#000', border: 'none', padding: '10px', width: '100%', fontWeight: 'bold', borderRadius: '5px', cursor: 'pointer' }}>حفظ الكاش</button>
          </div>
        )}

        {view === 'salary' && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #292929' }}>
            <h2>الرواتب والسلف</h2>
            <p>مرحباً بك، يمكنك متابعة مستحقاتك المالية من خلال الإدارة المباشرة.</p>
          </div>
        )}

        {view === 'reports' && isManager && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #292929' }}>
            <h2>التقارير اليومية</h2>
            {stats ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
                <div style={{ background: '#080808', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
                  <h4>إجمالي الكاش</h4>
                  <p style={{ fontSize: '24px', color: '#d4ad55' }}>{stats.cash_total || 0}</p>
                </div>
                <div style={{ background: '#080808', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
                  <h4>إجمالي المصاريف</h4>
                  <p style={{ fontSize: '24px', color: '#ff4444' }}>{stats.expenses_total || 0}</p>
                </div>
                <div style={{ background: '#080808', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
                  <h4>إجمالي السلف</h4>
                  <p style={{ fontSize: '24px', color: '#ffa726' }}>{stats.advances_total || 0}</p>
                </div>
              </div>
            ) : <p>جاري تحميل البيانات...</p>}
          </div>
        )}
      </main>
    </div>
  );
}