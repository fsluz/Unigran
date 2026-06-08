import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, authHeaders } from '../../utils/api';

const STORAGE_KEY = 'unigran_cookie_consent';

export default function CookieConsentBanner() {
  const { token, user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    setVisible(localStorage.getItem(STORAGE_KEY) !== '1');
  }, [user]);

  const accept = async () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    if (!token) return;
    await apiFetch('/auth/cookies/accept', {
      method: 'POST',
      headers: authHeaders(token),
    }).catch(() => null);
  };

  if (!visible) return null;

  return (
    <div className="cookie-consent">
      <div>
        <strong>Cookies e privacidade</strong>
        <p>Usamos cookies essenciais para login, seguranca e preferencias.</p>
      </div>
      <button type="button" onClick={accept}>Aceitar</button>
    </div>
  );
}
