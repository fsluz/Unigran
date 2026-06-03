import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { publishOwnPublicKey } from '../services/e2ee';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  // Token mantido em memória apenas — nunca em localStorage (segurança XSS)
  // O cookie HttpOnly é enviado automaticamente pelo browser via credentials:'include'
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Hidratação inicial via cookie HttpOnly — sem depender de localStorage
  useEffect(() => {
    apiFetch('/auth/me', { timeout: 10000 })
      .then(r => r.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  // Heartbeat de presença — 60s é suficiente para manter "online"
  useEffect(() => {
    if (!user) return undefined;
    const ping = () => apiFetch('/conversations/online/heartbeat', {
      method: 'POST',
      timeout: 5000,
    }).catch(() => null);
    ping();
    const interval = setInterval(ping, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!token || !user?.username) return;
    publishOwnPublicKey(token).catch(() => null);
  }, [token, user?.username]);

  function login(userData, jwt) {
    setUser(userData);
    // jwt ainda é aceito para compatibilidade com headers Bearer (mobile/API externa)
    // mas o cookie HttpOnly já foi setado pelo backend e é o mecanismo principal
    setToken(jwt);
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST', timeout: 5000 });
    } catch {}
    setUser(null);
    setToken(null);
    // Limpa resquícios de localStorage de versões anteriores
    localStorage.removeItem('token');
  }

  function updateUser(data) {
    setUser(prev => ({ ...prev, ...data }));
  }

  async function refreshUser() {
    try {
      const r = await apiFetch('/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 10000,
      });
      const data = await r.json();
      if (data.user) setUser(data.user);
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
