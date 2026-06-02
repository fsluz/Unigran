import { useEffect, useRef, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

const EMOJI_CATEGORIES = [
  { label: '😀', name: 'Rostos', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { label: '👋', name: 'Gestos', emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','👀','👁','👅','🦷','💋','👄'] },
  { label: '❤️', name: 'Símbolos', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💯','🔥','✨','⭐','🌟','💫','⚡','🎉','🎊','🎈','🏆','🥇','👑','💎','🌈','☀️','🌙','⚽','🎮','🎵','🎶','📚','💡','🔑','💰','🎯','🚀','🌍'] },
  { label: '🐶', name: 'Animais', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🦂','🐢','🐍','🦎','🐊','🦕','🦖','🐋','🐳','🐬','🦭','🐟','🐠','🐡','🦈','🐙','🦑','🦐','🦞','🦀','🐡'] },
  { label: '🍕', name: 'Comida', emojis: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🥞','🧇','🥐','🥖','🍞','🥨','🧀','🥗','🥙','🧆','🥙','🌮','🌯','🥪','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🎂','🍰','🥧','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🧃','🥤','☕','🍵','🧋','🍶'] },
  { label: '⚽', name: 'Atividades', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥊','🎽','🛹','🛷','⛸️','🥅','⛳','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪃','🎱','🏹','🎸','🎺','🎻','🥁','🎬','🎭','🎨','🎪','🤹','🎠','🎡','🎢','🎟️','🎪'] },
];

export default function EmojiPicker({ onSelect, trigger }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const filtered = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => {
        try { return e.includes(search); } catch { return false; }
      })
    : EMOJI_CATEGORIES[category].emojis;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
        {trigger || (
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '4px 6px', borderRadius: 6, color: 'var(--text-muted)' }} aria-label="Emojis">
            😊
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 999,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 10, width: 280, boxShadow: 'var(--shadow)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* Busca */}
          <input
            type="text"
            placeholder="Buscar emoji..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input"
            style={{ padding: '6px 10px', fontSize: 13 }}
            autoFocus
          />

          {/* Categorias */}
          {!search && (
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCategory(i)}
                  style={{
                    fontSize: 16, padding: '4px 8px', borderRadius: 6, border: 'none',
                    background: category === i ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                  title={cat.name}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Grade de emojis */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 2, maxHeight: 180, overflowY: 'auto',
          }}>
            {filtered.map((emoji, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onSelect(emoji); setOpen(false); setSearch(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, padding: '4px', borderRadius: 6, lineHeight: 1,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ gridColumn: 'span 8', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>
                Nenhum emoji encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
