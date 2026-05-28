const ROLES = [
  { emoji:'🐺', name:'Ma Sói',     team:'wolf', color:'rgba(127,29,29,.25)', border:'rgba(248,113,113,.4)', tc:'#fca5a5', desc:'Mỗi đêm chọn 1 người để ăn thịt. Ban ngày giả dạng dân làng.' },
  { emoji:'👑', name:'Sói Chúa',   team:'wolf', color:'rgba(127,29,29,.25)', border:'rgba(248,113,113,.4)', tc:'#fca5a5', desc:'Giống Ma Sói. Khi bị treo cổ, được kéo theo 1 người chết cùng.' },
  { emoji:'🔮', name:'Tiên Tri',   team:'village', color:'var(--adim)', border:'rgba(139,92,246,.4)', tc:'#c4b5fd', desc:'Mỗi đêm xem bài 1 người — biết họ là Sói hay Dân Làng.' },
  { emoji:'💉', name:'Thầy Thuốc', team:'village', color:'var(--adim)', border:'rgba(139,92,246,.4)', tc:'#c4b5fd', desc:'Mỗi đêm cứu 1 người khỏi bị sói ăn. Không được cứu liên tiếp cùng 1 người.' },
  { emoji:'🧪', name:'Phù Thủy',   team:'village', color:'var(--adim)', border:'rgba(139,92,246,.4)', tc:'#c4b5fd', desc:'Có 1 thuốc cứu và 1 thuốc độc, mỗi thứ chỉ dùng được 1 lần trong ván.' },
  { emoji:'🏹', name:'Thợ Săn',    team:'village', color:'var(--adim)', border:'rgba(139,92,246,.4)', tc:'#c4b5fd', desc:'Khi bị loại (bất kỳ lý do), được bắn chết 1 người.' },
  { emoji:'🤪', name:'Kẻ Ngốc',    team:'village', color:'var(--adim)', border:'rgba(139,92,246,.4)', tc:'#c4b5fd', desc:'Nếu dân làng bỏ phiếu treo cổ, được tha và lộ bài. Mất quyền bỏ phiếu.' },
  { emoji:'🧑', name:'Dân Làng',   team:'village', color:'var(--adim)', border:'rgba(139,92,246,.4)', tc:'#c4b5fd', desc:'Không có kỹ năng đặc biệt. Chỉ có lý luận và bỏ phiếu.' },
];

const FLOW = [
  { icon:'🎲', phase:'Bắt đầu', desc:'Host tạo phòng, chia sẻ mã 6 ký tự. Mọi người vào phòng. Host bấm bắt đầu — bài được chia ngẫu nhiên, mỗi người nhận vai riêng.' },
  { icon:'🌙', phase:'Ban đêm', desc:'Làng ngủ. Ma sói bàn bạc và chọn nạn nhân. Tiên tri xem bài 1 người. Thầy thuốc cứu 1 người. Phù thủy dùng thuốc nếu muốn.' },
  { icon:'🌅', phase:'Buổi sáng', desc:'Công bố ai đã chết đêm qua. Người chết lộ vai. Thợ Săn chết sẽ kích hoạt ngay.' },
  { icon:'💬', phase:'Thảo luận', desc:'Tất cả người sống thảo luận tự do trong thời gian quy định. Tiên tri có thể tiết lộ thông tin. Ma sói cần đánh lạc hướng.' },
  { icon:'⚖️', phase:'Bỏ phiếu', desc:'Mỗi người chọn 1 người bị treo cổ. Người nhiều phiếu nhất bị loại — lộ vai. Hòa phiếu thì không ai bị loại.' },
  { icon:'🔁', phase:'Lặp lại', desc:'Quay về đêm tiếp theo. Tiếp tục cho đến khi 1 phe thắng.' },
];

const TIPS = [
  { icon:'🔮', title:'Tiên Tri nên kín đáo', desc:'Không nên lộ bài quá sớm — sói sẽ ưu tiên ăn bạn đêm hôm sau.' },
  { icon:'🐺', title:'Sói nên phân tán nghi ngờ', desc:'Bỏ phiếu cho người mình muốn nhưng cần lý do hợp lý, không bầu lung tung.' },
  { icon:'💉', title:'Thầy thuốc đừng tự cứu liên tục', desc:'Cứu người quan trọng (tiên tri, người bị nghi oan) thay vì luôn cứu mình.' },
  { icon:'💬', title:'Quan sát hành vi', desc:'Ai im lặng bất thường? Ai bỏ phiếu cùng nhau liên tục? Đó là dấu hiệu đáng nghi.' },
];

export default function GuidePage() {
  return (
    <div style={{ maxWidth:680, margin:'0 auto' }} className="animate-fade-in">
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--tp)', marginBottom:4 }}>📖 Hướng dẫn chơi</h1>
      <p style={{ fontSize:13, color:'var(--tm)', marginBottom:24 }}>Nắm rõ luật trước khi vào phòng</p>

      {/* Điều kiện thắng */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
        <div style={{ padding:'14px 16px', background:'rgba(127,29,29,.22)', border:'1px solid rgba(248,113,113,.4)', borderRadius:12 }}>
          <p style={{ fontSize:14, fontWeight:700, color:'#fca5a5', marginBottom:6 }}>🐺 Ma Sói thắng khi...</p>
          <p style={{ fontSize:12, color:'var(--ts)', lineHeight:1.7 }}>Số sói ≥ số dân làng còn sống. Kể cả khi chỉ còn 1 sói và 1 dân.</p>
        </div>
        <div style={{ padding:'14px 16px', background:'rgba(20,83,45,.2)', border:'1px solid rgba(74,222,128,.4)', borderRadius:12 }}>
          <p style={{ fontSize:14, fontWeight:700, color:'#86efac', marginBottom:6 }}>🌅 Dân Làng thắng khi...</p>
          <p style={{ fontSize:12, color:'var(--ts)', lineHeight:1.7 }}>Tất cả ma sói bị loại. Dù còn bao nhiêu dân cũng được.</p>
        </div>
      </div>

      {/* Flow */}
      <p className="label" style={{ marginBottom:10 }}>FLOW MỘT VÁN ĐẤU</p>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
        {FLOW.map((f,i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--b0)', borderRadius:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'var(--card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{f.icon}</div>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--tp)', marginBottom:2 }}>{f.phase}</p>
              <p style={{ fontSize:12, color:'var(--ts)', lineHeight:1.6 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Roles */}
      <p className="label" style={{ marginBottom:10 }}>CÁC VAI DIỄN ({ROLES.length} vai)</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:24 }}>
        {ROLES.map((r,i) => (
          <div key={i} style={{ padding:'10px 12px', background:r.color, border:`1px solid ${r.border}`, borderRadius:10, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:22, flexShrink:0 }}>{r.emoji}</span>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:r.tc, marginBottom:2 }}>{r.name}</p>
              <p style={{ fontSize:11, color:'var(--ts)', lineHeight:1.6 }}>{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <p className="label" style={{ marginBottom:10 }}>MẸO CHƠI HAY</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {TIPS.map((t,i) => (
          <div key={i} style={{ padding:'10px 12px', background:'var(--card)', border:'1px solid var(--b1)', borderRadius:10 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--tp)', marginBottom:4 }}>{t.icon} {t.title}</p>
            <p style={{ fontSize:11, color:'var(--ts)', lineHeight:1.6 }}>{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
