// Tự động detect API base URL — cùng logic với useSocket
function getAPIBase() {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) return envUrl;
  const host = window.location.hostname;
  if (window.location.port === '5173') return `http://${host}:3001`;
  return window.location.origin;
}

export const API_BASE = getAPIBase();

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res;
}
