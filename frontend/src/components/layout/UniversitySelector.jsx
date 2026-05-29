import { useState, useRef, useEffect } from 'react';
import { useUniversity } from '../../contexts/UniversityContext';
import { GraduationCap, ChevronDown, Check } from 'lucide-react';

export default function UniversitySelector({ compact = false }) {
  const { universities, activeUniversity, setActiveUniversityId, loading } = useUniversity();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentUniversity = activeUniversity || universities[0] || null;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (loading) return <div className="university-selector-loading">Carregando...</div>;
  if (!universities.length) return null;
  if (universities.length === 1) {
    return (
      <div className={`university-selector-single ${compact ? 'compact' : 'status-card'}`}>
        <GraduationCap size={14} />
        <span>{currentUniversity?.name}</span>
        {!compact && <small>Universidade ativa</small>}
      </div>
    );
  }

  return (
    <div className={`university-selector ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        className={`university-selector-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Trocar universidade ativa"
        type="button"
      >
        <GraduationCap size={15} />
        <span className="university-selector-name">
          {currentUniversity?.name || 'Selecionar universidade'}
        </span>
        <ChevronDown size={13} className={`university-selector-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="university-selector-dropdown" role="listbox">
          <div className="university-selector-header">
            <small>Universidades disponíveis</small>
          </div>
          {universities.map(u => (
            <button
              key={u.id}
              className={`university-selector-option ${currentUniversity?.id === u.id ? 'active' : ''}`}
              onClick={() => { setActiveUniversityId(u.id); setOpen(false); }}
              role="option"
              aria-selected={currentUniversity?.id === u.id}
              type="button"
            >
              <span className="university-option-info">
                <strong>{u.name}</strong>
                <small>{u.membershipRole || 'vinculo ativo'}</small>
              </span>
              {currentUniversity?.id === u.id && <Check size={14} className="university-option-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
