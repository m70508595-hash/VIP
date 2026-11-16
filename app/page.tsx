"use client";
import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dbjdtskrgueclkqinlck.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Hi8XqRgHHRzwU9-uHepk..."; // استخدم مفتاحك الكامل هنا
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function AlRayyanSystem() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignMode, setIsSignMode] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('جارٍ المعالجة...');
    
    if (isSignMode) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage('تم التسجيل بنجاح! يرجى التحقق من بريدك.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else setMessage('تم تسجيل الدخول بنجاح!');
    }
  };

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif', padding: '20px' }}>
      <div style={{ background: '#141414', padding: '30px', borderRadius: '8px', border: '1px solid #2a2518', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', color: '#d4af37', marginBottom: '20px' }}>
          {isSignMode ? 'إنشاء حساب جديد' : 'تسجيل دخول الإدارة'}
        </h2>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', color: '#8e8e93', marginBottom: '5px' }}>البريد الإلكتروني</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', background: '#262626', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8e8e93', marginBottom: '5px' }}>كلمة المرور</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', background: '#262626', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
            />
          </div>
          <button 
            type="submit" 
            style={{ padding: '12px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            {isSignMode ? 'تسجيل' : 'دخول'}
          </button>
        </form>
        {message && <p style={{ color: '#fff', textAlign: 'center', marginTop: '15px' }}>{message}</p>}
        <button 
          onClick={() => setIsSignMode(!isSignMode)} 
          style={{ background: 'none', border: 'none', color: '#d4af37', width: '100%', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isSignMode ? 'لديك حساب؟ تسجيل الدخول' : 'حساب جديد؟'}
        </button>
      </div>
    </div>
  );
}