import Avatar from './Avatar';
import { ROLE_DATA } from './RoleCard';

export default function PlayerGrid({
  players,
  myId,
  votes,
  phase,
  onSelect,
  selectedId,
  offlineIds = [],
  myRole,
  wolfTeam = [],
}) {
  const tally = {};
  Object.values(votes || {}).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  const maxV = Math.max(0, ...Object.values(tally));
  const isWolfViewer = ['WOLF', 'WOLF_KING'].includes(myRole);
  const wolfInfoById = new Map((wolfTeam || []).map(w => [w.userId, w]));
  const wolfIds = new Set(wolfInfoById.keys());

  return (
    <div className="player-grid" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
      gap: 10,
    }}>
      {players.map(p => {
        const isMe      = p.userId === myId;
        const vc        = tally[p.userId] || 0;
        const topVoted  = vc > 0 && vc === maxV;
        const rd        = p.role ? ROLE_DATA[p.role] : null;
        const selected  = selectedId === p.userId;
        const canClick  = p.alive && !isMe && onSelect;
        // #3: offline indicator
        const isOffline = offlineIds.includes(p.userId) && !isMe;
        const isKnownWolf = isWolfViewer && wolfIds.has(p.userId);
        const knownWolfInfo = wolfInfoById.get(p.userId);

        let borderColor = 'rgba(255,255,255,0.20)';
        let bg          = 'var(--surface)';
        let boxShadow   = '0 1px 4px rgba(0,0,0,0.3)';

        if (isKnownWolf) {
          borderColor = 'rgba(248,113,113,0.82)';
          bg          = 'rgba(127,29,29,0.28)';
          boxShadow   = '0 0 0 1px rgba(248,113,113,0.35), 0 2px 12px rgba(127,29,29,0.28)';
        }
        if (isMe && !isKnownWolf) {
          borderColor = 'rgba(139,92,246,0.7)';
          bg = 'rgba(109,40,217,0.20)';
          boxShadow = '0 0 0 1px rgba(139,92,246,0.4), 0 2px 8px rgba(109,40,217,0.25)';
        }
        if (isMe && isKnownWolf) {
          borderColor = 'rgba(251,191,36,0.85)';
          boxShadow = '0 0 0 1px rgba(251,191,36,0.38), 0 2px 14px rgba(127,29,29,0.36)';
        }
        if (selected) { borderColor = '#8b5cf6';               bg = 'rgba(139,92,246,0.18)'; boxShadow = '0 0 0 2px rgba(139,92,246,0.5)'; }
        if (topVoted && p.alive && !selected) {
          borderColor = 'rgba(248,113,113,0.65)';
          bg          = 'rgba(185,28,28,0.18)';
          boxShadow   = '0 0 0 1px rgba(248,113,113,0.35), 0 2px 8px rgba(185,28,28,0.2)';
        }
        if (!p.alive) { borderColor = 'rgba(255,255,255,0.08)'; bg = 'rgba(255,255,255,0.03)'; boxShadow = 'none'; }

        return (
          <div key={p.userId}
            onClick={() => canClick && onSelect(p.userId)}
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, padding: '12px 8px',
              borderRadius: 12,
              border: `1.5px solid ${borderColor}`,
              background: bg,
              boxShadow,
              cursor: canClick ? 'pointer' : 'default',
              opacity: p.alive ? 1 : 0.45,
              filter: p.alive ? 'none' : 'grayscale(65%)',
              transform: selected ? 'scale(1.05)' : 'scale(1)',
              transition: 'border-color .15s, background .15s, transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { if (canClick) e.currentTarget.style.borderColor = selected ? '#8b5cf6' : 'rgba(255,255,255,0.40)'; }}
            onMouseLeave={e => { if (canClick) e.currentTarget.style.borderColor = borderColor; }}
          >
            {/* Dead marker */}
            {!p.alive && (
              <span style={{ position:'absolute', top:5, right:8, fontSize:11, color:'var(--tf)' }}>✝</span>
            )}

            {/* #3: Offline dot */}
            {isOffline && p.alive && (
              <span title="Mất kết nối" style={{
                position:'absolute', bottom:6, right:6,
                width:8, height:8, borderRadius:'50%',
                background:'#f87171', border:'1.5px solid var(--surface)',
              }} />
            )}

            {/* Vote badge */}
            {vc > 0 && p.alive && (
              <span style={{
                position:'absolute', top:-7, right:-7,
                width:20, height:20, borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, zIndex:1,
                background: topVoted ? '#dc2626' : 'var(--card)',
                color: topVoted ? '#fff' : 'var(--ts)',
                border: `1.5px solid ${topVoted ? '#f87171' : 'var(--b1)'}`,
              }}>
                {vc}
              </span>
            )}

            <Avatar name={p.username} size="md" dead={!p.alive} />

            <p style={{
              fontSize: 12, fontWeight: 600, color: isOffline && p.alive ? 'var(--tm)' : 'var(--tp)',
              textAlign: 'center', width: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{p.username}{isOffline && p.alive ? ' 📵' : ''}</p>

            {isMe && (
              <span style={{ fontSize:10, color:'#a78bfa', lineHeight:1 }}>bạn</span>
            )}
            {isKnownWolf && p.alive && (
              <span style={{
                fontSize:10, color: isMe ? '#fde68a' : '#fca5a5',
                lineHeight:1, fontWeight:700,
              }}>
                {knownWolfInfo?.role === 'WOLF_KING' ? '👑 Sói Chúa' : '🐺 Ma Sói'}
              </span>
            )}
            {!p.alive && rd && (
              <p style={{ fontSize:10, color:'var(--tm)' }}>{rd.emoji} {rd.name}</p>
            )}
            {p.idiotRevealed && p.alive && (
              <p style={{ fontSize:10, color:'var(--amber)' }}>🤪 Ngốc</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
