import { useState, useEffect } from 'react';
import { sounds } from '../utils/sounds';
import { API_BASE } from '../utils/api';

export default function LobbyPage({ user, onCreateRoom, onJoinRoom, onSpectate }) {
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [config, setConfig] = useState({ maxPlayers:8, discussTime:90, nightTime:30, voteTime:60, roomName:'', isPrivate:false });
  const [error, setError] = useState('');
  const API = API_BASE;

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/api/rooms`); setRooms(await r.json()); } catch { setRooms([]); }
    };
    load(); const t = setInterval(load, 5000); return () => clearInterval(t);
  }, []);

  const join = () => {
    if (code.length < 4) return;
    onJoinRoom(code); setError('');
  };

  const s = user.stats || {};

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }} className="animate-slide-up">
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--tp)', marginBottom:4 }}>🏠 Sảnh chờ</h1>
      <p style={{ fontSize:13, color:'var(--tm)', marginBottom:20 }}>Tạo phòng mới hoặc tham gia bằng mã phòng</p>

      {/* Stats mini */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
        {[
          { label:'Ván đã chơi', value:s.games??0, color:'var(--tp)' },
          { label:'Tỉ lệ thắng', value:`${s.games>0?Math.round((s.wins??0)/s.games*100):0}%`, color:'#a78bfa' },
          { label:'Xếp hạng',    value:'#—', color:'#fbbf24' },
        ].map((c,i) => (
          <div key={i} style={{ padding:'12px', background:'var(--surface)', border:'1px solid var(--b0)', borderRadius:12, textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:700, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:10, color:'var(--tm)', marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        <button onClick={() => { setShowCreate(true); sounds.click(); }}
          className="btn btn-primary"
          style={{ padding:'14px', fontSize:14, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4, height:'auto' }}>
          <span style={{ fontSize:22 }}>➕</span>
          <span>Tạo phòng mới</span>
          <span style={{ fontSize:11, fontWeight:400, opacity:.8 }}>Host & cấu hình ván chơi</span>
        </button>
        <div style={{ padding:'14px', background:'var(--surface)', border:'1px solid var(--b1)', borderRadius:12, display:'flex', flexDirection:'column', gap:8 }}>
          <p className="label">NHẬP MÃ PHÒNG</p>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
            onKeyDown={e => e.key==='Enter' && join()}
            placeholder="A B C 1 2 3"
            style={{ padding:'9px 14px', fontFamily:'monospace', letterSpacing:4, textAlign:'center', fontSize:16, width:'100%' }} />
          <button onClick={join} disabled={code.length<4} className="btn btn-ghost" style={{ width:'100%' }}>Vào phòng</button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ padding:16, background:'var(--surface)', border:'1px solid var(--b1)', borderRadius:14, marginBottom:20 }} className="animate-slide-up">
          <p style={{ fontSize:14, fontWeight:600, color:'var(--tp)', marginBottom:14 }}>Tạo phòng mới</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div>
              <p className="label" style={{ marginBottom:6 }}>TÊN PHÒNG</p>
              <input value={config.roomName} onChange={e => setConfig(c=>({...c,roomName:e.target.value}))}
                placeholder={`Phòng của ${user.username}`}
                style={{ padding:'9px 14px', width:'100%' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
              <div>
                <p className="label" style={{ marginBottom:6 }}>SỐ NGƯỜI: {config.maxPlayers}</p>
                <input type="range" min="4" max="15" value={config.maxPlayers}
                  onChange={e => setConfig(c=>({...c,maxPlayers:+e.target.value}))}
                  style={{ width:'100%', accentColor:'#8b5cf6' }} />
              </div>
              <div>
                <p className="label" style={{ marginBottom:6 }}>THẢO LUẬN: {config.discussTime}s</p>
                <input type="range" min="30" max="300" step="15" value={config.discussTime}
                  onChange={e => setConfig(c=>({...c,discussTime:+e.target.value}))}
                  style={{ width:'100%', accentColor:'#8b5cf6' }} />
              </div>
              <div>
                <p className="label" style={{ marginBottom:6 }}>ĐÊM: {config.nightTime}s</p>
                <input type="range" min="15" max="90" step="5" value={config.nightTime}
                  onChange={e => setConfig(c=>({...c,nightTime:+e.target.value}))}
                  style={{ width:'100%', accentColor:'#818cf8' }} />
              </div>
              <div>
                <p className="label" style={{ marginBottom:6 }}>VOTE: {config.voteTime}s</p>
                <input type="range" min="15" max="180" step="5" value={config.voteTime}
                  onChange={e => setConfig(c=>({...c,voteTime:+e.target.value}))}
                  style={{ width:'100%', accentColor:'#f87171' }} />
              </div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--ts)' }}>
              <input type="checkbox" checked={config.isPrivate}
                onChange={e => setConfig(c=>({...c,isPrivate:e.target.checked}))}
                style={{ width:15, height:15, accentColor:'#8b5cf6' }} />
              Phòng riêng tư (không hiện trong danh sách)
            </label>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button onClick={() => { onCreateRoom(config); setShowCreate(false); }} className="btn btn-primary" style={{ flex:1, padding:'10px' }}>Tạo phòng</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost" style={{ padding:'10px 20px' }}>Huỷ</button>
          </div>
        </div>
      )}

      {/* Room list */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <p className="label">PHÒNG ĐANG MỞ ({rooms.length})</p>
      </div>
      {rooms.length === 0
        ? <div style={{ textAlign:'center', padding:'32px', color:'var(--tf)', fontSize:13, border:'1px dashed var(--b0)', borderRadius:12 }}>
            Chưa có phòng nào đang mở — hãy tạo phòng đầu tiên!
          </div>
        : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {rooms.map(r => (
              <div key={r.code} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--b1)', borderRadius:11, transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--b2)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--b1)'}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: r.status==='waiting'?'#4ade80':'#fbbf24',
                    boxShadow: r.status==='waiting'?'0 0 5px #4ade80':'0 0 5px #fbbf24'
                  }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--tp)' }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'var(--tm)' }}>
                      {r.status==='waiting'?'Đang chờ':`Vòng ${r.round}`} · {r.hostName} · {r.playerCount}/{r.maxPlayers} người
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {r.status==='waiting'
                    ? <button onClick={() => onJoinRoom(r.code)} className="btn btn-ghost" style={{ padding:'6px 14px', fontSize:12 }}>Tham gia</button>
                    : <button onClick={() => onSpectate && onSpectate(r.code)} className="btn btn-amber" style={{ padding:'6px 14px', fontSize:12 }}>👁 Xem</button>
                  }
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
