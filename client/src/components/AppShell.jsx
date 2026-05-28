import { useState } from 'react';
import Stars from './Stars';
import SoundControl from './SoundControl';
import Avatar from './Avatar';

const NAV = [
  { id:'lobby',   icon:'🏠', label:'Sảnh chờ' },
  { id:'guide',   icon:'📖', label:'Hướng dẫn' },
  { id:'history', icon:'📊', label:'Lịch sử & Stats' },
];

// #1: nhận connected prop từ App.jsx
export default function AppShell({ user, page, onNavigate, onLogout, children, connected = true }) {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', position:'relative' }}>
      <Stars count={50} />

      {/* #1: Banner mất kết nối */}
      {!connected && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:100,
          background:'rgba(220,38,38,.95)', color:'#fff',
          textAlign:'center', padding:'8px 16px', fontSize:13, fontWeight:600,
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <span style={{ animation:'bl 0.8s ease-in-out infinite', display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#fff' }} />
          Mất kết nối — đang thử kết nối lại...
        </div>
      )}

      {/* Topbar */}
      <div className="topbar" style={{ marginTop: !connected ? 36 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button
            onClick={() => setMobileMenu(m => !m)}
            style={{ display:'none', background:'none', border:'none', color:'var(--ts)', fontSize:18, cursor:'pointer', marginRight:4 }}
            className="mobile-menu-btn"
          >☰</button>
          <span style={{ fontSize:20 }}>🐺</span>
          <span style={{ fontFamily:"'Cinzel', serif", fontSize:15, fontWeight:700, color:'var(--tp)', letterSpacing:3 }}>MA SÓI</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* #1: indicator thực theo connected */}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{
              width:7, height:7, borderRadius:'50%',
              background: connected ? '#4ade80' : '#f87171',
              boxShadow: connected ? '0 0 5px #4ade80' : '0 0 5px #f87171',
              animation: connected ? 'none' : 'bl 0.8s ease-in-out infinite',
            }} />
            <span style={{ fontSize:11, color: connected ? 'var(--tm)' : '#f87171' }}>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
          <SoundControl />
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', background:'var(--card)', border:'1px solid var(--b1)', borderRadius:999, fontSize:12, color:'var(--ts)' }}>
            <Avatar name={user.username} size="sm" />
            <span style={{ color:'var(--tp)', fontWeight:500 }}>{user.username}</span>
            {user.stats?.games > 0 && <span style={{ color:'var(--tf)', fontSize:10 }}>{user.stats.wins ?? 0}W</span>}
          </div>
          <button onClick={onLogout} className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:11 }}>Đăng xuất</button>
        </div>
      </div>

      {/* Body */}
      <div className="app-layout">
        <div className="app-sidebar">
          <p className="label" style={{ padding:'4px 10px 8px' }}>MENU</p>
          {NAV.map(n => (
            <div key={n.id}
              className={`sidebar-item ${page === n.id ? 'active' : ''}`}
              onClick={() => onNavigate(n.id)}>
              <span className="sidebar-icon">{n.icon}</span>
              {n.label}
            </div>
          ))}
          <div className="sidebar-sep" />
          <p className="label" style={{ padding:'4px 10px 8px' }}>THÔNG TIN</p>
          <div style={{ padding:'6px 10px' }}>
            <p style={{ fontSize:10, color:'var(--tf)', lineHeight:1.7 }}>
              Ma Sói Online v1.0<br />
              Chơi LAN / Internet<br />
              4–15 người
            </p>
          </div>
        </div>
        <div className="app-main">{children}</div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .mobile-menu-btn { display:block !important; }
          .app-layout { grid-template-columns: 1fr; }
          .app-sidebar { display: ${mobileMenu ? 'flex' : 'none'}; position:fixed; top:49px; left:0; width:200px; z-index:40; height:calc(100vh - 49px); }
        }
      `}</style>
    </div>
  );
}
