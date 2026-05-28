import { useState } from 'react';
import Stars from '../components/Stars';
import { apiFetch } from '../utils/api';

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return setError('Vui lòng điền đầy đủ');
    setLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Lỗi không xác định');
      onLogin({ id: data.userId, username: data.username, stats: data.stats || {} });
    } catch { setError('Không thể kết nối server'); }
    finally { setLoading(false); }
  };

  const tabStyle = (active) => ({
    flex: 1, padding: '8px', textAlign: 'center',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid var(--b1)' : '1px solid transparent',
    background: active ? 'var(--card)' : 'transparent',
    color: active ? 'var(--tp)' : 'var(--tm)',
    transition: 'all .15s',
    fontFamily: 'var(--font-body)',
  });

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'var(--bg)', position:'relative' }}>
      <Stars />
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:340 }} className="animate-slide-up">

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:56, marginBottom:10 }} className="animate-wolf">🐺</div>
          <h1 style={{ fontFamily:"'Cinzel', serif", fontSize:32, fontWeight:700, color:'var(--tp)', letterSpacing:5, marginBottom:5 }}>MA SÓI</h1>
          <p style={{ fontFamily:"'Cinzel', serif", fontSize:11, color:'var(--tm)', letterSpacing:3 }}>WEREWOLF ONLINE</p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--b1)', borderRadius:14, padding:20 }}>

          {/* Mode tabs */}
          <div style={{ display:'flex', gap:4, background:'var(--bg)', borderRadius:10, padding:3, marginBottom:18 }}>
            <button onClick={() => { setMode('login'); setError(''); }} style={tabStyle(mode==='login')}>Đăng nhập</button>
            <button onClick={() => { setMode('register'); setError(''); }} style={tabStyle(mode==='register')}>Đăng ký</button>
          </div>

          {/* Fields */}
          <div style={{ marginBottom:12 }}>
            <p className="label" style={{ marginBottom:6 }}>TÊN NGƯỜI CHƠI</p>
            <input value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key==='Enter' && submit()}
              placeholder="Nhập tên của bạn..." maxLength={20}
              style={{ width:'100%', padding:'9px 14px' }} />
          </div>
          <div style={{ marginBottom:14 }}>
            <p className="label" style={{ marginBottom:6 }}>MẬT KHẨU</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key==='Enter' && submit()}
              placeholder="••••••••"
              style={{ width:'100%', padding:'9px 14px' }} />
          </div>

          {error && (
            <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8, fontSize:12,
              background:'rgba(220,38,38,.18)', color:'#fca5a5', border:'1px solid rgba(248,113,113,.35)' }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading} className="btn btn-primary"
            style={{ width:'100%', padding:'11px', fontSize:14, letterSpacing:'.5px' }}>
            {loading ? 'Đang kết nối...' : mode==='login' ? 'VÀO CHƠI' : 'TẠO TÀI KHOẢN'}
          </button>

          <p style={{ textAlign:'center', fontSize:11, color:'var(--tf)', marginTop:12 }}>
            Không cần email · Chơi co-op nhóm nhỏ
          </p>
        </div>
      </div>
    </div>
  );
}
