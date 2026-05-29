import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { publishOwnPublicKey } from '../services/e2ee';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  useEffect(() => {
    if (!token) return;
    apiFetch('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) setUser(data.user);
        else {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const ping = () => apiFetch('/conversations/online/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    ping();
    const interval = setInterval(ping, 25000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || !user?.username) return;
    publishOwnPublicKey(token).catch(() => null);
  }, [token, user?.username]);

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('token', jwt);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  }

  function updateUser(data) {
    setUser(prev => ({ ...prev, ...data }));
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const r = await apiFetch('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.user) setUser(data.user);
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
