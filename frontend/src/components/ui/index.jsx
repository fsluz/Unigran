import { useRef } from 'react';
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

const DEFAULT_AVATARS = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560"><rect width="560" height="560" fill="#fff"/><g fill="#000"><path d="M122 338c45 28 99 30 144 0 10-7 22 5 16 17-30 59-123 60-160 6-7-10-7-18 0-23Z"/><path d="M170 205c27-32 75-34 104-5 10 10 7 26-8 29-40 8-74 13-102 12-20-1-25-21-10-36h16Z"/><path d="M386 205c-27-32-75-34-104-5-10 10-7 26 8 29 40 8 74 13 102 12 20-1 25-21 10-36h-16Z"/><path d="M310 268c8 42 24 76 41 113 11 24-7 54-34 54h-74c-27 0-45-30-34-54 17-37 33-71 41-113 5-29 55-29 60 0Z"/></g></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560"><rect width="560" height="560" fill="#fff"/><g fill="#000"><path d="M120 348c35-13 63-8 86 15 24 23 69 24 96 0 23-22 52-26 90-12-16 78-86 121-151 105-57-14-101-52-121-108Z"/><path d="M139 202c35-33 92-36 130-9 14 10 9 31-8 34-48 8-89 10-124 6-16-2-11-20 2-31Z"/><path d="M421 202c-35-33-92-36-130-9-14 10-9 31 8 34 48 8 89 10 124 6 16-2 11-20-2-31Z"/><circle cx="206" cy="268" r="28"/><circle cx="354" cy="268" r="28"/></g></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560"><rect width="560" height="560" fill="#fff"/><g fill="#000"><path d="M150 355c56 27 114 26 174-2 22-10 40 16 25 35-37 49-112 72-175 38-23-12-40-30-51-55-7-15 12-23 27-16Z"/><path d="M120 198c45-40 102-49 171-27 11 4 11 20 0 24-56 21-112 31-169 30-15 0-15-17-2-27Z"/><path d="M440 198c-45-40-102-49-171-27-11 4-11 20 0 24 56 21 112 31 169 30 15 0 15-17 2-27Z"/><path d="M283 251c18 45 30 89 37 132 3 18-11 34-29 34h-22c-18 0-32-16-29-34 7-43 19-87 37-132h6Z"/></g></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560"><rect width="560" height="560" fill="#fff"/><g fill="#000"><path d="M163 350c72 31 140 31 203 0 12-6 24 7 17 19-35 60-124 94-200 48-20-12-34-29-43-49-5-12 10-23 23-18Z"/><path d="M129 210c43-28 92-31 147-9 14 6 13 25-2 29-48 13-94 17-138 12-16-2-20-23-7-32Z"/><path d="M431 210c-43-28-92-31-147-9-14 6-13 25 2 29 48 13 94 17 138 12 16-2 20-23 7-32Z"/><path d="M252 292h56c13 0 21 13 16 25l-27 64c-7 18-29 18-36 0l-25-64c-5-12 3-25 16-25Z"/></g></svg>',
];

function avatarFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) % DEFAULT_AVATARS.length;
  return `url("data:image/svg+xml,${encodeURIComponent(DEFAULT_AVATARS[Math.abs(h)])}")`;
}

export function Avatar({ initials = '?', name = '', src = null, size = 40, color, style = {} }) {
  const fallbackInitials = initials || (name ? name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : '?');
  const bg = color || colorFor(fallbackInitials);
  const hasPhoto = Boolean(src);
  return (
    <div
      className={`avatar ${hasPhoto ? '' : 'avatar-default'}`}
      style={{
        width: size, height: size, background: hasPhoto ? bg : '#fff',
        backgroundImage: hasPhoto ? `url(${src})` : avatarFor(name || fallbackInitials),
        backgroundSize: 'cover',
        backgroundPosition: src ? 'center' : undefined,
        fontSize: size * 0.34, ...style,
      }}
    >
      {hasPhoto ? '' : null}
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
  admin:     { label: 'Admin',     cls: 'role-admin' },
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
export function Modal({ title, onClose, children, footer, maxWidth = 540 }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">{children}</div>
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

