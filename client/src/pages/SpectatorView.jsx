import { useState, useEffect } from 'react';
import Avatar from '../components/Avatar';

const ROLE_COLORS = {
  WOLF: '#f87171', WOLF_KING: '#fca5a5',
  SEER: '#818cf8', DOCTOR: '#34d399',
  WITCH: '#a78bfa', HUNTER: '#fb923c',
  VILLAGER: '#94a3b8', IDIOT: '#fbbf24',
};

const ROLE_NAMES = {
  WOLF: 'Ma Sói', WOLF_KING: 'Sói Chúa',
  SEER: 'Tiên Tri', DOCTOR: 'Thầy Thuốc',
  WITCH: 'Phù Thủy', HUNTER: 'Thợ Săn',
  VILLAGER: 'Dân Làng', IDIOT: 'Kẻ Ngốc',
};

const PHASE_LABELS = {
  night: '🌙 Đêm', discuss: '☀️ Ngày', vote: '⚖️ Bỏ phiếu', waiting: '⏳ Chờ',
};

function buildTimeline(events) {
  // Group events thành từng ngày/đêm dựa theo pattern trong event text
  const days = [];
  let current = null;

  for (const ev of events) {
    const text = ev.text || '';
    const isNewNight = text.includes('Màn đêm') || text.includes('đêm thứ') || text.includes('bắt đầu');
    const isNewDay   = text.includes('Bình minh') || text.includes('thức dậy') || text.includes('Ngày');

    if (isNewNight || (!current && !isNewDay)) {
      const nightNum = days.filter(d => d.phase === 'night').length + 1;
      current = { phase: 'night', label: `Đêm ${nightNum}`, events: [] };
      days.push(current);
    } else if (isNewDay) {
      const dayNum = days.filter(d => d.phase === 'day').length + 1;
      current = { phase: 'day', label: `Ngày ${dayNum}`, events: [] };
      days.push(current);
    }

    if (!current) {
      current = { phase: 'night', label: 'Đêm 1', events: [] };
      days.push(current);
    }
    current.events.push(ev);
  }
  return days;
}

