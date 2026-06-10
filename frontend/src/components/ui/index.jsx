import { useRef } from 'react';

// Spinner — substitui textos "Carregando..."
export function Spinner({ size = 20, color = 'currentColor', label = 'Carregando' }) {
  return (
    <span className="unigran-spinner" style={{ width: size, height: size, '--spinner-color': color }} role="status" aria-label={label}>
      <span />
    </span>
  );
}

export function UnigranLoader({
  title = 'Carregando Unigran',
  subtitle = 'Preparando sua experiência acadêmica.',
  fullScreen = false,
  compact = false,
}) {
  return (
    <div className={`unigran-loader ${fullScreen ? 'is-fullscreen' : ''} ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
      <div className="unigran-loader-mark" aria-hidden="true">
        <span className="unigran-loader-u">U</span>
        <span className="unigran-loader-orbit orbit-a" />
        <span className="unigran-loader-orbit orbit-b" />
      </div>
      <div className="unigran-loader-copy">
        <strong>{title}</strong>
        {!compact && <span>{subtitle}</span>}
      </div>
      <div className="unigran-loader-bar" aria-hidden="true"><span /></div>
    </div>
  );
}

// SkeletonLine — placeholder animado para conteúdo que está carregando
export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return (
    <div
      className="skeleton-line"
      style={{ width, height, borderRadius: height / 2, ...style }}
      aria-hidden="true"
    />
  );
}

// SkeletonCard — bloco de carregamento para posts/cards
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card unigran-skeleton-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="skeleton-line" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLine width="40%" height={12} />
          <SkeletonLine width="25%" height={10} />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <SkeletonLine width={60} height={30} style={{ borderRadius: 8 }} />
        <SkeletonLine width={60} height={30} style={{ borderRadius: 8 }} />
        <SkeletonLine width={60} height={30} style={{ borderRadius: 8 }} />
      </div>
    </div>
  );
}
import { useClickOutside } from '../../hooks/useClickOutside';

//  Button 
export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style, className = '' }) {
  const sizes = { sm: 'btn-sm', xs: 'btn-xs', md: '', icon: 'btn-icon' };
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${sizes[size] || ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

//  Avatar 
const AVATAR_COLORS = ['#4f7ef4', '#8b5cf6', '#ec4899', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'];
function colorFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

export function Avatar({ initials = '?', name = '', src = null, size = 40, color, imageFit = 'cover', style = {} }) {
  const fallbackInitials = initials || (name ? name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : '?');
  const bg = color || colorFor(fallbackInitials);
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, background: bg,
        backgroundImage: src ? `url(${src})` : undefined,
        backgroundSize: src ? imageFit : undefined,
        backgroundPosition: src ? 'center' : undefined,
        backgroundRepeat: src ? 'no-repeat' : undefined,
        fontSize: size * 0.34, ...style,
      }}
    >
      {src ? '' : fallbackInitials}
    </div>
  );
}

//  Toggle 
export function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  );
}

//  RoleBadge 
const ROLE_MAP = {
  super_admin: { label: 'Admin Global', cls: 'role-admin' },
  admin:     { label: 'Admin Institucional', cls: 'role-admin' },
  social_admin: { label: 'Admin Social', cls: 'role-moderator' },
  moderator: { label: 'Mod',       cls: 'role-moderator' },
  professor: { label: 'Professor', cls: 'role-professor' },
  company:   { label: 'Empresa',   cls: 'role-company' },
};
export function RoleBadge({ role }) {
  const r = ROLE_MAP[role];
  if (!r) return null;
  return <span className={`role-badge ${r.cls}`}>{r.label}</span>;
}

//  Modal 
export function Modal({
  title,
  onClose,
  children,
  footer,
  maxWidth = 540,
  hideHeader = false,
  className = '',
  bodyClassName = '',
  backdropClassName = '',
}) {
  return (
    <div
      className={`modal-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal-box${className ? ` ${className}` : ''}`} style={{ maxWidth }}>
        {!hideHeader && (
          <div className="modal-header">
            <span className="modal-title">{title}</span>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
        )}
        <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

//  Dropdown 
export function Dropdown({ trigger, items, isOpen, onToggle, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, () => isOpen && onClose?.());

  return (
    <div className="dropdown-wrap" ref={ref}>
      <div onClick={onToggle}>{trigger}</div>
      {isOpen && (
        <div className="dropdown-menu">
          {items.map((item, i) =>
            item === 'sep'
              ? <div key={i} className="dropdown-sep" />
              : (
                <button
                  key={i}
                  className={`dropdown-item ${item.danger ? 'danger' : ''}`}
                  onClick={() => { item.onClick?.(); onClose?.(); }}
                >
                  {item.icon && <span>{item.icon}</span>}
                  {item.label}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}

//  FormField 
export function FormField({ label, hint, error, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {hint  && !error && <div className="form-hint">{hint}</div>}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

export function TextInput({ type = 'text', placeholder, value, onChange, onKeyDown, disabled, prefix, autoFocus, name }) {
  return (
    <div className="form-input-prefix-wrap">
      {prefix && <span className="form-input-prefix">{prefix}</span>}
      <input
        type={type}
        name={name}
        className={`form-input${prefix ? ' has-prefix' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </div>
  );
}

export function TextareaInput({ placeholder, value, onChange, rows = 3 }) {
  return (
    <textarea
      className="form-input"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
    />
  );
}

export function SelectInput({ value, onChange, options }) {
  return (
    <select
      className="form-input"
      style={{ width: 'auto', padding: '8px 12px' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

//  EmptyState 
export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-sub">{subtitle}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

//  IconButton 
export function IconButton({ icon, onClick, title, style }) {
  return (
    <button className="btn-icon" onClick={onClick} title={title} style={style}>
      {icon}
    </button>
  );
}

