import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const UniversityContext = createContext(null);

const STORAGE_KEY = 'unigran:active-university-id';

export function UniversityProvider({ children, token, userRole }) {
  const [universities, setUniversities] = useState([]);
  const [activeUniversityId, setActiveUniversityIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadUniversities = useCallback(async () => {
    if (!token) {
      setUniversities([]);
      setInitialized(true);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/me/universities', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = data.universities || [];
      console.log('[UNIVERSITY] universidades carregadas:', list.map(u => `${u.name}(${u.id}) role=${u.membershipRole}`));
      setUniversities(list);
      const savedId = localStorage.getItem(STORAGE_KEY);
      const savedStillValid = list.some(u => u.id === savedId);
      if (!savedStillValid) {
        const firstId = list[0]?.id || '';
        console.log(`[UNIVERSITY] selecionando automaticamente: "${firstId || 'nenhuma'}"`);
        setActiveUniversityIdState(firstId);
        if (firstId) localStorage.setItem(STORAGE_KEY, firstId);
        else localStorage.removeItem(STORAGE_KEY);
      } else {
        console.log(`[UNIVERSITY] universidade ativa mantida: "${savedId}"`);
      }
    } catch (err) {
      console.error('[UNIVERSITY] erro ao carregar universidades:', err);
      setUniversities([]);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [token]);

  useEffect(() => {
    loadUniversities();
  }, [loadUniversities]);

  const setActiveUniversityId = useCallback((id) => {
    setActiveUniversityIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeUniversity = universities.find(u => u.id === activeUniversityId) || universities[0] || null;

  const activeRole = activeUniversity?.membershipRole || userRole || 'user';

  const hasUniversity = universities.length > 0;

  return (
    <UniversityContext.Provider value={{
      universities,
      activeUniversity,
      activeUniversityId: activeUniversity?.id || '',
      activeRole,
      hasUniversity,
      loading,
      initialized,
      setActiveUniversityId,
      reloadUniversities: loadUniversities,
    }}>
      {children}
    </UniversityContext.Provider>
  );
}

export function useUniversity() {
  return useContext(UniversityContext);
}
