# 🐺 Ma Sói Online

Game ma sói multiplayer qua LAN/Internet.  
Stack: React + Vite · Node.js + Socket.IO · PostgreSQL · Redis

---

## 🚀 Dev local (khuyến nghị khi phát triển)

### Yêu cầu
- Docker Desktop (hoặc Docker + WSL2)
- Node.js >= 18

### Bước 1 — Khởi động infra (PostgreSQL + Redis)

```bash
# Chỉ chạy 2 container database, expose ra localhost
docker compose -f docker-compose.dev.yml up -d

# Kiểm tra
docker compose -f docker-compose.dev.yml ps
```

PostgreSQL: `localhost:5432`  
Redis: `localhost:6379`  
(Schema tự động tạo từ `server/db/init.sql` lần đầu)

### Bước 2 — Chạy Server

```bash
cd server
npm install
npm run dev      # nodemon, hot reload tại port 3001
```

### Bước 3 — Chạy Client

```bash
cd client
npm install
npm run dev      # Vite dev server tại http://localhost:5173
```

### Chơi LAN

**Cách hoạt động:**
- Máy host chạy server (port 3001) và Vite dev (port 5173)
- Máy khác trong LAN mở `http://<IP-máy-host>:5173`
- Client tự động kết nối WebSocket đến `http://<IP-máy-host>:3001`
- **Không cần config gì thêm** — `window.location.hostname` tự detect IP

**Tìm IP máy host:**
```bash
# Windows
ipconfig | findstr "IPv4"

# Linux/Mac
ip addr show | grep "inet " | grep -v 127
```

**Firewall (nếu máy khác không vào được):**
```powershell
# Windows — mở port 3001 và 5173
netsh advfirewall firewall add rule name="MaSoi" dir=in action=allow protocol=TCP localport=3001,5173
```
```bash
# Linux
sudo ufw allow 3001/tcp
sudo ufw allow 5173/tcp
```

---

## 🐳 Production (Docker full stack)

```bash
# Build và chạy tất cả (postgres + redis + server + client/nginx)
docker compose up --build -d

# Truy cập tại http://localhost  (hoặc PORT=8080 docker compose up)
```

---

## 📁 Cấu trúc

```
masoi/
├── docker-compose.yml          # Production: full stack
├── docker-compose.dev.yml      # Dev: chỉ postgres + redis
├── server/
│   ├── .env                    # DATABASE_URL, REDIS_URL, PORT
│   ├── index.js
│   ├── gameEngine.js
│   └── db/
│       ├── init.sql
│       ├── postgres.js
│       └── redis.js
└── client/
    ├── .env                    # VITE_SERVER_URL
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── components/  AppShell · Avatar · Chat · PlayerGrid · RoleCard · SoundControl · Stars · Timer
        ├── pages/       LoginPage · LobbyPage · GuidePage · HistoryPage · WaitingRoom · NightPhase · DayPhase · ResultScreen
        ├── hooks/       useSocket · useGame
        └── utils/       sounds.js
```

---

## 🎮 Vai diễn

| Vai | Phe | Kỹ năng |
|-----|-----|---------|
| 🐺 Ma Sói | Sói | Mỗi đêm chọn nạn nhân |
| 👑 Sói Chúa | Sói | Khi bị treo → kéo 1 người theo |
| 🔮 Tiên Tri | Dân | Mỗi đêm xem bài 1 người |
| 💉 Thầy Thuốc | Dân | Mỗi đêm cứu 1 người |
| 🧪 Phù Thủy | Dân | 1 thuốc cứu + 1 thuốc độc |
| 🏹 Thợ Săn | Dân | Khi chết → bắn 1 người theo |
| 🤪 Kẻ Ngốc | Dân | Bị treo → tha + lộ bài |
| 🧑 Dân Làng | Dân | Lý luận thuần túy |

---

## 🌐 Deploy VPS

```bash
docker compose up -d --build
# Đặt Nginx/Caddy reverse proxy phía trước nếu dùng domain + HTTPS
```
