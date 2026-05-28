import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // NOTE: Proxy chỉ dùng khi chạy localhost (máy dev tự truy cập)
    // Khi máy LAN khác truy cập, client tự dùng window.location.hostname:3001
    // nên KHÔNG cần proxy socket.io ở đây
    proxy: {
      // Chỉ proxy /api cho trường hợp test localhost → không dùng LAN
      // Khi LAN: API_BASE = http://192.168.x.x:3001 (direct, không qua proxy)
    },
  },
  build: { outDir: 'dist' },
})
