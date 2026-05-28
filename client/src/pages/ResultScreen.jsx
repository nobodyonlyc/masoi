import { useState, useEffect } from 'react';
import { ROLE_DATA } from '../components/RoleCard';
import Avatar from '../components/Avatar';

const ROLE_TEAM = r => ['WOLF','WOLF_KING'].includes(r) ? 'wolf' : 'village';

export default function ResultScreen({ gameResult, players, events, user, room, isHost, onPlayAgain, onLeave }) {
  const [tab, setTab]           = useState('result');
  const [countdown, setCountdown] = useState(null);

  const isWolfWin = gameResult?.winner === 'wolf';
  const me        = players.find(p => p.userId === user.id);
  const myTeam    = me ? ROLE_TEAM(me.role) : null;
  const iWon      = myTeam === gameResult?.winner;

  // Nếu host: countdown 30s rồi tự play_again
  useEffect(() => {
    if (!isHost) return;
    setCountdown(30);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isHost]);

  const wolves   = players.filter(p => ROLE_TEAM(p.role) === 'wolf');
  const villagers = players.filter(p => ROLE_TEAM(p.role) === 'village');

  // Group events by day/night
  const timeline = buildTimeline(events);

  return (
    <div style={{
      minHeight:'100vh', background:'var(--bg)',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'32px 16px 64px',
    }}>

      {/* ── Banner kết quả ── */}
      <div style={{ textAlign:'center', marginBottom:28 }} className="animate-slide-up">
        <div style={{ fontSize:72, marginBottom:12, lineHeight:1 }}>
          {isWolfWin ? '🐺' : '🌅'}
        </div>
        <h1 style={{
          fontFamily:"'Cinzel',serif", fontSize:28, fontWeight:700,
          letterSpacing:3, marginBottom:8,
          color: isWolfWin ? '#fca5a5' : '#86efac',
          textShadow: isWolfWin ? '0 0 30px rgba(248,113,113,.4)' : '0 0 30px rgba(74,222,128,.4)',
        }}>
          {isWolfWin ? 'MA SÓI CHIẾN THẮNG' : 'DÂN LÀNG CHIẾN THẮNG'}
        </h1>
        <p style={{ fontSize:14, color:'var(--tm)', marginBottom:14 }}>{gameResult?.reason}</p>

        {/* Kết quả cá nhân */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:10,
          padding:'10px 24px', borderRadius:30,
          background: iWon ? 'rgba(20,83,45,.3)' : 'rgba(127,29,29,.3)',
          border: `1.5px solid ${iWon ? 'rgba(74,222,128,.5)' : 'rgba(248,113,113,.4)'}`,
        }}>
          <span style={{ fontSize:20 }}>{iWon ? '🏆' : '💀'}</span>
          <span style={{ fontSize:15, fontWeight:700, color: iWon ? '#4ade80' : '#f87171' }}>
            {iWon ? 'Bạn thắng!' : 'Bạn thua'}
          </span>
          {me && (
            <span style={{ fontSize:12, color:'var(--tm)' }}>
              · {ROLE_DATA[me.role]?.emoji} {ROLE_DATA[me.role]?.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display:'flex', gap:4, background:'var(--bg)', borderRadius:12,
        padding:4, marginBottom:20, width:'100%', maxWidth:640,
      }}>
        {[['result','🎭 Lộ bài'],['timeline','📅 Diễn biến'],['stats','📊 Thống kê']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, padding:'8px 10px', borderRadius:9, fontSize:13,
            fontFamily:'var(--font-body)', cursor:'pointer', transition:'all .15s',
            fontWeight: tab===id ? 700 : 400,
            background: tab===id ? 'var(--card)' : 'transparent',
            color:      tab===id ? 'var(--tp)'   : 'var(--tm)',
            border:     tab===id ? '1px solid var(--b1)' : '1px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ width:'100%', maxWidth:640 }}>

        {/* ── Tab: Lộ bài ── */}
        {tab === 'result' && (
          <div className="animate-fade-in">
            {/* Wolf team */}
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#f87171', letterSpacing:1, marginBottom:8 }}>
                🐺 PHAI SÓI ({wolves.length} người) {isWolfWin ? '· ✓ THẮNG' : '· ✗ THUA'}
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                {wolves.map(p => <PlayerCard key={p.userId} p={p} me={p.userId===user.id} won={isWolfWin} />)}
              </div>
            </div>
            {/* Village team */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:'#4ade80', letterSpacing:1, marginBottom:8 }}>
                🌅 PHAI DÂN LÀNG ({villagers.length} người) {!isWolfWin ? '· ✓ THẮNG' : '· ✗ THUA'}
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                {villagers.map(p => <PlayerCard key={p.userId} p={p} me={p.userId===user.id} won={!isWolfWin} />)}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Diễn biến ── */}
        {tab === 'timeline' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {timeline.length === 0 ? (
              <p style={{ textAlign:'center', color:'var(--tf)', fontSize:13, padding:24 }}>Không có sự kiện</p>
            ) : timeline.map((seg, i) => {
              const isNight = seg.phase === 'night';
              const accent = isNight ? '#818cf8' : '#fbbf24';
              return (
                <div key={i} style={{
                  borderRadius:12, overflow:'hidden',
                  border:`1px solid ${accent}33`,
                  background: isNight ? 'rgba(79,70,229,.08)' : 'rgba(251,191,36,.06)',
                }}>
                  <div style={{
                    padding:'10px 14px', display:'flex', alignItems:'center', gap:8,
                    borderBottom:`1px solid ${accent}22`,
                    background: isNight ? 'rgba(79,70,229,.1)' : 'rgba(251,191,36,.08)',
                  }}>
                    <span style={{ fontSize:16 }}>{isNight ? '🌙' : '☀️'}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:accent }}>{seg.label}</span>
                    <span style={{ fontSize:11, color:'var(--tf)' }}>{seg.events.length} sự kiện</span>
                  </div>
                  <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                    {seg.events.map((ev, j) => (
                      <div key={j} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background:accent, flexShrink:0, marginTop:6 }} />
                        <span style={{ fontSize:12, color:'var(--ts)', lineHeight:1.6 }}>{ev.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab: Thống kê ── */}
        {tab === 'stats' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:4 }}>
              {[
                ['Tổng vòng',  events.filter(e=>e.text?.includes('Màn đêm')).length || Math.ceil(players.length/2), 'var(--tp)'],
                ['Còn sống',   players.filter(p=>p.alive).length, '#4ade80'],
                ['Đã chết',    players.filter(p=>!p.alive).length, '#f87171'],
              ].map(([label,val,color]) => (
                <div key={label} style={{ padding:'14px 10px', background:'var(--surface)', border:'1px solid var(--b0)', borderRadius:12, textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:700, color }}>{val}</div>
                  <div style={{ fontSize:10, color:'var(--tm)', marginTop:3 }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Bảng chi tiết */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--b0)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 60px', padding:'8px 14px', borderBottom:'1px solid var(--b0)' }}>
                {['Người chơi','Role','Phe','Kết quả'].map(h => (
                  <span key={h} style={{ fontSize:10, fontWeight:700, color:'var(--tf)', letterSpacing:.5 }}>{h}</span>
                ))}
              </div>
              {players.map(p => {
                const rd = ROLE_DATA[p.role] || {};
                const pWon = ROLE_TEAM(p.role) === gameResult?.winner;
                return (
                  <div key={p.userId} style={{
                    display:'grid', gridTemplateColumns:'1fr 80px 80px 60px',
                    padding:'9px 14px', borderBottom:'1px solid var(--b0)',
                    background: p.userId===user.id ? 'rgba(139,92,246,.08)' : 'transparent',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <Avatar name={p.username} size="sm" dead={!p.alive} />
                      <span style={{ fontSize:12, color: p.userId===user.id ? '#c4b5fd' : 'var(--tp)', fontWeight: p.userId===user.id ? 600 : 400 }}>
                        {p.username}{p.userId===user.id ? ' ✦' : ''}
                      </span>
                    </div>
                    <span style={{ fontSize:12, color: ROLE_TEAM(p.role)==='wolf' ? '#fca5a5' : '#c4b5fd', alignSelf:'center' }}>
                      {rd.emoji} {rd.name}
                    </span>
                    <span style={{ fontSize:11, color:'var(--tm)', alignSelf:'center' }}>
                      {ROLE_TEAM(p.role)==='wolf' ? '🐺 Sói' : '🌅 Dân'}
                    </span>
                    <span style={{
                      fontSize:11, fontWeight:600, alignSelf:'center',
                      color: pWon ? '#4ade80' : '#f87171',
                    }}>
                      {pWon ? '🏆 Thắng' : '💀 Thua'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0,
        padding:'14px 20px',
        background:'rgba(11,8,20,.92)', backdropFilter:'blur(12px)',
        borderTop:'1px solid var(--b0)',
        display:'flex', gap:10, justifyContent:'center',
      }}>
        {isHost ? (
          <>
            <button onClick={onPlayAgain} className="btn btn-primary" style={{ flex:1, maxWidth:260, padding:'12px', fontSize:14, fontWeight:700 }}>
              🔄 Chơi lại{countdown > 0 ? ` (${countdown}s)` : ''}
            </button>
            <button onClick={onLeave} className="btn btn-ghost" style={{ padding:'12px 20px' }}>
              Rời phòng
            </button>
          </>
        ) : (
          <>
            <div style={{
              flex:1, maxWidth:260, padding:'12px', borderRadius:10, textAlign:'center',
              background:'var(--card)', border:'1px solid var(--b1)', fontSize:13, color:'var(--tm)',
            }}>
              ⏳ Chờ host chơi lại...
            </div>
            <button onClick={onLeave} className="btn btn-ghost" style={{ padding:'12px 20px' }}>
              Rời phòng
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── PlayerCard ────────────────────────────────────────────────────────────────
function PlayerCard({ p, me, won }) {
  const rd = ROLE_DATA[p.role] || {};
  const isWolf = ROLE_TEAM(p.role) === 'wolf';
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
      padding:'12px 8px', borderRadius:12, textAlign:'center',
      background: me ? 'rgba(139,92,246,.15)' : isWolf ? 'rgba(127,29,29,.15)' : 'var(--surface)',
      border: `1.5px solid ${me ? 'rgba(139,92,246,.5)' : isWolf ? 'rgba(248,113,113,.3)' : 'var(--b0)'}`,
      position:'relative',
    }}>
      {me && (
        <span style={{
          position:'absolute', top:6, right:7,
          fontSize:9, fontWeight:700, color:'#a78bfa', letterSpacing:.5,
        }}>BẠN</span>
      )}
      <Avatar name={p.username} size="md" dead={!p.alive} />
      <span style={{ fontSize:12, fontWeight:600, color:'var(--tp)', width:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {p.username}
      </span>
      <span style={{ fontSize:18 }}>{rd.emoji}</span>
      <span style={{ fontSize:11, color: isWolf ? '#fca5a5' : '#c4b5fd' }}>{rd.name}</span>
      <span style={{
        fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:600,
        background: won ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.15)',
        color: won ? '#86efac' : '#fca5a5',
      }}>
        {p.alive ? '💚 Còn sống' : '💀 Đã chết'}
      </span>
    </div>
  );
}

// ── Build timeline from events ────────────────────────────────────────────────
function buildTimeline(events) {
  const segs = [];
  let cur = null;
  for (const ev of events) {
    const t = ev.text || '';
    const newNight = t.includes('Màn đêm') || t.includes('bắt đầu') || t.includes('đêm thứ');
    const newDay   = t.includes('Bình minh') || t.includes('Ban ngày') || t.includes('sáng');
    if (newNight || (!cur && !newDay)) {
      const n = segs.filter(s=>s.phase==='night').length + 1;
      cur = { phase:'night', label:`Đêm ${n}`, events:[] };
      segs.push(cur);
    } else if (newDay) {
      const n = segs.filter(s=>s.phase==='day').length + 1;
      cur = { phase:'day', label:`Ngày ${n}`, events:[] };
      segs.push(cur);
    }
    if (!cur) { cur = { phase:'night', label:'Đêm 1', events:[] }; segs.push(cur); }
    cur.events.push(ev);
  }
  return segs;
}
