import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

function getServerURL() {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) return envUrl;
  const host = window.location.hostname;
  if (window.location.port === '5173') return `http://${host}:3001`;
  return window.location.origin;
}

export const SERVER_URL = getServerURL();

export function SocketProvider({ children }) {
  const [socket, setSocket]       = useState(null);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState(null);

  useEffect(() => {
    console.log('[socket] connecting to:', SERVER_URL);

    const s = io(SERVER_URL, {
      // FIX: Firefox/Edge không cho WebSocket upgrade qua proxy → dùng polling trước,
      // rồi upgrade lên websocket. Đảo thứ tự so với trước ('websocket','polling').
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.3,
      timeout: 20000,
      withCredentials: false,
      // Upgrade lên websocket sau khi polling connect thành công
      upgrade: true,
    });

    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      setConnError(null);
      console.log('[socket] connected:', s.id, '| transport:', s.io.engine.transport.name);
    });

    s.on('disconnect', (reason) => {
      setConnected(false);
      console.warn('[socket] disconnected:', reason);
      if (reason === 'io server disconnect') {
        s.connect();
      }
    });

    s.on('connect_error', (err) => {
      setConnected(false);
      setConnError(err.message);
      console.warn('[socket] connect_error:', err.message);
    });

    s.on('reconnect', (attempt) => {
      setConnected(true);
      setConnError(null);
      console.log(`[socket] reconnected after ${attempt} attempts`);
    });

    s.on('reconnect_failed', () => {
      setConnError('Không thể kết nối server. Vui lòng tải lại trang.');
      console.error('[socket] reconnect_failed');
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, connError }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
