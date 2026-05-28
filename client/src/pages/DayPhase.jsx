import { useState, useEffect } from 'react';
import PlayerGrid from '../components/PlayerGrid';
import RoleCard from '../components/RoleCard';
import Chat from '../components/Chat';
import Timer from '../components/Timer';
import SoundControl from '../components/SoundControl';

export default function DayPhase({
  phase, players, myRole, myRoleInfo, timer, votes, events,
  messages, wolfMessages, user, round, nightDeaths, phaseInfo, onCastVote, onSend,
  offlineIds = [], wolfTeam = [], isHost, onCloseRoom,
}) {
  const [selected, setSelected] = useState(null);
  useEffect(() => { setSelected(null); }, [phase, round]);

  const myVote        = votes[user.id];
  const tally         = {};
  Object.values(votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  const totalDuration = phaseInfo?.duration || (phase === 'discuss' ? 90 : 60);
  const aliveCount    = players.filter(p => p.alive).length;
  const me            = players.find(p => p.userId === user.id);
  const meAlive       = me?.alive !== false;
  const canVote       = phase === 'vote' && meAlive && !myVote && !(myRole === 'IDIOT' && me?.idiotRevealed);

  const phaseStyle = {
    discuss: { bg:'rgba(120,53,15,0.18)', border:'#d97706', dot:'#fbbf24', label:'🌅 Ban ngày · Thảo luận' },
    vote:    { bg:'rgba(127,29,29,0.22)', border:'#ef4444', dot:'#f87171', label:'⚖️ Bỏ phiếu treo cổ'  },
  }[phase] || {};

  const handleSelect = (uid) => {
    if (!canVote) return;
    setSelected(uid === selected ? null : uid);
  };

  return (
    <div className="day-screen" style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>

      {/* Phase topbar */}
      <div className="game-topbar" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:50, flexShrink:0,
        background: phaseStyle.bg,
        borderBottom:`1.5px solid ${phaseStyle.border}55`,
        position:'sticky', top:0, zIndex:10,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:9, height:9, borderRadius:'50%',
            background:phaseStyle.dot, boxShadow:`0 0 7px ${phaseStyle.dot}`,
            animation:'bl 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize:14, fontWeight:700, color:'var(--tp)' }}>{phaseStyle.label}</span>
          <span className="label">· Vòng {round}</span>
        </div>
        <div className="game-topbar-actions" style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Timer seconds={timer} total={totalDuration} phase={phase} size="lg" />
          <SoundControl />
          {isHost && (
            <button
              onClick={() => window.confirm('Đóng phòng đang chơi? Tất cả người chơi sẽ bị đưa về lobby.') && onCloseRoom?.()}
              className="btn btn-danger"
              style={{ padding:'7px 12px' }}
            >
              Đóng phòng
            </button>
          )}
        </div>
      </div>

      {/* Night deaths banner */}
      {nightDeaths.length > 0 && (
        <div style={{
          padding:'9px 24px', textAlign:'center', flexShrink:0,
          background:'rgba(127,29,29,0.22)', borderBottom:'1px solid rgba(248,113,113,0.25)',
        }} className="animate-fade-in">
          {nightDeaths.map(d => (
            <span key={d.userId} style={{ fontSize:13, fontWeight:500, color:'#fca5a5', marginRight:16 }}>
              💀 <strong style={{ color:'var(--tp)' }}>{d.username}</strong>
              {' '}đã {d.cause === 'wolf' ? 'bị ma sói ăn thịt' : 'bị đầu độc'} đêm qua
            </span>
          ))}
        </div>
      )}

      {/* Main body — fills remaining height */}
      <div className="day-body" style={{
        flex:1, minHeight:0,
        display:'grid', gridTemplateColumns:'1fr 280px',
      }}>

        {/* Center — players + vote + chat */}
        <div className="day-main-panel" style={{ padding:'20px 24px', overflowY:'auto', borderRight:'1px solid var(--b0)', display:'flex', flexDirection:'column', gap:16 }}>

          <div>
            <p className="label" style={{ marginBottom:10 }}>NGƯỜI CHƠI · {aliveCount} còn sống</p>
            <PlayerGrid
              players={players} myId={user.id} votes={votes}
              phase={phase}
              onSelect={canVote ? handleSelect : null}
              selectedId={selected}
              offlineIds={offlineIds}
              myRole={myRole}
              wolfTeam={wolfTeam}
            />
          </div>

          {/* Vote action */}
          {phase === 'vote' && (
            <div style={{
              padding:'12px 16px', borderRadius:12,
              background:'rgba(127,29,29,0.15)', border:'1.5px solid rgba(248,113,113,0.3)',
            }} className="animate-fade-in">
              {!meAlive ? (
                <p style={{ fontSize:13, textAlign:'center', color:'var(--tm)', margin:0 }}>
                  💀 Bạn đã chết, không thể bỏ phiếu
                </p>
              ) : myRole === 'IDIOT' && me?.idiotRevealed ? (
                <p style={{ fontSize:13, textAlign:'center', color:'var(--tm)', margin:0 }}>
                  🤪 Bạn đã lộ Kẻ Ngốc và mất quyền bỏ phiếu
                </p>
              ) : myVote ? (
                <p style={{ fontSize:13, textAlign:'center', color:'var(--ts)', margin:0 }}>
                  ✓ Đã bầu cho <strong style={{ color:'#fca5a5' }}>{players.find(p=>p.userId===myVote)?.username}</strong>
                </p>
              ) : selected ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <p style={{ fontSize:13, color:'var(--ts)', margin:0 }}>
                    Treo cổ: <strong style={{ color:'#fca5a5' }}>{players.find(p=>p.userId===selected)?.username}</strong>?
                  </p>
                  <button onClick={() => onCastVote(selected)} className="btn btn-danger" style={{ padding:'8px 20px' }}>
                    Xác nhận
                  </button>
                </div>
              ) : (
                <p style={{ fontSize:13, textAlign:'center', fontStyle:'italic', color:'var(--tm)', margin:0 }}>
                  Nhấn vào người chơi để chọn người treo cổ
                </p>
              )}
            </div>
          )}

          {/* Chat — to và rõ */}
          <div style={{ flex:1, minHeight:240 }}>
            <Chat
              messages={messages} wolfMessages={wolfMessages}
              onSend={onSend} myRole={myRole} phase={phase}
              height={320}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="day-side-panel" style={{ padding:'20px 18px', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>

          <RoleCard role={myRole} roleInfo={myRoleInfo} />

          {/* Vote tally */}
          {phase === 'vote' && Object.keys(tally).length > 0 && (
            <div style={{ background:'var(--surface)', border:'1.5px solid var(--b1)', borderRadius:12, padding:'12px 14px' }}>
              <p className="label" style={{ marginBottom:10 }}>KẾT QUẢ BỎ PHIẾU</p>
              {Object.entries(tally).sort(([,a],[,b]) => b-a).map(([uid, cnt]) => {
                const p   = players.find(x => x.userId === uid);
                const pct = Math.round(cnt / aliveCount * 100);
                return p ? (
                  <div key={uid} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                      <span style={{ color:'var(--ts)', fontWeight:600 }}>{p.username}</span>
                      <span style={{ color:'var(--tm)' }}>{cnt} phiếu</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'var(--inp)', overflow:'hidden' }}>
                      <div style={{ height:'100%', background:'#dc2626', borderRadius:3, width:`${pct}%`, transition:'width .4s' }} />
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Event log */}
          <div style={{ background:'var(--surface)', border:'1.5px solid var(--b0)', borderRadius:12, padding:'12px 14px', flex:1 }}>
            <p className="label" style={{ marginBottom:10 }}>SỰ KIỆN</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:300, overflowY:'auto' }}>
              {events.length === 0
                ? <p style={{ fontSize:12, color:'var(--tf)', fontStyle:'italic' }}>Chưa có sự kiện</p>
                : [...events].reverse().slice(0, 20).map((e, i) => (
                    <p key={i} style={{ fontSize:12, color:'var(--ts)', lineHeight:1.6, margin:0 }}>{e.text}</p>
                  ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
