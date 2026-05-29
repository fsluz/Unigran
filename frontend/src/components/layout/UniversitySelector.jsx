import { useState, useRef, useEffect } from 'react';
import { useUniversity } from '../../contexts/UniversityContext';
import { GraduationCap, ChevronDown, Check } from 'lucide-react';

export default function UniversitySelector({ compact = false }) {
  const { universities, activeUniversity, setActiveUniversityId, loading } = useUniversity();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (loading) return <div className="university-selector-loading">Carregando...</div>;
  if (!universities.length) return null;
  if (universities.length === 1 && compact) {
    return (
      <div className="university-selector-single">
        <GraduationCap size={14} />
        <span>{activeUniversity?.name || universities[0]?.name}</span>
      </div>
    );
  }

  return (
    <div className="university-selector" ref={ref}>
      <button
        className={`university-selector-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Trocar universidade ativa"
        type="button"
      >
        <GraduationCap size={15} />
        <span className="university-selector-name">
          {activeUniversity?.name || 'Selecionar universidade'}
        </span>
        <ChevronDown size={13} className={`university-selector-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="university-selector-dropdown">
          <div className="university-selector-header">
            <small>Universidades disponíveis</small>
          </div>
          {universities.map(u => (
            <button
              key={u.id}
              className={`university-selector-option ${activeUniversity?.id === u.id ? 'active' : ''}`}
              onClick={() => { setActiveUniversityId(u.id); setOpen(false); }}
              type="button"
            >
              <span className="university-option-info">
                <strong>{u.name}</strong>
                <small>{u.membershipRole}</small>
              </span>
              {activeUniversity?.id === u.id && <Check size={14} className="university-option-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
