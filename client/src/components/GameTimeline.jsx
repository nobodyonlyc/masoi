import { useState } from 'react';

const PHASE_ICONS = { night: '🌙', discuss: '☀️', vote: '⚖️' };

export default function GameTimeline({ events = [], currentPhase, currentRound }) {
  const [open, setOpen] = useState(false);

  if (!events.length) return null;

  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
          background: 'var(--card)', border: '1px solid var(--b1)',
          color: 'var(--ts)', fontSize: 12, fontFamily: 'var(--font-body)',
        }}
      >
        <span>📅 Diễn biến ván ({events.length} sự kiện)</span>
        <span style={{ color: 'var(--tm)' }}>{open ? '▲ Ẩn' : '▼ Xem'}</span>
      </button>

      {open && (
        <div style={{
          marginTop: 6, padding: '12px 14px',
          background: 'var(--card)', border: '1px solid var(--b1)',
          borderRadius: 10, maxHeight: 260, overflowY: 'auto',
        }}>
          {[...events].reverse().map((ev, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '5px 0',
              borderBottom: i < events.length - 1 ? '1px solid var(--b0)' : 'none',
            }}>
              <span style={{ fontSize: 11, color: 'var(--tf)', flexShrink: 0, paddingTop: 1 }}>
                #{events.length - i}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5 }}>{ev.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
