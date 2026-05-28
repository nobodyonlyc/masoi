const ROLES = {
  WOLF:     { id:'WOLF',      name:'Ma Sói',     team:'wolf',    emoji:'🐺', desc:'Mỗi đêm cùng phe Sói chọn 1 người để cắn. Target cuối cùng sẽ được tính.' },
  WOLF_KING:{ id:'WOLF_KING', name:'Sói Chúa',   team:'wolf',    emoji:'👑', desc:'Là Sói. Khi bị treo cổ, kéo theo 1 người chết cùng.' },
  VILLAGER: { id:'VILLAGER',  name:'Dân Làng',   team:'village', emoji:'🧑', desc:'Dùng lý luận tìm ra ma sói.' },
  SEER:     { id:'SEER',      name:'Tiên Tri',   team:'village', emoji:'🔮', desc:'Mỗi đêm xem bài 1 người còn sống.' },
  DOCTOR:   { id:'DOCTOR',    name:'Thầy Thuốc', team:'village', emoji:'💉', desc:'Mỗi đêm bảo vệ 1 người. Có thể tự cứu. Không cứu cùng 1 người 2 đêm liên tiếp.' },
  HUNTER:   { id:'HUNTER',    name:'Thợ Săn',    team:'village', emoji:'🏹', desc:'Khi bị loại, bắn chết 1 người ngay lập tức.' },
  WITCH:    { id:'WITCH',     name:'Phù Thủy',   team:'village', emoji:'🧪', desc:'Biết ai bị sói tấn công. 1 thuốc cứu + 1 thuốc độc, mỗi thứ 1 lần.' },
  IDIOT:    { id:'IDIOT',     name:'Kẻ Ngốc',    team:'village', emoji:'🤪', desc:'Nếu dân bỏ phiếu treo cổ, được tha và lộ bài. Mất quyền bỏ phiếu.' },
};

/**
 * Tính số ma sói hợp lệ cho n người:
 *   - Tối thiểu 1, tối đa 3
 *   - Wolves < n/2 (không chiếm từ nửa trở lên khi bắt đầu)
 *
 * Bảng kết quả:
 *   4-5  → 1 wolf
 *   6-9  → 2 wolves
 *   10+  → 3 wolves
 */
function calcWolfCount(n) {
  if (n >= 10) return 3;
  if (n >= 6) return 2;
  return 1;
}

/**
 * Tạo danh sách role chính xác đúng n phần tử.
 * Khi customRoles được truyền từ host, vẫn validate & sửa cho hợp lệ.
 */
function getRoleConfig(n, customRoles) {
  // Nếu có customRoles, validate rồi trả về
  if (customRoles && Array.isArray(customRoles) && customRoles.length > 0) {
    return sanitizeCustomRoles(customRoles, n);
  }

  const wolfCount = calcWolfCount(n);

  // Wolf roles: WOLF_KING chỉ xuất hiện mặc định từ 10 người trở lên.
  const wolfRoles = [];
  if (n >= 10 && wolfCount >= 3) {
    wolfRoles.push('WOLF_KING');
    for (let i = 1; i < wolfCount; i++) wolfRoles.push('WOLF');
  } else {
    for (let i = 0; i < wolfCount; i++) wolfRoles.push('WOLF');
  }

  // Village special roles thêm dần theo số người
  const specials = ['SEER']; // luôn có Tiên Tri
  if (n >= 5)  specials.push('DOCTOR');
  if (n >= 7)  specials.push('WITCH');
  if (n >= 9)  specials.push('HUNTER');
  if (n >= 10) specials.push('IDIOT');

  // Fill phần còn lại bằng VILLAGER
  const villagerCount = n - wolfRoles.length - specials.length;
  const villagers = Array(Math.max(0, villagerCount)).fill('VILLAGER');

  return [...wolfRoles, ...specials, ...villagers];
}

/**
 * Validate & sửa customRoles sao cho:
 *   1. Đúng n phần tử (bỏ bớt hoặc thêm VILLAGER)
 *   2. Luôn có ít nhất 1 wolf
 *   3. wolves < n/2
 *   4. wolves <= 3
 */
function sanitizeCustomRoles(roles, n) {
  const isWolfRole = r => ['WOLF','WOLF_KING'].includes(r);
  const validRoles = new Set(Object.keys(ROLES));

  // Lọc role hợp lệ, pad hoặc trim về đúng n
  let list = roles.filter(r => validRoles.has(r));
  while (list.length < n) list.push('VILLAGER');
  list = list.slice(0, n);

  // Đảm bảo có ít nhất 1 wolf
  const wolfCount = list.filter(isWolfRole).length;
  if (wolfCount === 0) {
    // Thay VILLAGER đầu tiên thành WOLF
    const vi = list.indexOf('VILLAGER');
    list[vi >= 0 ? vi : 0] = 'WOLF';
  }

  // Đảm bảo wolves <= 3 và wolves < n/2
  let wc = list.filter(isWolfRole).length;
  const maxWolves = Math.min(3, Math.ceil(n / 2) - 1);
  while (wc > maxWolves) {
    const wi = list.lastIndexOf('WOLF') >= 0 ? list.lastIndexOf('WOLF') : list.lastIndexOf('WOLF_KING');
    list[wi] = 'VILLAGER';
    wc = list.filter(isWolfRole).length;
  }

  return list;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignRoles(players, customRoles) {
  const n = players.length;
  const roleList = getRoleConfig(n, customRoles);

  // Kiểm tra final safety — roleList phải đúng n phần tử
  if (roleList.length !== n) {
    console.error(`[assignRoles] roleList.length=${roleList.length} !== n=${n}, padding...`);
    while (roleList.length < n) roleList.push('VILLAGER');
  }

  const shuffled = shuffle(roleList);
  return players.reduce((acc, p, i) => {
    acc[p.id] = shuffled[i];
    return acc;
  }, {});
}

function checkWinCondition(players) {
  const alive  = players.filter(p => p.alive);
  const wolves = alive.filter(p => ['WOLF','WOLF_KING'].includes(p.role));
  const others = alive.filter(p => !['WOLF','WOLF_KING'].includes(p.role));
  if (wolves.length === 0)            return { winner:'village', reason:'Tất cả ma sói đã bị tiêu diệt!' };
  if (wolves.length >= others.length) return { winner:'wolf',    reason:'Ma sói đã chiếm đa số làng!' };
  return null;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length:6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = { ROLES, assignRoles, checkWinCondition, generateRoomCode, getRoleConfig, calcWolfCount };
