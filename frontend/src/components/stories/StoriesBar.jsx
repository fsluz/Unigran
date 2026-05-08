import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Modal, Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { commentStory, createStory, fetchStories, likeStory, viewStory } from '../../services/stories';
import { relativeTime } from '../../utils/time';

export default function StoriesBar({ onOpenProfile }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [comment, setComment] = useState('');
  const fileRef = useRef(null);

  const myStory = useMemo(() => stories.find(item => item.author?.username === user?.username), [stories, user?.username]);
  const activeStory = activeIndex == null ? null : stories[activeIndex];

  const reload = () => {
    if (!token) return;
    fetchStories(token).then(setStories).catch(() => setStories([]));
  };

  useEffect(reload, [token]);

  useEffect(() => {
    if (!activeStory?.id) return;
    viewStory({ token, storyId: activeStory.id }).catch(() => null);
  }, [activeStory?.id, token]);

  useEffect(() => {
    if (activeIndex == null) return;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') setActiveIndex(i => Math.min(stories.length - 1, i + 1));
      if (event.key === 'ArrowLeft') setActiveIndex(i => Math.max(0, i - 1));
      if (event.key === 'Escape') setActiveIndex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, stories.length]);

  const pick = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const publish = async () => {
    if (!text.trim() && !file) return;
    try {
      const created = await createStory({ token, text: text.trim(), file });
      setStories(prev => [created, ...prev.filter(item => item.id !== created.id)]);
      setText('');
      setFile(null);
      setPreview(null);
      setCreateOpen(false);
      showToast('Story publicado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao publicar story', '!');
    }
  };

  const openMine = () => {
    if (myStory) setActiveIndex(stories.findIndex(item => item.id === myStory.id));
    else setCreateOpen(true);
  };

  const likeActive = async () => {
    if (!activeStory) return;
    await likeStory({ token, storyId: activeStory.id }).catch(() => null);
    showToast('Story curtido', 'OK');
  };

  const sendComment = async () => {
    if (!activeStory || !comment.trim()) return;
    await commentStory({ token, storyId: activeStory.id, content: comment.trim() }).catch(() => null);
    setComment('');
    showToast('Comentario enviado', 'OK');
  };

  return (
    <>
      <div className="stories-strip">
        <button className="story-pill own" onClick={openMine}>
          <div className="story-avatar-wrap">
            <Avatar size={54} src={user?.profilePicture || null} name={user?.displayName || user?.username || ''} initials={(user?.displayName || user?.username || '?').slice(0, 2)} />
            <span className="story-plus">+</span>
          </div>
          <span>Seu story</span>
        </button>

        {stories.filter(item => item.author?.username !== user?.username).map((story) => {
          const idx = stories.findIndex(item => item.id === story.id);
          return (
            <button key={story.id} className="story-pill" onClick={() => setActiveIndex(idx)}>
              <div className="story-avatar-wrap">
                <Avatar size={54} src={story.author?.profilePicture || null} name={story.author?.displayName || story.author?.username || ''} initials={(story.author?.displayName || story.author?.username || '?').slice(0, 2)} />
              </div>
              <span>{story.author?.displayName || story.author?.username}</span>
            </button>
          );
        })}
      </div>

      {createOpen && (
        <Modal title="Novo story" onClose={() => setCreateOpen(false)} footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={publish}>Publicar</Button></>}>
          <textarea className="form-input" rows={3} placeholder="Texto do story" value={text} onChange={e => setText(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*,video/*,.gif" style={{ display: 'none' }} onChange={pick} />
          <Button variant="secondary" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>Escolher midia</Button>
          {preview && (
            <div className="story-preview">
              {file?.type?.startsWith('video/')
                ? <video src={preview} controls />
                : <img src={preview} alt="preview" />}
            </div>
          )}
        </Modal>
      )}

      {activeStory && (
        <div className="story-viewer" onClick={(event) => {
          if (event.target === event.currentTarget) setActiveIndex(i => Math.min(stories.length - 1, i + 1));
        }}>
          <button className="story-close" onClick={() => setActiveIndex(null)}>x</button>
          <button className="story-nav prev" onClick={() => setActiveIndex(i => Math.max(0, i - 1))}></button>
          <div className="story-frame">
            <div className="story-head">
              <button onClick={() => activeStory.author?.username && onOpenProfile?.(activeStory.author.username)}>
                <Avatar size={38} src={activeStory.author?.profilePicture || null} name={activeStory.author?.displayName || activeStory.author?.username || ''} initials={(activeStory.author?.displayName || activeStory.author?.username || '?').slice(0, 2)} />
              </button>
              <div>
                <div>{activeStory.author?.displayName || activeStory.author?.username}</div>
                <span>{relativeTime(activeStory.created)}</span>
              </div>
            </div>
            <div className="story-media">
              {activeStory.video
                ? <video src={activeStory.video} controls autoPlay />
                : activeStory.image
                  ? <img src={activeStory.image} alt="story" />
                  : <div className="story-text-only">{activeStory.text}</div>}
            </div>
            {activeStory.text && (activeStory.image || activeStory.video) && <div className="story-caption">{activeStory.text}</div>}
            <div className="story-actions">
              <button onClick={likeActive}>Curtir</button>
              <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendComment()} placeholder="Comentar..." />
              <button onClick={sendComment}>Enviar</button>
            </div>
          </div>
          <button className="story-nav next" onClick={() => setActiveIndex(i => Math.min(stories.length - 1, i + 1))}>&gt;</button>
        </div>
      )}
    </>
  );
}





