import { useState } from 'react';
import { sounds } from '../utils/sounds';

export default function SoundControl() {
  const [muted, setMuted] = useState(sounds.isMuted());
  const [vol, setVol] = useState(Math.round(sounds.getVolume() * 100));
  const [open, setOpen] = useState(false);

  const toggleMute = () => { const m = sounds.toggleMute(); setMuted(m); };
  const changeVol = e => { const v = parseInt(e.target.value); setVol(v); sounds.setVolume(v/100); };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(o=>!o); sounds.click(); }}
        className="btn btn-ghost"
        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', color:'var(--ts)' }}>
        {muted ? '🔇' : vol > 50 ? '🔊' : '🔉'}
        <span className="text-xs hidden sm:inline" style={{ color:'var(--tm)' }}>Âm thanh</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 max-w-[calc(100vw-1rem)] rounded-xl p-3 z-50 animate-fade-in"
             style={{ background:'var(--card)', border:'1px solid var(--b1)', boxShadow:'0 12px 40px rgba(0,0,0,0.5)' }}>
          <p className="label mb-3">ÂM THANH</p>
          <div className="flex items-center gap-2 mb-3 min-w-0">
            <button onClick={toggleMute} className="text-lg hover:scale-110 transition-transform"
                    style={{ opacity: muted ? 0.5 : 1 }}>
              {muted ? '🔇' : '🔊'}
            </button>
            <input type="range" min="0" max="100" value={vol} onChange={changeVol}
              disabled={muted} className="min-w-0 flex-1 accent-purple-500 disabled:opacity-40" />
            <span className="text-xs w-8 shrink-0 text-right" style={{ color:'var(--tm)' }}>{vol}%</span>
          </div>
          <p className="label mb-2">THỬ ÂM THANH</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              ['🐺 Sói hú', ()=>sounds.wolfHowl()],
              ['🌙 Đêm', ()=>sounds.nightFall()],
              ['🌅 Ngày', ()=>{ sounds.stopAmbience(); sounds.dayBreak(); }],
              ['💀 Chết', ()=>sounds.death()],
              ['⚖️ Bỏ phiếu', ()=>sounds.votePhase()],
              ['🏆 Thắng', ()=>sounds.villageWin()],
            ].map(([label, fn]) => (
              <button key={label} onClick={fn}
                className="text-left text-xs px-2 py-1.5 rounded-lg transition-all"
                style={{ color:'var(--ts)', border:'1px solid var(--b0)' }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--input-bg)'; e.currentTarget.style.color='var(--tp)'; }}
                onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.color='var(--ts)'; }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
