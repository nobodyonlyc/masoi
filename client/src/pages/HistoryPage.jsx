import { useState, useEffect } from 'react';
import { ROLE_DATA } from '../components/RoleCard';
import { API_BASE } from '../utils/api';
import Avatar from '../components/Avatar';

const ROLE_TEAM = r => ['WOLF','WOLF_KING'].includes(r) ? 'wolf' : 'village';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'vừa xong';
  if (m < 60)  return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

export default function HistoryPage({ user }) {
  const [tab, setTab]           = useState('history');
  const [leaderboard, setLeaderboard] = useState([]);
  const [games, setGames]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/leaderboard`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/my-games/${user.id}`).then(r => r.json()).catch(() => []),
    ]).then(([lb, g]) => {
      setLeaderboard(lb);
      setGames(g);
      setLoading(false);
    });
  }, [user.id]);

  const s       = user.stats || {};
  const winPct  = s.games > 0 ? Math.round((s.wins ?? 0) / s.games * 100) : 0;
  const wolfGames    = games.filter(g => g.team === 'wolf').length;
  const villageGames = games.filter(g => g.team === 'village').length;

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }} className="animate-fade-in">
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--tp)', marginBottom:4 }}>📊 Lịch sử & Thống kê</h1>
      <p style={{ fontSize:13, color:'var(--tm)', marginBottom:20 }}>{user.username}</p>

      {/* Stats cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:20 }}>
        {[
          { label:'Tổng ván',   value: s.games ?? 0,                         color:'var(--tp)' },
          { label:'Thắng',      value: s.wins  ?? 0,                         color:'#4ade80'   },
          { label:'Tỉ lệ',      value: `${winPct}%`,                         color:'#a78bfa'   },
          { label:'Chơi sói',   value: wolfGames,                            color:'#f87171'   },
        ].map((c,i) => (
          <div key={i} style={{ padding:'12px 10px', background:'var(--surface)', border:'1px solid var(--b0)', borderRadius:12, textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:10, color:'var(--tm)', marginTop:3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--bg)', borderRadius:10, padding:3, marginBottom:16, width:'fit-content' }}>
        {[['history','📋 Lịch sử'],['leaderboard','🏆 Bảng xếp hạng']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="btn"
            style={tab===id
              ? { background:'var(--card)', color:'var(--tp)', border:'1px solid var(--b1)', padding:'6px 14px', fontSize:12 }
              : { background:'transparent', color:'var(--tm)', border:'1px solid transparent', padding:'6px 14px', fontSize:12 }}>
            {label}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tf)', fontSize:13 }}>Đang tải...</div>
          ) : games.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tf)', fontSize:13 }}>
              Chưa có ván nào được ghi lại.<br />
              <span style={{ fontSize:11, marginTop:6, display:'block' }}>Chơi xong ván đầu tiên để xem lịch sử!</span>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {games.map((g, i) => {
                const rd = ROLE_DATA[g.role] || {};
                const isWolf = g.team === 'wolf';
                return (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'1fr 100px 80px 70px',
                    gap:8, padding:'10px 14px', alignItems:'center', borderRadius:10,
                    background: g.won ? 'rgba(20,83,45,.15)' : 'rgba(127,29,29,.15)',
                    border: `1px solid ${g.won ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.2)'}`,
                  }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--tp)' }}>
                        Phòng {g.room_code}
                      </div>
                      <div style={{ fontSize:10, color:'var(--tm)' }}>
                        {timeAgo(g.ended_at)} · {g.player_count} người · {g.rounds} vòng
                        {g.winner_team === 'wolf' ? ' · 🐺 Sói thắng' : ' · 🌅 Dân thắng'}
                      </div>
                    </div>
                    <span style={{ fontSize:12, color: isWolf ? '#fca5a5' : '#c4b5fd', textAlign:'center' }}>
                      {rd.emoji} {rd.name}
                    </span>
                    <span style={{
                      fontSize:11, padding:'3px 8px', borderRadius:6, textAlign:'center', fontWeight:600,
                      background: g.won ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.2)',
                      color: g.won ? '#86efac' : '#fca5a5',
                    }}>{g.won ? '🏆 Thắng' : '💀 Thua'}</span>
                    <span style={{ fontSize:10, color:'var(--tf)', textAlign:'right' }}>
                      {g.survived ? '💚 Sống' : '💀 Chết'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div>
          <p className="label" style={{ marginBottom:10 }}>TOP NGƯỜI CHƠI</p>
          {leaderboard.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tf)', fontSize:13 }}>
              Chưa có dữ liệu xếp hạng.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {leaderboard.map((p, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'32px 1fr 60px 60px 60px', gap:8, padding:'9px 12px', background:'var(--surface)', border:'1px solid var(--b0)', borderRadius:10, alignItems:'center' }}>
                  <span style={{ fontSize:14, fontWeight:700, color: i===0?'#fbbf24': i===1?'#94a3b8': i===2?'#b45309':'var(--tf)', textAlign:'center' }}>
                    {i===0?'🥇': i===1?'🥈': i===2?'🥉': `#${i+1}`}
                  </span>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Avatar name={p.username} size="sm" />
                    <span style={{ fontSize:13, fontWeight:600, color: p.username===user.username?'#c4b5fd':'var(--tp)' }}>
                      {p.username}{p.username===user.username?' (bạn)':''}
                    </span>
                  </div>
                  <span style={{ fontSize:11, color:'var(--tm)', textAlign:'center' }}>{p.games_played} ván</span>
                  <span style={{ fontSize:11, color:'#4ade80', textAlign:'center' }}>{p.games_won} thắng</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#a78bfa', textAlign:'right' }}>{p.win_pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
