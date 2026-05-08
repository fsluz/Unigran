import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, icon = 'OK') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const showError = (message) => showToast(message || 'Erro no site.', '!');
    const onError = (event) => showError(event?.message);
    const onRejection = (event) => showError(event?.reason?.message || String(event?.reason || 'Erro no site.'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="toast">
          <span className="toast-icon">{toast.icon}</span>
          <span className="toast-msg">{toast.msg}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