export default function SpectatorView({ roomCode, roomData, onBack }) {
  const [activeTab, setActiveTab] = useState('players');
  const [expandedDay, setExpandedDay] = useState(null);

  const players = roomData?.players || [];
  const events  = roomData?.events  || [];
  const phase   = roomData?.phase   || 'waiting';
  const round   = roomData?.round   || 0;

  const timeline = buildTimeline(events);

  // Auto-expand last segment
  useEffect(() => {
    if (timeline.length > 0) setExpandedDay(timeline.length - 1);
  }, [timeline.length]);

  const alive = players.filter(p => p.alive);
  const dead  = players.filter(p => !p.alive);

  return (
    <div style={{
      maxWidth: 720, margin: '0 auto', padding: '16px',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--tm)', fontSize: 13, padding: '4px 0', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>← Quay lại sảnh</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tp)', margin: 0 }}>
            👁 Đang xem phòng <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{roomCode}</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--tm)', margin: '3px 0 0' }}>
            {PHASE_LABELS[phase] || phase} · Vòng {round} · {players.length} người chơi
          </p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 20,
          background: phase === 'night' ? 'rgba(139,92,246,.2)' : 'rgba(251,191,36,.15)',
          border: `1px solid ${phase === 'night' ? 'rgba(139,92,246,.4)' : 'rgba(251,191,36,.3)'}`,
          fontSize: 13, color: phase === 'night' ? '#a78bfa' : '#fbbf24',
          fontWeight: 600,
        }}>
          {PHASE_LABELS[phase] || phase}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10,
        padding: 3, marginBottom: 16, width: 'fit-content',
      }}>
        {[['players', '👥 Người chơi'], ['timeline', '📅 Diễn biến']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--font-body)', transition: 'all .15s',
            background:  activeTab === id ? 'var(--card)' : 'transparent',
            color:       activeTab === id ? 'var(--tp)'  : 'var(--tm)',
            border:      activeTab === id ? '1px solid var(--b1)' : '1px solid transparent',
            fontWeight:  activeTab === id ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* Players tab */}
      {activeTab === 'players' && (
        <div>
          {/* Alive */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', letterSpacing: 1, marginBottom: 8 }}>
            ĐANG SỐNG ({alive.length})
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8, marginBottom: 20,
          }}>
            {alive.map(p => (
              <div key={p.userId} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--surface)', border: '1px solid var(--b1)',
              }}>
                <Avatar name={p.username} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tp)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.username}
                  </p>
                  {p.role ? (
                    <p style={{ fontSize: 10, margin: 0, color: ROLE_COLORS[p.role] || 'var(--tm)' }}>
                      {ROLE_NAMES[p.role] || p.role}
                    </p>
                  ) : (
                    <p style={{ fontSize: 10, margin: 0, color: 'var(--tf)' }}>?</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Dead */}
          {dead.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#f87171', letterSpacing: 1, marginBottom: 8 }}>
                ĐÃ CHẾT ({dead.length})
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8,
              }}>
                {dead.map(p => (
                  <div key={p.userId} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 10, opacity: 0.6,
                    background: 'var(--surface)', border: '1px dashed rgba(248,113,113,.3)',
                  }}>
                    <Avatar name={p.username} size="sm" dead />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'var(--tm)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                        {p.username}
                      </p>
                      {p.role && (
                        <p style={{ fontSize: 10, margin: 0, color: ROLE_COLORS[p.role] || 'var(--tm)' }}>
                          {ROLE_NAMES[p.role] || p.role}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {players.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tf)', fontSize: 13 }}>
              Chưa có dữ liệu người chơi
            </div>
          )}
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <div>
          {timeline.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: 'var(--tf)', fontSize: 13,
              border: '1px dashed var(--b0)', borderRadius: 12,
            }}>
              Ván chưa bắt đầu hoặc chưa có sự kiện nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {timeline.map((segment, idx) => {
                const isExpanded = expandedDay === idx;
                const isNight = segment.phase === 'night';
                const accentColor = isNight ? '#818cf8' : '#fbbf24';
                const bgColor = isNight ? 'rgba(79,70,229,.12)' : 'rgba(251,191,36,.08)';
                const borderColor = isNight ? 'rgba(129,140,248,.3)' : 'rgba(251,191,36,.25)';

                return (
                  <div key={idx} style={{
                    borderRadius: 12, border: `1px solid ${borderColor}`,
                    background: bgColor, overflow: 'hidden',
                  }}>
                    {/* Segment header */}
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{isNight ? '🌙' : '☀️'}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>
                          {segment.label}
                        </span>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: `${accentColor}22`, color: accentColor,
                        }}>
                          {segment.events.length} sự kiện
                        </span>
                        {idx === timeline.length - 1 && (
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 10,
                            background: 'rgba(74,222,128,.15)', color: '#4ade80',
                            fontWeight: 600,
                          }}>HIỆN TẠI</span>
                        )}
                      </div>
                      <span style={{ color: 'var(--tm)', fontSize: 12 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Events list */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 16px 14px',
                        borderTop: `1px solid ${borderColor}`,
                      }}>
                        {segment.events.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--tf)', marginTop: 10 }}>
                            Không có sự kiện nào.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10 }}>
                            {segment.events.map((ev, evIdx) => (
                              <div key={evIdx} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '8px 12px', borderRadius: 8,
                                background: 'rgba(0,0,0,.2)',
                              }}>
                                <div style={{
                                  width: 6, height: 6, borderRadius: '50%',
                                  background: accentColor, flexShrink: 0, marginTop: 5,
                                }} />
                                <span style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.5 }}>
                                  {ev.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Latest events quick view */}
          {events.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--tm)', letterSpacing: 1, marginBottom: 8 }}>
                SỰ KIỆN GẦN NHẤT
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[...events].reverse().slice(0, 5).map((ev, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--surface)', border: '1px solid var(--b0)',
                    fontSize: 12, color: 'var(--ts)',
                  }}>
                    {ev.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
