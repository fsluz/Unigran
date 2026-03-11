import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar, RoleBadge, Modal, Button } from '../ui';
import { MOCK_COMMENTS } from '../../data/mock';

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '😡', '👏', '🔥', '💯'];

function formatContent(text) {
  return text.split(/(\s+)/).map((word, i) =>
    word.startsWith('#')
      ? <span key={i} className="post-hashtag">{word}</span>
      : word
  );
}

export default function PostDetailModal({ post, onClose }) {
  const { user }     = useAuth();
  const [comments, setComments]     = useState(MOCK_COMMENTS);
  const [newText, setNewText]       = useState('');
  const [emojiFor, setEmojiFor]     = useState(null);

  const addComment = () => {
    if (!newText.trim()) return;
    setComments(prev => [
      ...prev,
      { id: `c${Date.now()}`, author: { displayName: user.displayName, avatar: user.avatar }, text: newText.trim(), likes: 0, liked: false, reactions: [] },
    ]);
    setNewText('');
  };

  const toggleCommentLike = id =>
    setComments(prev => prev.map(c =>
      c.id === id ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 } : c
    ));

  const addReaction = (cid, emoji) => {
    setComments(prev => prev.map(c => {
      if (c.id !== cid) return c;
      const has = c.reactions.includes(emoji);
      return { ...c, reactions: has ? c.reactions.filter(e => e !== emoji) : [...c.reactions, emoji] };
    }));
    setEmojiFor(null);
  };

  const deleteComment = id => setComments(prev => prev.filter(c => c.id !== id));

  const canDeleteComment = (comment) =>
    user?.id === comment.authorId || user?.role === 'admin' || user?.displayName === comment.author.displayName;

  return (
    <Modal title="Post" onClose={onClose}>
      {/* Post header */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
        <Avatar initials={post.author.avatar} size={42} />
        <div>
          <div className="post-author-name">
            {post.author.displayName}
            <RoleBadge role={post.author.role} />
          </div>
          <div className="post-author-sub">@{post.author.username} · {post.time}</div>
        </div>
      </div>

      {/* Post content */}
      <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)', marginBottom: 14 }}>
        {formatContent(post.content)}
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-muted)', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <span>❤️ {post.likes} curtidas</span>
        <span>💬 {post.comments} comentários</span>
      </div>

      {/* Comments */}
      <div className="comment-list">
        {comments.map(c => (
          <div key={c.id} className="comment-row">
            <Avatar initials={c.author.avatar} size={32} />
            <div style={{ flex: 1 }}>
              <div className="comment-bubble">
                <div className="comment-bubble-author">{c.author.displayName}</div>
                <div className="comment-bubble-text">{c.text}</div>
                {c.reactions.length > 0 && (
                  <div className="comment-reactions">
                    {c.reactions.map(e => (
                      <span key={e} className="reaction-pill active">{e}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="comment-actions-row">
                <button className={`comment-action ${c.liked ? 'liked' : ''}`} onClick={() => toggleCommentLike(c.id)}>
                  {c.liked ? '❤️' : '♡'} {c.likes > 0 ? c.likes : ''}
                </button>
                <button className="comment-action" onClick={() => setEmojiFor(emojiFor === c.id ? null : c.id)}>
                  😊 Reagir
                </button>
                {canDeleteComment(c) && (
                  <button className="comment-action" style={{ color: 'var(--red)' }} onClick={() => deleteComment(c.id)}>
                    🗑️
                  </button>
                )}
              </div>
              {emojiFor === c.id && (
                <div className="emoji-picker-row">
                  {EMOJI_OPTIONS.map(e => (
                    <span key={e} className="emoji-pick" onClick={() => addReaction(c.id, e)}>{e}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New comment */}
      <div className="comment-composer-row">
        <Avatar initials={user.avatar} size={32} />
        <input
          className="comment-input"
          placeholder="Escreva um comentário…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addComment()}
        />
        <button className="comment-send-btn" onClick={addComment}>➤</button>
      </div>
    </Modal>
  );
}
