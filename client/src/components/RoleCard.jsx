export const ROLE_DATA = {
  WOLF:     { name:'Ma Sói',    emoji:'🐺', team:'wolf',    desc:'Mỗi đêm cùng phe Sói chọn 1 người để cắn. Target cuối cùng sẽ được tính.' },
  WOLF_KING:{ name:'Sói Chúa',  emoji:'👑', team:'wolf',    desc:'Là Sói. Khi bị treo cổ, kéo theo 1 người chết cùng.' },
  VILLAGER: { name:'Dân Làng',  emoji:'🧑', team:'village', desc:'Dùng lý luận để tìm ra ma sói.' },
  SEER:     { name:'Tiên Tri',  emoji:'🔮', team:'village', desc:'Mỗi đêm xem bài 1 người.' },
  DOCTOR:   { name:'Thầy Thuốc',emoji:'💉', team:'village', desc:'Mỗi đêm bảo vệ 1 người. Có thể tự cứu. Không cứu cùng 1 người 2 đêm liên tiếp.' },
  HUNTER:   { name:'Thợ Săn',   emoji:'🏹', team:'village', desc:'Khi chết, bắn 1 người chết theo.' },
  WITCH:    { name:'Phù Thủy',  emoji:'🧪', team:'village', desc:'1 thuốc cứu + 1 thuốc độc, mỗi thứ dùng 1 lần.' },
  IDIOT:    { name:'Kẻ Ngốc',   emoji:'🤪', team:'village', desc:'Bị treo cổ → được tha và lộ bài.' },
};

export default function RoleCard({ role, roleInfo, compact = false }) {
  const d = ROLE_DATA[role];
  if (!role || !d) return null;
  const wolf = d.team === 'wolf';

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
           style={{
             background: wolf ? 'rgba(127,29,29,0.25)' : 'rgba(109,40,217,0.18)',
             border: `1px solid ${wolf ? 'rgba(248,113,113,0.45)' : 'rgba(139,92,246,0.45)'}`,
           }}>
        <span className="text-2xl">{d.emoji}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color:'var(--tp)' }}>{d.name}</p>
          <p className="text-xs" style={{ color: wolf ? '#f87171' : '#a78bfa' }}>
            {wolf ? 'Phe Ma Sói' : 'Phe Dân Làng'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 text-center animate-glow"
         style={{
           background: wolf ? 'rgba(127,29,29,0.25)' : 'rgba(109,40,217,0.18)',
           border: `1px solid ${wolf ? 'rgba(248,113,113,0.5)' : 'rgba(139,92,246,0.5)'}`,
         }}>
      <div className="text-4xl mb-2 animate-wolf">{d.emoji}</div>
      <p className="text-lg font-bold mb-1" style={{ color:'var(--tp)' }}>{d.name}</p>
      <p className="text-xs font-medium mb-2" style={{ color: wolf ? '#f87171' : '#a78bfa' }}>
        {wolf ? '🐺 Phe Ma Sói' : '🌅 Phe Dân Làng'}
      </p>
      {(roleInfo?.desc || d.desc) && (
        <p className="text-xs leading-relaxed" style={{ color:'var(--ts)' }}>{roleInfo?.desc || d.desc}</p>
      )}
    </div>
  );
}
