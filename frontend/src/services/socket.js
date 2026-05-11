import { io } from 'socket.io-client';
import { API_BASE_URL } from '../utils/api';

let socket = null;

function socketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (API_BASE_URL) return API_BASE_URL.replace(/\/api\/?$/, '');
  if (import.meta.env.DEV) return 'http://localhost:3001';
  return window.location.origin;
}

export function getSocket(token) {
  if (socket?.connected && socket.auth?.token === token) return socket;
  if (socket) socket.disconnect();
  socket = io(socketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function closeSocket() {
  if (socket) socket.disconnect();
  socket = null;
}
