import { useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

// ─── Button ───────────────────────────────────────────────────────────────────
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#4f7ef4', '#8b5cf6', '#ec4899', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'];
function colorFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

export function Avatar({ initials = '?', size = 40, color, style = {} }) {
  const bg = color || colorFor(initials);
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, background: bg,
        fontSize: size * 0.34, ...style,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  );
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────
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

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, maxWidth = 540 }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
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

// ─── FormField ────────────────────────────────────────────────────────────────
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

// ─── EmptyState ───────────────────────────────────────────────────────────────
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

// ─── IconButton ───────────────────────────────────────────────────────────────
export function IconButton({ icon, onClick, title, style }) {
  return (
    <button className="btn-icon" onClick={onClick} title={title} style={style}>
      {icon}
    </button>
  );
}
