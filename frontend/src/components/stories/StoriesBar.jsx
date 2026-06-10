import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Modal, Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { commentStory, createStory, fetchStories, likeStory, viewStory } from '../../services/stories';
import { relativeTime } from '../../utils/time';

const STORY_DURATION_MS = 5000;

function StorySkeletonPill() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div className="skeleton-line" style={{ width: 58, height: 58, borderRadius: '50%' }} />
      <div className="skeleton-line" style={{ width: 44, height: 10, borderRadius: 5 }} />
    </div>
  );
}

export default function StoriesBar({ onOpenProfile }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [comment, setComment] = useState('');
  const [mineMenuOpen, setMineMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);
  const activeVideoRef = useRef(null);
  const progressRef = useRef(null);
  const progressStartRef = useRef(null);

  const myStory = useMemo(() => stories.find(item => item.author?.username === user?.username), [stories, user?.username]);
  const activeStory = activeIndex == null ? null : stories[activeIndex];

  const reload = useCallback(() => {
    if (!token) return;
    fetchStories(token)
      .then(data => { setStories(data); setLoading(false); })
      .catch(() => { setStories([]); setLoading(false); });
  }, [token]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [reload, token]);

  useEffect(() => {
    if (!activeStory?.id) return;
    viewStory({ token, storyId: activeStory.id }).catch(() => null);
  }, [activeStory?.id, token]);

  // Barra de progresso animada
  useEffect(() => {
    if (activeIndex == null || activeStory?.video) {
      setProgress(0);
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
      return;
    }
    setProgress(0);
    progressStartRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - progressStartRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct < 100) {
        progressRef.current = requestAnimationFrame(animate);
      }
    };
    progressRef.current = requestAnimationFrame(animate);
    return () => { if (progressRef.current) cancelAnimationFrame(progressRef.current); };
  }, [activeIndex, activeStory?.id, activeStory?.video]);

  // Auto-avançar stories de imagem/texto
  useEffect(() => {
    if (activeIndex == null || !activeStory || activeStory.video) return undefined;
    const timer = setTimeout(() => {
      setActiveIndex(i => (i == null || i >= stories.length - 1 ? null : i + 1));
    }, STORY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [activeStory?.id, activeStory?.video, stories.length, activeIndex]);

  // Navegação por teclado
  useEffect(() => {
    if (activeIndex == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setActiveIndex(i => Math.min(stories.length - 1, i + 1));
      if (e.key === 'ArrowLeft')  setActiveIndex(i => Math.max(0, i - 1));
      if (e.key === 'Escape')     setActiveIndex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, stories.length]);



  const pick = (e) => {
    const next = e.target.files?.[0];
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const publish = async () => {
    if (publishing) return;
    if (!text.trim() && !file) { showToast('Adicione texto ou mídia', '!'); return; }
    setPublishing(true);
    try {
      const created = await createStory({ token, text: text.trim(), file });
      setStories(prev => [created, ...prev.filter(item => item.id !== created.id)]);
      setText(''); setFile(null); setPreview(null); setCreateOpen(false);
      showToast('Story publicado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao publicar story', '!');
    } finally {
      setPublishing(false);
    }
  };

  const openMine = () => {
    if (myStory) setMineMenuOpen(true);
    else setCreateOpen(true);
  };

  const likeActive = async () => {
    if (!activeStory) return;
    await likeStory({ token, storyId: activeStory.id }).catch(() => null);
    showToast('Curtido', 'OK');
  };

  const sendComment = async () => {
    if (!activeStory || !comment.trim()) return;
    await commentStory({ token, storyId: activeStory.id, content: comment.trim() }).catch(() => null);
    setComment('');
    showToast('Comentário enviado', 'OK');
  };

  const othersStories = stories
    .filter(item => item.author?.username !== user?.username)
    .reduce((acc, story) => {
      const uname = story.author?.username;
      if (!acc.find(s => s.author?.username === uname)) acc.push(story);
      return acc;
    }, []);

  return (
    <>
      <div className="stories-strip">
        {/* Botão do story próprio */}
        <button className="story-pill own" onClick={openMine} aria-label="Seu story">
          <div className="story-avatar-wrap">
            <Avatar size={54} src={user?.profilePicture || null} name={user?.displayName || user?.username || ''} initials={(user?.displayName || user?.username || '?').slice(0, 2)} />
            <span className="story-plus" aria-hidden>+</span>
          </div>
          <span>Seu story</span>
        </button>

        {/* Skeletons enquanto carrega */}
        {loading && [1, 2, 3].map(i => <StorySkeletonPill key={i} />)}

        {/* Stories de outros usuários */}
        {!loading && othersStories.map((story) => {
          const idx = stories.findIndex(item => item.id === story.id);
          return (
            <button key={story.id} className="story-pill" onClick={() => setActiveIndex(idx)} aria-label={`Story de ${story.author?.displayName || story.author?.username}`}>
              <div className="story-avatar-wrap">
                <Avatar size={54} src={story.author?.profilePicture || null} name={story.author?.displayName || story.author?.username || ''} initials={(story.author?.displayName || story.author?.username || '?').slice(0, 2)} />
              </div>
              <span>{story.author?.displayName || story.author?.username}</span>
            </button>
          );
        })}
      </div>

      {/* Modal criar story */}
      {createOpen && (
        <Modal
          title="Novo Story"
          onClose={() => !publishing && setCreateOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={publishing}>Cancelar</Button>
              <Button onClick={publish} disabled={publishing}>
                {publishing ? 'Publicando...' : 'Publicar'}
              </Button>
            </>
          }
        >
          <textarea
            className="form-input"
            rows={3}
            placeholder="Escreva algo para o seu story..."
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={publishing}
          />
          <input ref={fileRef} type="file" accept="image/*,video/*,.gif" style={{ display: 'none' }} onChange={pick} />
          <Button variant="secondary" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()} disabled={publishing}>
            {file ? 'Trocar mídia' : 'Adicionar mídia'}
          </Button>
          {preview && (
            <div className="story-preview" style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', maxHeight: 280 }}>
              {file?.type?.startsWith('video/')
                ? <video src={preview} controls style={{ width: '100%', maxHeight: 280 }} />
                : <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 280, objectFit: 'cover' }} />}
            </div>
          )}
        </Modal>
      )}

      {/* Modal story próprio */}
      {mineMenuOpen && (
        <Modal
          title="Seu story"
          onClose={() => setMineMenuOpen(false)}
          maxWidth={360}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setMineMenuOpen(false); setCreateOpen(true); }}>
                + Novo story
              </Button>
              <Button onClick={() => { setMineMenuOpen(false); setActiveIndex(stories.findIndex(item => item.id === myStory?.id)); }}>
                Ver meu story
              </Button>
            </>
          }
        >
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
            Você já tem um story ativo. O que deseja fazer?
          </p>
        </Modal>
      )}

      {/* Viewer de story */}
      {activeStory && (
        <div
          className="story-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Story de ${activeStory.author?.displayName || activeStory.author?.username}`}
          onClick={e => { if (e.target === e.currentTarget) setActiveIndex(null); }}
        >
          <button className="story-close" onClick={() => setActiveIndex(null)} aria-label="Fechar">x</button>

          <button
            className="story-nav prev"
            onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
            aria-label="Story anterior"
            style={{ opacity: activeIndex === 0 ? 0.3 : 1 }}
          >‹</button>

          <div className="story-frame">
            {/* Barra de progresso */}
            <div className="story-progress-bar" aria-hidden="true">
              <div
                className="story-progress-fill"
                style={{
                  width: activeStory.video ? '100%' : `${progress}%`,
                  transition: activeStory.video ? 'none' : 'none',
                }}
              />
            </div>

            {/* Cabeçalho */}
            <div className="story-head">
              <button
                onClick={() => { activeStory.author?.username && onOpenProfile?.(activeStory.author.username); setActiveIndex(null); }}
                style={{ border: 0, background: 'transparent', padding: 0, display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <Avatar size={38} src={activeStory.author?.profilePicture || null} name={activeStory.author?.displayName || activeStory.author?.username || ''} initials={(activeStory.author?.displayName || activeStory.author?.username || '?').slice(0, 2)} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{activeStory.author?.displayName || activeStory.author?.username}</div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{relativeTime(activeStory.created)}</span>
                </div>
              </button>
            </div>

            {/* Mídia */}
            <div className="story-media">
              {activeStory.video
                ? (
                  <video
                    ref={activeVideoRef}
                    src={activeStory.video}
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: '60vh', borderRadius: 12 }}
                    onEnded={() => setActiveIndex(i => (i == null || i >= stories.length - 1 ? null : i + 1))}
                  />
                )
                : activeStory.image
                  ? <img src={activeStory.image} alt="story" style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover', borderRadius: 12 }} />
                  : <div className="story-text-only">{activeStory.text}</div>}
            </div>

            {/* Legenda */}
            {activeStory.text && (activeStory.image || activeStory.video) && (
              <div className="story-caption">{activeStory.text}</div>
            )}

            {/* Ações */}
            <div className="story-actions">
              <button onClick={likeActive} aria-label="Curtir story" style={{ padding: '8px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>
                Curtir
              </button>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendComment()}
                placeholder="Responder..."
                aria-label="Responder ao story"
                style={{ flex: 1, borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '8px 14px', fontSize: 13 }}
              />
              <button
                onClick={sendComment}
                aria-label="Enviar resposta"
                style={{ padding: '8px 14px', borderRadius: 20, background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Enviar
              </button>
            </div>
          </div>

          <button
            className="story-nav next"
            onClick={() => setActiveIndex(i => Math.min(stories.length - 1, i + 1))}
            aria-label="Próximo story"
            style={{ opacity: activeIndex >= stories.length - 1 ? 0.3 : 1 }}
          >›</button>
        </div>
      )}
    </>
  );
}
