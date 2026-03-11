export default function Topbar({ title, left, right }) {
  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {left}
        <span className="topbar-title">{title}</span>
      </div>
      {right && <div className="topbar-actions">{right}</div>}
    </div>
  );
}
