import { useState, useEffect } from 'react';
import Stars from '../components/Stars';
import Avatar from '../components/Avatar';
import Chat from '../components/Chat';
import SoundControl from '../components/SoundControl';

export default function WaitingRoom({ room, players, user, isHost, messages, onLeave, onToggleReady, onStart, onSend, onKick, onCloseRoom, onUpdateConfig }) {
  const [copied, setCopied] = useState(false);
  const [localConfig, setLocalConfig] = useState({
    maxPlayers:  room.config.maxPlayers,
    discussTime: room.config.discussTime,
    nightTime:   room.config.nightTime || 30,
    voteTime:    room.config.voteTime || 60,
  });

  // Sync khi server push room_updated (host chỉnh từ client khác)
  useEffect(() => {
    setLocalConfig({
      maxPlayers:  room.config.maxPlayers,
      discussTime: room.config.discussTime,
      nightTime:   room.config.nightTime || 30,
      voteTime:    room.config.voteTime || 60,
    });
  }, [room.config.maxPlayers, room.config.discussTime, room.config.nightTime, room.config.voteTime]);
  const me       = players.find(p => p.userId === user.id);
  // #8: đếm sẵn sàng — host tự động sẵn sàng
  const readyCount = players.filter(p => p.ready || p.userId === room.hostId).length;
  const allReady   = readyCount >= players.length && players.length >= 4;
  const canStart   = allReady && isHost;

  // #9: speed presets
  const PRESETS = [
    { label:'⚡ Nhanh',       discussTime:60,  nightTime:20, voteTime:30 },
    { label:'⚖️ Bình thường', discussTime:90,  nightTime:30, voteTime:60 },
    { label:'🐢 Chậm',        discussTime:150, nightTime:45, voteTime:90 },
  ];

  const copyCode = () => {
    const text = room.code;
    // Thử clipboard API trước (cần HTTPS hoặc localhost)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    // Fallback dùng textarea + execCommand — hoạt động trên LAN HTTP
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(el);
    el.focus(); el.select();
    try {
      document.execCommand('copy');
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
    document.body.removeChild(el);
  };

  const readyBtn = me?.ready
    ? { background:'rgba(22,163,74,0.22)', color:'#86efac', border:'1.5px solid rgba(74,222,128,0.5)', label:'✓ Sẵn sàng' }
    : { background:'rgba(255,255,255,0.12)', color:'#fff',    border:'1.5px solid rgba(255,255,255,0.30)', label:'Sẵn sàng' };

  return (
    <div className="waiting-room" style={{ minHeight:'100vh', background:'var(--bg)', position:'relative' }}>
      <Stars count={40} />

      {/* Topbar */}
      <div className="waiting-topbar" style={{
        position:'sticky', top:0, zIndex:10,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:54,
        background:'rgba(15,11,26,0.92)', backdropFilter:'blur(10px)',
        borderBottom:'1px solid var(--b0)',
      }}>
        <div className="waiting-title">
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:15, fontWeight:700, color:'var(--tp)', letterSpacing:2, margin:0 }}>
            {room.name}
          </h1>
          <p style={{ fontSize:11, color:'var(--tm)', margin:0 }}>
            {players.length}/{room.config.maxPlayers} người · {room.config.discussTime}s thảo luận
          </p>
        </div>
        <div className="waiting-actions" style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Room code badge */}
          <button className="waiting-code-btn" onClick={copyCode} style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'7px 16px', borderRadius:10,
            background: copied ? 'rgba(22,163,74,.2)' : 'var(--card)',
            border: `1.5px solid ${copied ? 'rgba(74,222,128,.6)' : 'var(--b1)'}`,
            cursor:'pointer', transition:'all .2s',
          }}
          title="Click để copy mã phòng"
          onMouseEnter={e => { if (!copied) e.currentTarget.style.borderColor='var(--b2)'; }}
          onMouseLeave={e => { if (!copied) e.currentTarget.style.borderColor='var(--b1)'; }}
          >
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, letterSpacing:4, fontWeight:600, color: copied ? '#4ade80' : 'var(--tp)' }}>
              {room.code}
            </span>
            <span style={{ fontSize:13, color: copied ? '#4ade80' : 'var(--tm)', fontWeight: copied ? 700 : 400 }}>
              {copied ? '✓ Đã copy' : '📋'}
            </span>
          </button>
          <SoundControl />
          {isHost && (
            <button
              onClick={() => window.confirm('Đóng phòng này? Tất cả người chơi sẽ bị đưa về lobby.') && onCloseRoom?.()}
              className="btn btn-danger"
              style={{ padding:'7px 14px' }}
            >
              Đóng phòng
            </button>
          )}
          <button onClick={onLeave} className="btn btn-ghost" style={{ padding:'7px 14px' }}>← Rời</button>
        </div>
      </div>

      {/* Body — full width layout */}
      <div className="waiting-body" style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:0, height:'calc(100vh - 54px)' }}>

        {/* Left — players */}
        <div className="waiting-players-panel" style={{ padding:'24px 28px', overflowY:'auto', borderRight:'1px solid var(--b0)' }}>
          <div className="waiting-section-head" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div className="waiting-section-title" style={{ display:'flex', alignItems:'center', gap:10 }}>
              <p className="label">NGƯỜI CHƠI ({players.length}/{room.config.maxPlayers})</p>
              {/* #8: ready count */}
              <span style={{
                fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                background: allReady ? 'rgba(22,163,74,.2)' : 'rgba(255,255,255,.08)',
                color: allReady ? '#4ade80' : 'var(--tm)',
                border: `1px solid ${allReady ? 'rgba(74,222,128,.4)' : 'var(--b0)'}`,
              }}>
                {readyCount}/{players.length} sẵn sàng
              </span>
            </div>
            {!isHost && (
              <button
                onClick={onToggleReady}
                style={{
                  padding:'8px 24px', borderRadius:10, fontSize:13,
                  fontWeight:600, cursor:'pointer', transition:'all .18s',
                  fontFamily:'var(--font-body)',
                  background: readyBtn.background,
                  color:      readyBtn.color,
                  border:     readyBtn.border,
                  boxShadow:  me?.ready ? '0 0 12px rgba(74,222,128,0.2)' : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#14532d'; }}
                onMouseLeave={e => { e.currentTarget.style.background = readyBtn.background; e.currentTarget.style.color = readyBtn.color; }}
              >
                {readyBtn.label}
              </button>
            )}
            {isHost && (
              <button
                onClick={onStart}
                disabled={!canStart}
                className="btn btn-primary"
                style={{
                  padding:'8px 24px', fontSize:13,
                  ...(canStart ? {} : {
                    background: 'rgba(139,92,246,0.25)',
                    color: '#c4b5fd',
                    border: '1.5px solid rgba(139,92,246,0.45)',
                    opacity: 1,
                    cursor: 'not-allowed',
                  })
                }}
              >
                {players.length < 4
                  ? `⏳ Cần thêm ${4 - players.length} người`
                  : !allReady
                  ? `⏳ Chờ ${players.length - readyCount} người sẵn sàng`
                  : '🐺 Bắt đầu ván'
                }
              </button>
            )}
          </div>

          {/* Players grid — 3 cols on wide screen */}
          <div className="waiting-player-grid" style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',
            gap:12,
          }}>
            {players.map(p => {
              const isMe       = p.userId === user.id;
              const isRoomHost = p.userId === room.hostId;
              return (
                <div key={p.userId} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'12px 14px', borderRadius:12,
                  background: isMe ? 'rgba(109,40,217,0.18)' : 'var(--surface)',
                  border: `1.5px solid ${isMe ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.18)'}`,
                  boxShadow: isMe
                    ? '0 0 0 1px rgba(139,92,246,0.25), 0 2px 8px rgba(109,40,217,0.15)'
                    : '0 1px 4px rgba(0,0,0,0.25)',
                  transition:'border-color .15s',
                }}>
                  <Avatar name={p.username} size="md" />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--tp)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {p.username}
                    </p>
                    <p style={{ fontSize:11, margin:0,
                      color: isRoomHost ? '#fbbf24' : p.ready ? '#4ade80' : 'var(--tm)' }}>
                      {isRoomHost ? '👑 Host' : p.ready ? '✓ Sẵn sàng' : 'Chờ...'}
                    </p>
                  </div>
                  {isHost && !isMe && (
                    <button onClick={() => onKick(p.userId)} style={{
                      background:'none', border:'none', cursor:'pointer',
                      color:'var(--tf)', fontSize:13, padding:'2px 4px',
                      transition:'color .15s', lineHeight:1,
                    }}
                    onMouseEnter={e => e.target.style.color='#f87171'}
                    onMouseLeave={e => e.target.style.color='var(--tf)'}
                    >✕</button>
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, Math.min(6, room.config.maxPlayers - players.length)) }).map((_, i) => (
              <div key={`e${i}`} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'12px 14px', borderRadius:12,
                border:'1.5px dashed rgba(139,92,246,0.35)',
                background: 'rgba(139,92,246,0.04)',
              }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%', flexShrink:0,
                  border:'1.5px dashed rgba(139,92,246,0.4)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:18, color:'#a78bfa',
                }}>+</div>
                <span style={{ fontSize:12, color:'#c4b5fd', fontWeight:500 }}>Đợi người chơi...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — config + chat */}
        <div className="waiting-side-panel" style={{ display:'flex', flexDirection:'column', padding:'24px 20px', gap:16, overflowY:'auto' }}>

          {/* Config */}
          <div style={{ background:'var(--card)', border:'1.5px solid var(--b1)', borderRadius:12, padding:'14px 16px' }}>
            <p className="label" style={{ marginBottom:10 }}>CẤU HÌNH VÁN {isHost && <span style={{ color:'#a78bfa', fontWeight:400 }}>· Host có thể chỉnh</span>}</p>

            {isHost ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* #9: Speed presets */}
                <div>
                  <p style={{ fontSize:11, color:'var(--tf)', marginBottom:6, letterSpacing:.5 }}>PRESET TỐC ĐỘ</p>
                  <div className="waiting-presets" style={{ display:'flex', gap:6 }}>
                    {PRESETS.map(p => {
                      const active = localConfig.discussTime === p.discussTime && localConfig.nightTime === p.nightTime && localConfig.voteTime === p.voteTime;
                      return (
                        <button key={p.label} onClick={() => {
                          const v = { ...localConfig, discussTime:p.discussTime, nightTime:p.nightTime, voteTime:p.voteTime };
                          setLocalConfig(v);
                          onUpdateConfig && onUpdateConfig(v);
                        }} style={{
                          flex:1, padding:'6px 4px', borderRadius:8, fontSize:11, fontWeight:600,
                          cursor:'pointer', border:'1.5px solid', transition:'all .15s',
                          background: active ? 'rgba(139,92,246,.25)' : 'var(--inp)',
                          color: active ? '#c4b5fd' : 'var(--tm)',
                          borderColor: active ? 'rgba(139,92,246,.5)' : 'var(--b1)',
                        }}>{p.label}</button>
                      );
                    })}
                  </div>
                </div>
                {/* Max players */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, color:'var(--tm)' }}>Số người tối đa</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--tp)' }}>{localConfig.maxPlayers} người</span>
                  </div>
                  <input type="range" min="4" max="15" value={localConfig.maxPlayers}
                    onChange={e => {
                      const v = +e.target.value;
                      setLocalConfig(c => ({...c, maxPlayers:v}));
                      onUpdateConfig && onUpdateConfig({...localConfig, maxPlayers:v});
                    }}
                    style={{ width:'100%', accentColor:'#8b5cf6' }} />
                </div>
                {/* Discuss time */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, color:'var(--tm)' }}>Thảo luận</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'#fbbf24' }}>{localConfig.discussTime}s</span>
                  </div>
                  <input type="range" min="30" max="300" step="15" value={localConfig.discussTime}
                    onChange={e => {
                      const v = +e.target.value;
                      setLocalConfig(c => ({...c, discussTime:v}));
                      onUpdateConfig && onUpdateConfig({...localConfig, discussTime:v});
                    }}
                    style={{ width:'100%', accentColor:'#fbbf24' }} />
                </div>
                {/* Night time */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, color:'var(--tm)' }}>Thời gian đêm</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'#818cf8' }}>{localConfig.nightTime}s</span>
                  </div>
                  <input type="range" min="15" max="90" step="5" value={localConfig.nightTime}
                    onChange={e => {
                      const v = +e.target.value;
                      setLocalConfig(c => ({...c, nightTime:v}));
                      onUpdateConfig && onUpdateConfig({...localConfig, nightTime:v});
                    }}
                    style={{ width:'100%', accentColor:'#818cf8' }} />
                </div>
                {/* Vote time */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, color:'var(--tm)' }}>Bỏ phiếu</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'#f87171' }}>{localConfig.voteTime}s</span>
                  </div>
                  <input type="range" min="15" max="180" step="5" value={localConfig.voteTime}
                    onChange={e => {
                      const v = +e.target.value;
                      setLocalConfig(c => ({...c, voteTime:v}));
                      onUpdateConfig && onUpdateConfig({...localConfig, voteTime:v});
                    }}
                    style={{ width:'100%', accentColor:'#f87171' }} />
                </div>
              </div>
            ) : (
              /* Read-only cho người chơi thường */
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {[
                  ['Số người tối đa', `${room.config.maxPlayers} người`, 'var(--tp)'],
                  ['Thảo luận',       `${room.config.discussTime}s`,    '#fbbf24'],
                  ['Thời gian đêm',   `${room.config.nightTime || 30}s`, '#818cf8'],
                  ['Bỏ phiếu',        `${room.config.voteTime || 60}s`, '#f87171'],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--b0)' }}>
                    <span style={{ fontSize:12, color:'var(--tm)' }}>{k}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat — chiếm phần còn lại */}
          <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
            <p className="label" style={{ marginBottom:8 }}>CHAT PHÒNG</p>
            <div style={{ flex:1, minHeight:200, display:'flex', flexDirection:'column' }}>
              <Chat
                messages={messages} wolfMessages={[]}
                onSend={t => onSend(t, 'public')}
                myRole={null} phase="waiting"
                height={999}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
