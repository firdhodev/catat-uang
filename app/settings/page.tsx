'use client';
import { useEffect, useState, useCallback } from 'react';

interface Platform { id: string; name: string; type: string; email_sender?: string; email_keywords?: string[]; is_active: boolean; notes?: string; }
interface Setting { key: string; value: string; label: string; }

const PLATFORM_EXAMPLES = {
  bank: { name: 'Contoh: BCA, Mandiri', email_sender: 'Contoh: notifikasi@bca.co.id', keywords: 'Contoh: Debit, Kredit' },
  ewallet: { name: 'Contoh: GoPay, OVO', email_sender: 'Contoh: noreply@gojek.com', keywords: 'Contoh: bayar, transfer' },
  crypto: { name: 'Contoh: Indodax', email_sender: 'Contoh: noreply@indodax.com', keywords: 'Contoh: beli, jual' },
  paylater: { name: 'Contoh: Akulaku', email_sender: 'Contoh: notification@akulaku.com', keywords: 'Contoh: cicilan' },
  other: { name: 'Contoh: Platform custom', email_sender: 'Contoh: noreply@platform.com', keywords: 'Contoh: transaksi' },
};

const AI_PRESETS = [
  { label: '⚡ Gemini Flash (Free)', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: 'google/gemini-2.0-flash-001', desc: 'OpenRouter · Gratis & cepat ✨' },
  { label: '🦙 Llama 3.1 (Free)', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: 'meta-llama/llama-3.1-8b-instruct:free', desc: 'OpenRouter · Gratis' },
  { label: '💎 GPT-4o Mini', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', desc: 'OpenAI API · Berbayar' },
  { label: '🏠 Ollama (Local)', baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama', model: 'llama3.2:3b', desc: 'Development lokal saja' },
];

const DEFAULT_EXPENSE = ['Makanan & Minuman','Transport','Belanja','Tagihan & Utilitas','Kesehatan','Hiburan','Pendidikan','Investasi','Transfer Keluar','Lainnya'];
const DEFAULT_INCOME = ['Gaji','Freelance','Transfer Masuk','Cashback & Reward','Pemasukan Lainnya'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'ai'|'platforms'|'categories'>('ai');
  const [settings, setSettings] = useState<Record<string,string>>({});
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<string|null>(null);
  const [showPlatformForm, setShowPlatformForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform|null>(null);
  const [platForm, setPlatForm] = useState({name:'',type:'bank',email_sender:'',keywords_raw:'',notes:'',is_active:true});

  // Categories state
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(DEFAULT_INCOME);
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [savingCats, setSavingCats] = useState(false);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, pr, cr] = await Promise.all([
        fetch('/api/settings').then(r=>r.json()),
        fetch('/api/platforms').then(r=>r.json()),
        fetch('/api/categories').then(r=>r.json()),
      ]);
      const sm:Record<string,string>={};
      (sr.data as Setting[]||[]).forEach(s=>{sm[s.key]=s.value;});
      setSettings(sm);
      setPlatforms(pr.data||[]);
      if(cr.expense) setExpenseCategories(cr.expense);
      if(cr.income) setIncomeCategories(cr.income);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const handleSaveAI = async () => {
    setSavingAI(true);
    try {
      await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([
        {key:'ai_base_url',value:settings.ai_base_url||''},
        {key:'ai_api_key',value:settings.ai_api_key||''},
        {key:'ai_model',value:settings.ai_model||''},
      ])});
      showToast('✅ Pengaturan AI disimpan!');
    } catch { showToast('❌ Gagal menyimpan','error'); }
    finally { setSavingAI(false); }
  };

  const handleTestAI = async () => {
    setTestingAI(true); setTestResult(null);
    try {
      const res = await fetch(`${settings.ai_base_url}/models`,{headers:{'Authorization':`Bearer ${settings.ai_api_key}`},signal:AbortSignal.timeout(5000)});
      if(res.ok){const d=await res.json();const m=d.data?.slice(0,3).map((x:{id:string})=>x.id).join(', ')||'OK';setTestResult(`✅ Koneksi berhasil! Models: ${m}`);}
      else setTestResult(`⚠️ Response ${res.status}: ${res.statusText}`);
    } catch(e){setTestResult(`❌ Gagal: ${(e as Error).message}`);}
    finally{setTestingAI(false);}
  };

  const applyPreset=(p:typeof AI_PRESETS[0])=>{setSettings(s=>({...s,ai_base_url:p.baseUrl,ai_api_key:p.apiKey||s.ai_api_key,ai_model:p.model}));setTestResult(null);};

  const openPlatformForm=(p?:Platform)=>{
    if(p){setEditingPlatform(p);setPlatForm({name:p.name,type:p.type,email_sender:p.email_sender||'',keywords_raw:(p.email_keywords||[]).join(', '),notes:p.notes||'',is_active:p.is_active});}
    else{setEditingPlatform(null);setPlatForm({name:'',type:'bank',email_sender:'',keywords_raw:'',notes:'',is_active:true});}
    setShowPlatformForm(true);
  };

  const savePlatform=async()=>{
    if(!platForm.name.trim()){showToast('❌ Nama platform wajib diisi','error');return;}
    try{
      const payload={name:platForm.name,type:platForm.type,email_sender:platForm.email_sender||null,email_keywords:platForm.keywords_raw.split(',').map(k=>k.trim()).filter(Boolean),notes:platForm.notes,is_active:platForm.is_active};
      if(editingPlatform) await fetch(`/api/platforms/${editingPlatform.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      else await fetch('/api/platforms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      showToast('✅ Platform disimpan');setShowPlatformForm(false);fetchAll();
    }catch{showToast('❌ Gagal menyimpan','error');}
  };

  const deletePlatform=async(id:string)=>{
    if(!confirm('Hapus platform ini?'))return;
    try{await fetch(`/api/platforms/${id}`,{method:'DELETE'});showToast('🗑️ Platform dihapus');fetchAll();}
    catch{showToast('❌ Gagal menghapus','error');}
  };

  const saveCategories=async()=>{
    setSavingCats(true);
    try{
      await fetch('/api/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expense:expenseCategories,income:incomeCategories})});
      showToast('✅ Kategori disimpan! AI akan menggunakan kategori ini.');
    }catch{showToast('❌ Gagal menyimpan','error');}
    finally{setSavingCats(false);}
  };

  const addCat=(type:'expense'|'income')=>{
    if(type==='expense'){const v=newExpenseCat.trim();if(!v)return;if(!expenseCategories.includes(v))setExpenseCategories(p=>[...p,v]);setNewExpenseCat('');}
    else{const v=newIncomeCat.trim();if(!v)return;if(!incomeCategories.includes(v))setIncomeCategories(p=>[...p,v]);setNewIncomeCat('');}
  };

  const removeCat=(type:'expense'|'income',cat:string)=>{
    if(type==='expense')setExpenseCategories(p=>p.filter(c=>c!==cat));
    else setIncomeCategories(p=>p.filter(c=>c!==cat));
  };

  const moveCat=(type:'expense'|'income',idx:number,dir:-1|1)=>{
    const arr=type==='expense'?[...expenseCategories]:[...incomeCategories];
    const ni=idx+dir;if(ni<0||ni>=arr.length)return;
    [arr[idx],arr[ni]]=[arr[ni],arr[idx]];
    if(type==='expense')setExpenseCategories(arr);else setIncomeCategories(arr);
  };

  const resetCats=(type:'expense'|'income')=>{
    if(type==='expense')setExpenseCategories([...DEFAULT_EXPENSE]);
    else setIncomeCategories([...DEFAULT_INCOME]);
  };

  const example=PLATFORM_EXAMPLES[platForm.type as keyof typeof PLATFORM_EXAMPLES]||PLATFORM_EXAMPLES.other;

  return (
    <div className="page-container">
      {toast&&<div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}

      {showPlatformForm&&(
        <div className="modal-overlay" onClick={()=>setShowPlatformForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingPlatform?'✏️ Edit Platform':'➕ Tambah Platform'}</div>
              <button className="modal-close" onClick={()=>setShowPlatformForm(false)}>×</button>
            </div>
            <div className="form-group"><label className="form-label">Tipe</label>
              <select className="form-select" value={platForm.type} onChange={e=>setPlatForm({...platForm,type:e.target.value})}>
                <option value="bank">🏦 Bank</option><option value="ewallet">📱 E-Wallet</option>
                <option value="crypto">₿ Crypto</option><option value="paylater">💳 Pay Later</option><option value="other">📦 Lainnya</option>
              </select></div>
            <div className="form-group"><label className="form-label">Nama Platform *</label>
              <input className="form-input" type="text" value={platForm.name} onChange={e=>setPlatForm({...platForm,name:e.target.value})} placeholder={example.name}/></div>
            <div className="form-group"><label className="form-label">Email Sender</label>
              <input className="form-input" type="text" value={platForm.email_sender} onChange={e=>setPlatForm({...platForm,email_sender:e.target.value})} placeholder={example.email_sender}/>
              <div className="form-hint">Alamat email pengirim notifikasi</div></div>
            <div className="form-group"><label className="form-label">Keywords (pisahkan koma)</label>
              <input className="form-input" type="text" value={platForm.keywords_raw} onChange={e=>setPlatForm({...platForm,keywords_raw:e.target.value})} placeholder={example.keywords}/>
              <div className="form-hint">Kata kunci yang harus ada di email transaksi</div></div>
            <div className="form-group"><label className="form-label">Catatan</label>
              <input className="form-input" type="text" value={platForm.notes} onChange={e=>setPlatForm({...platForm,notes:e.target.value})} placeholder="Deskripsi singkat"/></div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
              <input type="checkbox" id="platform-active" checked={platForm.is_active} onChange={e=>setPlatForm({...platForm,is_active:e.target.checked})} style={{accentColor:'#0D0D0D',width:16,height:16}}/>
              <label htmlFor="platform-active" style={{fontSize:14,cursor:'pointer',fontWeight:700}}>Platform aktif</label></div>
            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={()=>setShowPlatformForm(false)}>Batal</button>
              <button className="btn btn-primary" onClick={savePlatform}>💾 Simpan</button></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">⚙️ Pengaturan</h1>
        <p className="page-subtitle">Konfigurasi AI, platform keuangan, dan kategori transaksi</p>
      </div>

      <div className="tabs">
        <div className={`tab ${activeTab==='ai'?'active':''}`} onClick={()=>setActiveTab('ai')}>🤖 Konfigurasi AI</div>
        <div className={`tab ${activeTab==='platforms'?'active':''}`} onClick={()=>setActiveTab('platforms')}>🏦 Platform</div>
        <div className={`tab ${activeTab==='categories'?'active':''}`} onClick={()=>setActiveTab('categories')}>🏷️ Kategori</div>
      </div>

      {loading?<div className="loading"><div className="spinner"/>Memuat...</div>:(
        <>
          {/* AI TAB */}
          {activeTab==='ai'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:24,alignItems:'start'}}>
              <div className="card">
                <div style={{fontWeight:800,fontSize:15,marginBottom:20,textTransform:'uppercase'}}>🤖 Konfigurasi AI API</div>
                <div className="alert alert-success" style={{marginBottom:20,fontSize:13}}>
                  🎉 <strong>Simpan di sini = langsung aktif!</strong> Tidak perlu set environment variable di Vercel. Pengaturan ini tersimpan di Supabase dan otomatis digunakan oleh semua fitur AI.
                </div>
                <div className="form-group"><label className="form-label">AI Base URL</label>
                  <input className="form-input" type="text" value={settings.ai_base_url||''} onChange={e=>setSettings(s=>({...s,ai_base_url:e.target.value}))} placeholder="https://openrouter.ai/api/v1" id="input-ai-url"/>
                  <div className="form-hint">OpenRouter: <code>https://openrouter.ai/api/v1</code> | Ollama lokal: <code>http://localhost:11434/v1</code></div></div>
                <div className="form-group"><label className="form-label">API Key</label>
                  <input className="form-input" type="password" value={settings.ai_api_key||''} onChange={e=>setSettings(s=>({...s,ai_api_key:e.target.value}))} placeholder="sk-or-xxxxxxxxxxxxxxxx" id="input-ai-key"/>
                  <div className="form-hint">Dapatkan API key gratis di <strong>openrouter.ai/keys</strong> (tidak perlu kartu kredit untuk model gratis)</div></div>
                <div className="form-group"><label className="form-label">Model</label>
                  <input className="form-input" type="text" value={settings.ai_model||''} onChange={e=>setSettings(s=>({...s,ai_model:e.target.value}))} placeholder="google/gemini-2.0-flash-001" id="input-ai-model"/>
                  <div className="form-hint">Klik preset di kanan untuk otomatis mengisi model yang tersedia</div></div>
                {testResult&&<div className={`alert ${testResult.startsWith('✅')?'alert-success':'alert-warning'}`} style={{marginBottom:16}}>{testResult}</div>}
                <div style={{display:'flex',gap:12}}>
                  <button className="btn btn-secondary" onClick={handleTestAI} disabled={testingAI} id="btn-test-ai">
                    {testingAI?<><span className="spinner" style={{width:14,height:14}}/>Testing...</>:'🔌 Test Koneksi'}</button>
                  <button className="btn btn-primary" onClick={handleSaveAI} disabled={savingAI} id="btn-save-ai">
                    {savingAI?'Menyimpan...':'💾 Simpan'}</button></div>
              </div>
              <div>
                <div className="card">
                  <div style={{fontWeight:800,fontSize:14,marginBottom:16,textTransform:'uppercase'}}>⚡ Preset Cepat</div>
                  {AI_PRESETS.map(p=>(
                    <div key={p.label} style={{padding:14,borderRadius:4,border:'2px solid #0D0D0D',marginBottom:8,cursor:'pointer',background:'#FAFAFA',boxShadow:'2px 2px 0px #0D0D0D',transition:'all 0.15s'}}
                      onClick={()=>applyPreset(p)}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.cssText+='transform:translate(-2px,-2px);box-shadow:4px 4px 0px #0D0D0D;background:#FFFBDB;'}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.cssText+='transform:;box-shadow:2px 2px 0px #0D0D0D;background:#FAFAFA;'}}>
                      <div style={{fontWeight:800,fontSize:13}}>{p.label}</div>
                      <div style={{fontSize:12,color:'#666',marginTop:2,fontWeight:600}}>{p.desc}</div>
                      <div style={{fontSize:11,color:'#0066FF',marginTop:4,fontFamily:'monospace',fontWeight:700}}>{p.model}</div>
                    </div>))}
                </div>
                <div className="alert alert-warning" style={{marginTop:16,fontSize:12}}>
                  <div><strong>🔑 Cara dapat API Key OpenRouter:</strong><br/>1. Daftar di <strong>openrouter.ai</strong><br/>2. Buka menu <strong>Keys</strong><br/>3. Klik <strong>Create Key</strong><br/>4. Copy dan paste di kolom API Key di atas<br/><br/>Model dengan tanda <em>":free"</em> atau tanpa quota = <strong>GRATIS</strong></div></div>
              </div>
            </div>
          )}

          {/* PLATFORMS TAB */}
          {activeTab==='platforms'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div style={{fontSize:14,color:'#666',fontWeight:700}}>{platforms.length} platform terdaftar</div>
                <button className="btn btn-primary" onClick={()=>openPlatformForm()} id="btn-add-platform">➕ Tambah Platform</button></div>
              <div className="alert alert-info" style={{marginBottom:20}}>
                💡 <strong>Catatan:</strong> Platform ini digunakan Google Apps Script untuk memfilter email transaksi.</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:16}}>
                {platforms.map(p=>(
                  <div key={p.id} className="card" style={{opacity:p.is_active?1:0.6,position:'relative'}}>
                    {!p.is_active&&<div style={{position:'absolute',top:12,right:12,background:'#FF3B3B',color:'white',fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:2,textTransform:'uppercase'}}>NONAKTIF</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                      <div><div style={{fontWeight:800,fontSize:16}}>{p.name}</div>
                        <div style={{fontSize:12,color:'#666',marginTop:2,fontWeight:700}}>
                          {p.type==='bank'?'🏦 Bank':p.type==='ewallet'?'📱 E-Wallet':p.type==='crypto'?'₿ Crypto':p.type==='paylater'?'💳 Pay Later':'📦 Lainnya'}</div></div>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn-icon btn-sm" onClick={()=>openPlatformForm(p)}>✏️</button>
                        <button className="btn-icon btn-sm" onClick={()=>deletePlatform(p.id)} style={{color:'#FF3B3B'}}>🗑️</button></div></div>
                    {p.email_sender&&<div style={{marginBottom:10}}><div style={{fontSize:9,color:'#999',fontWeight:800,textTransform:'uppercase',letterSpacing:'1px',marginBottom:3}}>EMAIL SENDER</div>
                      <code style={{fontSize:12,color:'#0066FF',fontWeight:700}}>{p.email_sender}</code></div>}
                    {p.email_keywords&&p.email_keywords.length>0&&<div>
                      <div style={{fontSize:9,color:'#999',fontWeight:800,textTransform:'uppercase',letterSpacing:'1px',marginBottom:6}}>KEYWORDS</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {p.email_keywords.map(k=><span key={k} style={{background:'#FFFBDB',color:'#AA8800',fontSize:11,padding:'2px 8px',borderRadius:2,fontWeight:800,border:'1.5px solid #AA8800'}}>{k}</span>)}</div></div>}
                    {p.notes&&<div style={{marginTop:10,fontSize:12,color:'#666',fontWeight:600,fontStyle:'italic'}}>{p.notes}</div>}
                  </div>))}
              </div>
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab==='categories'&&(
            <div>
              <div className="alert alert-info" style={{marginBottom:24}}>
                🤖 <strong>AI-Aware:</strong> Kategori yang kamu buat di sini akan digunakan oleh AI saat memproses email dan input manual. AI akan memilih dari daftar ini secara otomatis sesuai konteks transaksi.
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                {/* EXPENSE CATEGORIES */}
                <div className="card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:12,borderBottom:'2px solid #0D0D0D'}}>
                    <div style={{fontWeight:800,fontSize:15,textTransform:'uppercase',color:'#FF3B3B'}}>💸 Pengeluaran</div>
                    <button className="btn btn-secondary btn-sm" onClick={()=>resetCats('expense')}>↺ Reset</button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                    {expenseCategories.map((cat,i)=>(
                      <div key={cat} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#FFF0F0',border:'2px solid #0D0D0D',borderRadius:4,boxShadow:'2px 2px 0px #0D0D0D'}}>
                        <span style={{fontSize:13,fontWeight:700,flex:1}}>{cat}</span>
                        <button onClick={()=>moveCat('expense',i,-1)} disabled={i===0} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'0 4px',opacity:i===0?0.3:1}}>↑</button>
                        <button onClick={()=>moveCat('expense',i,1)} disabled={i===expenseCategories.length-1} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'0 4px',opacity:i===expenseCategories.length-1?0.3:1}}>↓</button>
                        <button onClick={()=>removeCat('expense',cat)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#FF3B3B',padding:'0 4px',fontWeight:800}}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <input className="form-input" type="text" value={newExpenseCat} onChange={e=>setNewExpenseCat(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addCat('expense')} placeholder="Nama kategori baru..." style={{flex:1}}/>
                    <button className="btn btn-danger" onClick={()=>addCat('expense')}>+ Tambah</button>
                  </div>
                </div>

                {/* INCOME CATEGORIES */}
                <div className="card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:12,borderBottom:'2px solid #0D0D0D'}}>
                    <div style={{fontWeight:800,fontSize:15,textTransform:'uppercase',color:'#007A33'}}>💰 Pemasukan</div>
                    <button className="btn btn-secondary btn-sm" onClick={()=>resetCats('income')}>↺ Reset</button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                    {incomeCategories.map((cat,i)=>(
                      <div key={cat} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#E6FFF0',border:'2px solid #0D0D0D',borderRadius:4,boxShadow:'2px 2px 0px #0D0D0D'}}>
                        <span style={{fontSize:13,fontWeight:700,flex:1}}>{cat}</span>
                        <button onClick={()=>moveCat('income',i,-1)} disabled={i===0} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'0 4px',opacity:i===0?0.3:1}}>↑</button>
                        <button onClick={()=>moveCat('income',i,1)} disabled={i===incomeCategories.length-1} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'0 4px',opacity:i===incomeCategories.length-1?0.3:1}}>↓</button>
                        <button onClick={()=>removeCat('income',cat)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#FF3B3B',padding:'0 4px',fontWeight:800}}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <input className="form-input" type="text" value={newIncomeCat} onChange={e=>setNewIncomeCat(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addCat('income')} placeholder="Nama kategori baru..." style={{flex:1}}/>
                    <button className="btn btn-success" onClick={()=>addCat('income')}>+ Tambah</button>
                  </div>
                </div>
              </div>

              <div style={{marginTop:24,display:'flex',justifyContent:'flex-end',gap:12}}>
                <button className="btn btn-secondary" onClick={fetchAll}>↺ Batalkan Perubahan</button>
                <button className="btn btn-primary btn-lg" onClick={saveCategories} disabled={savingCats} id="btn-save-categories">
                  {savingCats?<><span className="spinner" style={{width:16,height:16}}/>Menyimpan...</>:'💾 Simpan Semua Kategori'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
