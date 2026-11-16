(() => {
const cfg=window.AL_RAYYAN_CONFIG||{};
if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){
 document.body.innerHTML='<div style="direction:rtl;padding:30px;font-family:Tahoma"><h2>الإعداد ناقص</h2><p>أنشئ config.js وضع Project URL و anon/publishable key.</p></div>'; return;
}
const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let S={user:null,profile:null,perms:[]};
const $=x=>document.getElementById(x);
const money=x=>`${Number(x||0).toFixed(2)} د.أ`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=x=>new Date(x).toLocaleDateString('ar-JO');
const fmtTime=x=>new Date(x).toLocaleTimeString('ar-JO',{hour:'2-digit',minute:'2-digit'});

function screen(id){['splash','auth','appScreen'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
function manager(){return S.profile?.role==='manager'}
function can(p){return manager()||S.perms.includes(p)}
function msg(x){$('message').textContent=x||''}

$('goAuth').onclick=()=>screen('auth');
let signup=false;
function authMode(v){
 signup=v;
 $('loginTab').classList.toggle('active',!v); $('signupTab').classList.toggle('active',v);
 $('activationWrap').classList.toggle('hidden',!v);
 $('nameLabel').classList.toggle('hidden',!v); $('fullName').classList.toggle('hidden',!v);
 $('authButton').textContent=v?'إنشاء الحساب':'دخول'; msg('');
}
$('loginTab').onclick=()=>authMode(false); $('signupTab').onclick=()=>authMode(true);

$('authButton').onclick=async()=>{
 const email=$('email').value.trim(), pass=$('password').value, name=$('fullName').value.trim();
 if(!email||!pass)return msg('أدخل البريد وكلمة المرور.');
 try{
  msg('جارٍ التنفيذ...');
  if(signup){
   if(!$('activation').value.trim())return msg('أدخل كود التفعيل.');
   const {data:ok,error:ve}=await sb.rpc('validate_activation_code',{p_code:$('activation').value.trim()});
   if(ve)throw ve;if(ok!==true)return msg('كود التفعيل غير صحيح.');
   const {error}=await sb.auth.signUp({email,password:pass,options:{data:{full_name:name}}});
   if(error)throw error;
   msg('تم إنشاء الحساب. إذا ظهر طلب تأكيد البريد، أكّد البريد ثم سجل الدخول.');
  }else{
   const {error}=await sb.auth.signInWithPassword({email,password:pass});
   if(error)throw error; await boot();
  }
 }catch(e){console.error(e);msg(e.message||'حدث خطأ');}
};

$('logout').onclick=async()=>{await sb.auth.signOut();location.reload()};

async function boot(){
 const {data:{user}}=await sb.auth.getUser(); if(!user){screen('auth');return;}
 S.user=user;
 let q=await sb.from('profiles').select('*').eq('id',user.id).single();
 if(q.error)throw q.error; S.profile=q.data;
 const p=await sb.from('employee_permissions').select('permission_key').eq('user_id',user.id);
 S.perms=(p.data||[]).map(x=>x.permission_key);
 $('who').textContent=`${S.profile.full_name||user.email} — ${manager()?'مدير':'موظف'}`;
 screen('appScreen'); home();
}

function home(){
 const items=[
 ['employees','👥','الموظفين','manager'],
 ['attendance','🕐','الدوام والساعات الإضافية','attendance'],
 ['expenses','💸','مصاريف المحل','expenses'],
 ['cash','💰','مبلغ الكاش','cash'],
 ['salary','💵','الرواتب والسلف','salary'],
 ['reports','📊','التقارير','manager'],
 ['settings','⚙️','الإعدادات','manager']
 ].filter(x=>can(x[0]));
 $('content').innerHTML=`<h2>لوحة التحكم</h2><p class="muted">اختر القسم المطلوب</p><div class="grid">${items.map(x=>`<button class="menu" onclick="openSection('${x[0]}')"><div class="icon">${x[1]}</div><h3>${x[2]}</h3><div class="muted">فتح القسم</div></button>`).join('')}</div>`;
}
window.openSection=k=>({employees:employees,attendance:attendance,expenses:expenses,cash:cash,salary:salary,reports:reports,settings:settings}[k]||home)();

async function employees(){
 if(!manager())return home();
 const q=await sb.from('profiles').select('*').order('created_at',{ascending:false});
 if(q.error)return alert(q.error.message);
 $('content').innerHTML=`<div class="row between"><button class="btn" onclick="home()">← رجوع</button><h2>الموظفون</h2></div>
 <div class="tablebox"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th></tr></thead><tbody>
 ${(q.data||[]).map(r=>`<tr><td>${esc(r.full_name||'-')}</td><td>${esc(r.email||'-')}</td><td>${r.role}</td><td>${r.active?'نشط':'معطل'}</td></tr>`).join('')}
 </tbody></table></div>`;
}

async function attendance(){
 const q=await sb.from('attendance').select('*,profiles(full_name)').order('work_date',{ascending:false}).limit(100);
 if(q.error)return alert(q.error.message);
 $('content').innerHTML=`<div class="row between"><button class="btn" onclick="home()">← رجوع</button><div class="row"><button class="btn gold" onclick="clockIn()">بدء الدوام</button><button class="btn" onclick="clockOut()">إنهاء الدوام</button></div></div>
 <h2>الدوام والساعات الإضافية</h2><div class="tablebox"><table><thead><tr><th>الموظف</th><th>التاريخ</th><th>دخول</th><th>خروج</th><th>الساعات</th></tr></thead><tbody>
 ${(q.data||[]).map(r=>`<tr><td>${manager()?esc(r.profiles?.full_name||'-'):'أنا'}</td><td>${r.work_date}</td><td>${r.clock_in?fmtTime(r.clock_in):'-'}</td><td>${r.clock_out?fmtTime(r.clock_out):'-'}</td><td>${r.total_hours??'-'}</td></tr>`).join('')}</tbody></table></div>`;
}
window.clockIn=async()=>{
 const {error}=await sb.from('attendance').insert({user_id:S.user.id,work_date:today(),clock_in:new Date().toISOString()});
 if(error)alert(error.message);else attendance();
};
window.clockOut=async()=>{
 const q=await sb.from('attendance').select('id').eq('user_id',S.user.id).eq('work_date',today()).is('clock_out',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(q.error||!q.data)return alert('لا يوجد دوام مفتوح.');
 const u=await sb.from('attendance').update({clock_out:new Date().toISOString()}).eq('id',q.data.id);
 if(u.error)alert(u.error.message);else attendance();
};

async function expenses(){
 const q=await sb.from('expenses').select('*,profiles(full_name)').order('spent_at',{ascending:false}).limit(100);
 if(q.error)return alert(q.error.message);
 $('content').innerHTML=`<div class="row between"><button class="btn" onclick="home()">← رجوع</button><button class="btn gold" onclick="addExpense()">+ مصروف</button></div><h2>💸 مصاريف المحل</h2>
 <div class="tablebox"><table><thead><tr><th>اسم الفاتورة</th><th>المبلغ</th><th>الموظف</th><th>التاريخ</th><th>الوقت</th></tr></thead><tbody>
 ${(q.data||[]).map(r=>`<tr><td>${esc(r.invoice_name)}</td><td>${money(r.amount)}</td><td>${manager()?esc(r.profiles?.full_name||'-'):'أنا'}</td><td>${fmtDate(r.spent_at)}</td><td>${fmtTime(r.spent_at)}</td></tr>`).join('')}</tbody></table></div>`;
}
window.addExpense=async()=>{
 const n=prompt('اسم الفاتورة:');if(!n)return;
 const a=prompt('المبلغ:');if(a===null||isNaN(a)||Number(a)<0)return alert('المبلغ غير صحيح.');
 const q=await sb.from('expenses').insert({user_id:S.user.id,invoice_name:n,amount:Number(a)});
 if(q.error)alert(q.error.message);else expenses();
};

async function cash(){
 const q=await sb.from('cash_records').select('*,profiles(full_name)').order('recorded_at',{ascending:false}).limit(100);
 if(q.error)return alert(q.error.message);
 $('content').innerHTML=`<div class="row between"><button class="btn" onclick="home()">← رجوع</button><button class="btn gold" onclick="addCash()">+ مبلغ كاش</button></div><h2>💰 مبلغ الكاش</h2>
 <div class="tablebox"><table><thead><tr><th>المبلغ</th><th>الموظف</th><th>التاريخ</th><th>الوقت</th></tr></thead><tbody>
 ${(q.data||[]).map(r=>`<tr><td>${money(r.amount)}</td><td>${manager()?esc(r.profiles?.full_name||'-'):'أنا'}</td><td>${fmtDate(r.recorded_at)}</td><td>${fmtTime(r.recorded_at)}</td></tr>`).join('')}</tbody></table></div>`;
}
window.addCash=async()=>{
 const a=prompt('مبلغ الكاش:');if(a===null||isNaN(a)||Number(a)<0)return alert('المبلغ غير صحيح.');
 const q=await sb.from('cash_records').insert({user_id:S.user.id,amount:Number(a)});
 if(q.error)alert(q.error.message);else cash();
};

async function salary(){
 if(!manager()) {
  const q=await sb.rpc('get_my_salary_summary');
  if(q.error)return alert(q.error.message);
  const r=q.data?.[0]||{};
  $('content').innerHTML=`<button class="btn" onclick="home()">← رجوع</button><h2>💵 راتبي</h2><div class="statgrid"><div class="stat">المبلغ المستحق<b>${money(r.final_amount)}</b></div></div>`;
  return;
 }
 const q=await sb.rpc('salary_month_summary',{p_month:new Date().toISOString().slice(0,7)+'-01'});
 if(q.error)return alert(q.error.message);
 $('content').innerHTML=`<button class="btn" onclick="home()">← رجوع</button><h2>💵 الرواتب والسلف</h2><div class="tablebox"><table><thead><tr><th>الموظف</th><th>الأساسي</th><th>الإضافي</th><th>السلف</th><th>الخصومات</th><th>المستحق</th></tr></thead><tbody>${(q.data||[]).map(r=>`<tr><td>${esc(r.full_name)}</td><td>${money(r.base_salary)}</td><td>${money(r.overtime_amount)}</td><td>${money(r.advances)}</td><td>${money(r.deductions)}</td><td>${money(r.final_amount)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function reports(){
 if(!manager())return home();
 const q=await sb.rpc('manager_daily_summary',{p_date:today()});
 if(q.error)return alert(q.error.message);
 const r=q.data?.[0]||{};
 $('content').innerHTML=`<button class="btn" onclick="home()">← رجوع</button><h2>📊 تقرير اليوم</h2><div class="statgrid">
 <div class="stat">الكاش<b>${money(r.cash_total)}</b></div>
 <div class="stat">المصاريف<b>${money(r.expenses_total)}</b></div>
 <div class="stat">السلف<b>${money(r.advances_total)}</b></div>
 </div>`;
}

async function settings(){
 if(!manager())return home();
 $('content').innerHTML=`<button class="btn" onclick="home()">← رجوع</button><h2>⚙️ الإعدادات</h2><div class="card"><p>إعدادات النظام والصلاحيات يتم التحكم بها من المدير.</p><p class="muted">كود التفعيل يجب التحقق منه من قاعدة البيانات وليس من JavaScript.</p></div>`;
}

sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN')boot().catch(console.error)});
boot().catch(()=>screen('auth'));
})();
