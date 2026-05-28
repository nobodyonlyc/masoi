import { useState, useEffect } from 'react';
import Timer from '../components/Timer';
import Avatar from '../components/Avatar';
import RoleCard from '../components/RoleCard';

export default function NightPhase({
  players, myRole, myRoleInfo, timer, wolfTeam, wolfTarget,
  onNightAction, onSkip, seerResult,
  witchPeekResult, onWitchPeek,
  hunterMustShoot, onHunterShoot,
  wolfKingMustChoose, onWolfKingTarget,
  phaseInfo, myId, isHost, onCloseRoom,
}) {
  const [selected, setSelected]       = useState(null);
  const [witchAction, setWitchAction] = useState(null); // 'save' | 'poison'
  const [confirmed, setConfirmed]     = useState(false);
  const [showRoleIntro, setShowRoleIntro] = useState(false);

  // Reset state khi sang đêm mới
  useEffect(() => {
    setSelected(null);
    setWitchAction(null);
    setConfirmed(false);
  }, [phaseInfo?.round]);

  useEffect(() => {
    if (phaseInfo?.round === 1 && myRole) setShowRoleIntro(true);
  }, [phaseInfo?.round, myRole]);

  const isWolf   = ['WOLF', 'WOLF_KING'].includes(myRole);
  const isSeer   = myRole === 'SEER';
  const isDoctor = myRole === 'DOCTOR';
  const isWitch  = myRole === 'WITCH';
  const me        = players.find(p => p.userId === myId);
  const meAlive   = me?.alive !== false;
  const hasNightSkill = isWolf || isSeer || isDoctor || isWitch;
  const canAct   = meAlive && hasNightSkill;
  const wolfIds  = new Set((wolfTeam || []).map(w => w.userId));

  // ── Danh sách target hợp lệ theo từng role ──────────────────────────────────
  const aliveOthers = players.filter(p => p.alive && p.userId !== myId);  // loại chính mình

  const targetList = (() => {
    if (isWolf)   return aliveOthers.filter(p => !wolfIds.has(p.userId)); // không cắn đồng bọn
    if (isSeer)   return aliveOthers;
    if (isDoctor) return players.filter(p => p.alive); // Doctor có thể cứu chính mình
    if (isWitch) {
      if (witchAction === 'save')   return players.filter(p => p.alive && p.userId !== myId && p.userId === witchPeekResult?.attackedId);
      if (witchAction === 'poison') return aliveOthers;
      return [];
    }
    return [];
  })();

  // ── Confirm action ────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!selected) return;
    if (isWitch) {
      if (!witchAction) return; // phải chọn loại thuốc
      onNightAction(selected, witchAction);
    } else {
      onNightAction(selected);
    }
    setConfirmed(true);
  };

  // ── Skip: server records role-specific skip, including Wolves choosing no kill. ──
  const handleSkip = () => {
    onSkip();
    setConfirmed(true);
  };

  const prompt = {
    WOLF:     '🐺 Chọn nạn nhân đêm nay',
    WOLF_KING:'👑 Chọn nạn nhân đêm nay',
    SEER:     '🔮 Chọn 1 người để xem bài',
    DOCTOR:   '💉 Chọn 1 người để cứu',
    WITCH:    '🧪 Chọn loại thuốc rồi chọn mục tiêu',
    HUNTER:   '🏹 Bạn không có hành động đêm nay',
    VILLAGER: '💤 Bạn đang ngủ...',
    IDIOT:    '💤 Bạn đang ngủ...',
  }[myRole] || '💤 Chờ màn đêm kết thúc...';

  // ── Hunter bị buộc bắn ───────────────────────────────────────────────────────
  if (hunterMustShoot) {
    const alive = players.filter(p => p.alive);
    return (
      <div style={styles.fullCenter}>
        <div style={{ fontSize:52, marginBottom:12 }}>🏹</div>
        <h2 style={styles.title}>Thợ Săn Phục Thù!</h2>
        <p style={styles.sub}>Bạn đã chết. Hãy chọn 1 người để bắn cùng.</p>
        <TargetGrid players={alive} selected={selected} onSelect={setSelected} accent="#f87171" />
        {selected && (
          <button onClick={() => onHunterShoot(selected)} className="btn btn-danger" style={{ padding:'10px 28px', marginTop:8 }}>
            🏹 Bắn {players.find(p => p.userId === selected)?.username}
          </button>
        )}
      </div>
    );
  }

  // ── Wolf King chọn người kéo theo ────────────────────────────────────────────
  if (wolfKingMustChoose) {
    const alive = players.filter(p => p.alive);
    return (
      <div style={styles.fullCenter}>
        <div style={{ fontSize:52, marginBottom:12 }}>👑</div>
        <h2 style={{ ...styles.title, color:'#fca5a5' }}>Sói Chúa Trả Thù!</h2>
        <p style={styles.sub}>Bạn bị treo cổ. Hãy kéo 1 người chết cùng.</p>
        <TargetGrid players={alive} selected={selected} onSelect={setSelected} accent="#f87171" />
        {selected && (
          <button onClick={() => onWolfKingTarget(selected)} className="btn btn-danger" style={{ padding:'10px 28px', marginTop:8 }}>
            👑 Kéo {players.find(p => p.userId === selected)?.username} theo
          </button>
        )}
      </div>
    );
  }

  // ── Main night screen ─────────────────────────────────────────────────────────
  return (
    <div className="night-screen" style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 16px', background:'#0f0c1a' }}>
      {isHost && (
        <button
          onClick={() => window.confirm('Đóng phòng đang chơi? Tất cả người chơi sẽ bị đưa về lobby.') && onCloseRoom?.()}
          className="btn btn-danger host-close-room"
          style={{ position:'fixed', top:12, right:12, zIndex:30, padding:'7px 12px' }}
        >
          Đóng phòng
        </button>
      )}
      {showRoleIntro && (
        <div style={{
          position:'fixed', inset:0, zIndex:50,
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:16, background:'rgba(8,6,16,.78)', backdropFilter:'blur(6px)',
        }}>
          <div style={{ width:'100%', maxWidth:360 }}>
            <RoleCard role={myRole} roleInfo={myRoleInfo} />
            {isWolf && wolfTeam?.length > 0 && (
              <div style={{
                marginTop:10, padding:'10px 14px', borderRadius:12,
                background:'rgba(127,29,29,.25)', border:'1px solid rgba(248,113,113,.35)',
                color:'#fca5a5', fontSize:12,
              }}>
                <strong>Đồng đội:</strong>{' '}
                {wolfTeam.filter(w => w.userId !== myId).map(w => `${w.username} - ${w.roleName || 'Ma Sói'}`).join(', ') || 'Chỉ mình bạn'}
              </div>
            )}
            <button onClick={() => setShowRoleIntro(false)} className="btn btn-primary" style={{ width:'100%', marginTop:12, padding:'11px' }}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}
      <div style={{ fontSize:52, marginBottom:8 }} className="animate-wolf">🌙</div>
      <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700, color:'var(--tp)', letterSpacing:3, marginBottom:5, textAlign:'center' }}>
        MÀN ĐÊM BUÔNG XUỐNG
      </h1>
      <p style={{ fontSize:12, color:'var(--tm)', marginBottom:14 }}>Làng đang ngủ say...</p>

      <div style={{ marginBottom:16 }}>
        <Timer seconds={timer} total={phaseInfo?.duration || 30} phase="night" size="lg" />
      </div>

      {/* Role card */}
      <div style={{ marginBottom:12, width:'100%', maxWidth:360 }}>
        <RoleCard role={myRole} roleInfo={myRoleInfo} compact />
      </div>

      {/* Seer result */}
      {isSeer && seerResult && (
        <div style={{
          marginBottom:12, padding:'10px 16px', borderRadius:12, textAlign:'center',
          width:'100%', maxWidth:360,
          background: seerResult.isWolf ? 'rgba(127,29,29,.35)' : 'rgba(20,83,45,.35)',
          border: `1px solid ${seerResult.isWolf ? 'rgba(248,113,113,.5)' : 'rgba(74,222,128,.5)'}`,
        }} className="animate-fade-in">
          <p style={{ fontSize:13, color:'var(--tp)', margin:0 }}>
            <strong>{seerResult.targetName}</strong> là{' '}
            <span style={{ fontWeight:600, color: seerResult.isWolf ? '#f87171' : '#4ade80' }}>
              {seerResult.isWolf ? '🐺 Ma Sói!' : '🌅 Dân Làng'}
            </span>
          </p>
        </div>
      )}

      {/* Wolf team info */}
      {isWolf && wolfTeam.length > 1 && (
        <div style={{
          marginBottom:12, padding:'7px 14px', borderRadius:10, fontSize:12,
          width:'100%', maxWidth:360,
          background:'rgba(127,29,29,.22)', border:'1px solid rgba(248,113,113,.3)', color:'#fca5a5',
        }}>
          <p style={{ fontWeight:700, marginBottom:6 }}>🐺 Đồng đội</p>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {wolfTeam.filter(w => w.userId !== myId).map(w => (
              <span key={w.userId}>- {w.username} - {w.roleName || (w.role === 'WOLF_KING' ? 'Sói Chúa' : 'Ma Sói')}</span>
            ))}
            {wolfTeam.filter(w => w.userId !== myId).length === 0 && <span>- Chỉ mình bạn</span>}
          </div>
        </div>
      )}

      {isWolf && (
        <div style={{
          marginBottom:12, padding:'9px 14px', borderRadius:10, fontSize:12,
          width:'100%', maxWidth:360,
          background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.3)', color:'#fde68a',
        }}>
          <strong>🎯 Mục tiêu hiện tại:</strong>{' '}
          {wolfTarget?.targetName ? (
            <span>{wolfTarget.targetName} <span style={{ color:'var(--tm)' }}>({wolfTarget.selectedByName} chọn)</span></span>
          ) : (
            <span style={{ color:'var(--tm)' }}>Chưa chọn</span>
          )}
        </div>
      )}

      {/* Witch peek */}
      {isWitch && !confirmed && !witchPeekResult && (
        <button onClick={onWitchPeek} className="btn btn-ghost"
          style={{ marginBottom:10, padding:'7px 16px', fontSize:12, width:'100%', maxWidth:360 }}>
          👁 Xem ai bị tấn công đêm nay
        </button>
      )}
          {isWitch && witchPeekResult && (
        <div style={{
          marginBottom:12, padding:'12px 16px', borderRadius:10, fontSize:12,
          width:'100%', maxWidth:360,
          background: witchPeekResult.attackedName ? 'rgba(127,29,29,.35)' : 'rgba(109,40,217,.18)',
          border: `1.5px solid ${witchPeekResult.attackedName ? 'rgba(248,113,113,.6)' : 'rgba(139,92,246,.4)'}`,
          boxShadow: witchPeekResult.attackedName ? '0 0 12px rgba(248,113,113,.2)' : 'none',
        }} className={witchPeekResult.attackedName ? 'animate-pulse' : ''}>
          {witchPeekResult.attackedName
            ? (
              <div>
                <p style={{ color:'#fca5a5', fontWeight:700, marginBottom:4 }}>
                  🚨 <strong>{witchPeekResult.attackedName}</strong> đang bị Ma Sói tấn công!
                </p>
                <p style={{ color:'var(--tm)', fontSize:11 }}>Bạn có muốn dùng thuốc cứu không?</p>
              </div>
            )
            : <span style={{ color:'var(--tm)' }}>😴 Đêm nay không ai bị tấn công</span>
          }
          <div style={{ marginTop:6, display:'flex', gap:8, fontSize:11 }}>
            <span style={{ color: witchPeekResult.canSave ? '#4ade80' : 'var(--tf)' }}>
              {witchPeekResult.canSave ? '💊 Còn thuốc cứu' : '💊 Hết thuốc cứu'}
            </span>
            <span style={{ color:'var(--tf)' }}>·</span>
            <span style={{ color: witchPeekResult.canPoison ? '#f87171' : 'var(--tf)' }}>
              {witchPeekResult.canPoison ? '☠️ Còn thuốc độc' : '☠️ Hết thuốc độc'}
            </span>
          </div>
        </div>
      )}

          {/* ── Action panel ── */}
      {canAct && !confirmed ? (
        <div style={{ width:'100%', maxWidth:360, borderRadius:12, padding:16, background:'var(--card)', border:'1px solid var(--b1)' }}>
          <p style={{ fontSize:12, color:'var(--ts)', textAlign:'center', marginBottom:12, margin:'0 0 12px' }}>{prompt}</p>

          {/* Witch: chọn loại thuốc trước */}
          {isWitch && (
            <>
            <p style={{ fontSize:11, color:'var(--tf)', textAlign:'center', marginBottom:8 }}>
              Mỗi đêm chỉ dùng tối đa 1 hành động. Không tự cứu, không tự độc.
            </p>
            <div style={{ display:'flex', gap:8, marginBottom:12, justifyContent:'center' }}>
              {[
                ['save',   '💊 Thuốc cứu',  witchPeekResult?.canSave !== false && !!witchPeekResult?.attackedId],
                ['poison', '☠️ Thuốc độc',  witchPeekResult?.canPoison !== false],
              ].map(([a, label, canUse]) => (
                <button key={a}
                  disabled={!canUse}
                  onClick={() => {
                    setWitchAction(a === witchAction ? null : a);
                    setSelected(null); // reset target khi đổi action
                  }}
                  style={{
                    padding:'8px 16px', borderRadius:9, fontSize:12, fontWeight:600,
                    cursor: canUse ? 'pointer' : 'not-allowed', border:'1.5px solid',
                    transition:'all .15s', opacity: canUse ? 1 : 0.4,
                    ...(witchAction === a
                      ? a === 'save'
                        ? { background:'rgba(20,83,45,.4)', color:'#4ade80', borderColor:'rgba(74,222,128,.6)' }
                        : { background:'rgba(127,29,29,.4)', color:'#f87171', borderColor:'rgba(248,113,113,.6)' }
                      : { background:'var(--inp)', color:'var(--tm)', borderColor:'var(--b1)' })
                  }}>
                  {label}
                </button>
              ))}
            </div>
            </>
          )}

          {/* Target grid */}
          {targetList.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:14 }}>
              {targetList.map(p => {
                const isSel = selected === p.userId;
                // Wolf: highlight đồng bọn (không cho chọn nhưng đã filter ra rồi)
                return (
                  <button key={p.userId}
                    onClick={() => setSelected(isSel ? null : p.userId)}
                    style={{
                      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                      padding:'9px 5px', borderRadius:10, cursor:'pointer', transition:'all .15s',
                      border: `1.5px solid ${isSel ? 'rgba(248,113,113,.7)' : 'var(--b0)'}`,
                      background: isSel ? 'rgba(127,29,29,.4)' : 'var(--surface)',
                      transform: isSel ? 'scale(1.06)' : 'scale(1)',
                      boxShadow: isSel ? '0 0 8px rgba(248,113,113,.3)' : 'none',
                    }}>
                    <Avatar name={p.username} size="sm" />
                    <span style={{
                      fontSize:10, fontWeight:600, color: isSel ? '#fca5a5' : 'var(--tp)',
                      textAlign:'center', width:'100%',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>{p.username}{isDoctor && p.userId === myId ? ' (Bạn)' : ''}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* isWitch nhưng chưa chọn action → chỉ hiện nút bỏ qua */}
          {isWitch && !witchAction && targetList.length === 0 && (
            <p style={{ fontSize:12, color:'var(--tf)', textAlign:'center', marginBottom:12 }}>
              Chọn loại thuốc muốn dùng ở trên, hoặc bỏ qua
            </p>
          )}

          {/* CTA buttons — Xác nhận trên, Bỏ qua dưới, không bao giờ che nhau */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {/* Nút Xác nhận — chỉ hiện khi đã chọn target hợp lệ */}
            {selected && (isWitch ? !!witchAction : true) && (
              <button onClick={handleConfirm} className="btn btn-danger"
                style={{ width:'100%', padding:'11px', fontSize:14, fontWeight:700, borderRadius:10 }}>
                {isWolf   && `🐺 Cắn ${players.find(p=>p.userId===selected)?.username}`}
                {isSeer   && `🔮 Xem ${players.find(p=>p.userId===selected)?.username}`}
                {isDoctor && `💉 Cứu ${players.find(p=>p.userId===selected)?.username}`}
                {isWitch  && `${witchAction==='save'?'💊 Cứu':'☠️ Đầu độc'} ${players.find(p=>p.userId===selected)?.username}`}
              </button>
            )}
            {/* Nút Bỏ qua — luôn hiện */}
            <button onClick={handleSkip} className="btn btn-ghost"
              style={{ width:'100%', padding:'9px', fontSize:13 }}>
              {isWolf ? '😶 Bỏ qua, không cắn đêm nay' : 'Bỏ qua'}
            </button>
          </div>
        </div>
      ) : canAct && confirmed ? (
        <div style={{
          width:'100%', maxWidth:360, padding:'14px 18px', borderRadius:12,
          background:'rgba(20,83,45,.2)', border:'1px solid rgba(74,222,128,.3)',
          textAlign:'center',
        }}>
          <p style={{ fontSize:13, color:'#4ade80', margin:0, fontWeight:600 }}>
            ✓ Đã hành động — đang chờ người khác...
          </p>
        </div>
      ) : !meAlive ? (
        <div style={{
          width:'100%', maxWidth:360, padding:'14px 18px', borderRadius:12,
          background:'var(--card)', border:'1px solid var(--b1)',
          textAlign:'center',
        }}>
          <p style={{ fontSize:13, color:'var(--tf)', margin:0, fontStyle:'italic' }}>
            💀 Bạn đã chết, không thể dùng kỹ năng
          </p>
        </div>
      ) : !hasNightSkill ? (
        <div style={{
          width:'100%', maxWidth:360, padding:'14px 18px', borderRadius:12,
          background:'var(--card)', border:'1px solid var(--b1)',
          textAlign:'center',
        }}>
          <p style={{ fontSize:13, color:'var(--tf)', margin:0, fontStyle:'italic' }}>
            😴 Đang ngủ... chờ màn đêm kết thúc
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Shared target grid component ─────────────────────────────────────────────
function TargetGrid({ players, selected, onSelect, accent = '#f87171' }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:'100%', maxWidth:340, marginBottom:8 }}>
      {players.map(p => {
        const isSel = selected === p.userId;
        return (
          <button key={p.userId} onClick={() => onSelect(p.userId)}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
              padding:'9px 5px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${isSel ? accent+'99' : 'var(--b1)'}`,
              background: isSel ? accent+'22' : 'var(--card)',
              transform: isSel ? 'scale(1.05)' : 'scale(1)',
              transition:'all .15s',
            }}>
            <Avatar name={p.username} size="sm" />
            <span style={{ fontSize:10, fontWeight:600, color: isSel ? accent : 'var(--tp)', textAlign:'center' }}>
              {p.username}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  fullCenter: {
    minHeight:'100vh', display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    padding:'24px 16px', background:'#0f0c1a',
  },
  title: {
    fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700,
    color:'var(--tp)', letterSpacing:2, marginBottom:6, textAlign:'center',
  },
  sub: {
    fontSize:13, color:'var(--tm)', marginBottom:20, textAlign:'center',
  },
};
