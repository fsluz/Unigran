export default function CommunityCard({ community, onClick }) {
  return (
    <div className="card comm-card" onClick={onClick}>
      <div className="comm-banner" style={{ background: community.banner }}>
        {community.icon}
      </div>
      <div className="comm-body">
        <div className="comm-name">{community.name}</div>
        <div className="comm-desc">{community.description}</div>
        <div className="comm-meta">
          <span className="comm-members">👥 {community.members.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {community.favorite && <span title="Favorita" style={{ fontSize: 13 }}>⭐</span>}
            {community.muted    && <span title="Silenciada" style={{ fontSize: 13 }}>🔇</span>}
            <span className={`comm-type-badge ${community.type === 'private' ? 'comm-private' : 'comm-public'}`}>
              {community.type === 'private' ? '🔒 Privada' : '🌐 Pública'}
            </span>
            {community.joined && <span className="comm-joined-tick">✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
