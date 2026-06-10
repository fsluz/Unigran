import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { publishOwnPublicKey } from '../services/e2ee';

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return user;
  return {
    ...user,
    displayName: user.displayName || user.name || user.username,
    profilePicture: user.profilePicture || user.profile_picture || null,
    coverPicture: user.coverPicture || user.cover_picture || null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const rememberTokenKey = 'unigran_token';
  // Token mantido em memória apenas — nunca em localStorage (segurança XSS)
  // O cookie HttpOnly é enviado automaticamente pelo browser via credentials:'include'
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Hidratação inicial via cookie HttpOnly — sem depender de localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(rememberTokenKey);
    apiFetch('/auth/me', {
      headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      timeout: 10000,
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) setUser(normalizeUser(data.user));
        // Restaura token em memória se o backend devolver (compatibilidade Bearer)
        if (data.token) {
          setToken(data.token);
          if (storedToken) localStorage.setItem(rememberTokenKey, data.token);
        } else if (data.user && storedToken) {
          setToken(storedToken);
        }
      })
      .catch(() => {
        localStorage.removeItem(rememberTokenKey);
      })
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

  function login(userData, jwt, remember = false) {
    setUser(normalizeUser(userData));
    // jwt ainda é aceito para compatibilidade com headers Bearer (mobile/API externa)
    // mas o cookie HttpOnly já foi setado pelo backend e é o mecanismo principal
    setToken(jwt);
    if (remember && jwt) localStorage.setItem(rememberTokenKey, jwt);
    else localStorage.removeItem(rememberTokenKey);
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST', timeout: 5000 });
    } catch {}
    setUser(null);
    setToken(null);
    // Limpa resquícios de localStorage de versões anteriores
    localStorage.removeItem('token');
    localStorage.removeItem(rememberTokenKey);
  }

  function updateUser(data) {
    setUser(prev => normalizeUser({ ...prev, ...data }));
  }

  async function refreshUser() {
    try {
      const r = await apiFetch('/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 10000,
      });
      const data = await r.json();
      if (data.user) setUser(normalizeUser(data.user));
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
