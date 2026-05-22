import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar } from '../ui';

export default function PostComposer({ onSubmit, placeholder = 'No que voce esta pensando?', allowMode = true, forcedPostType = null }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [text, setT] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [postMode, setPostMode] = useState('post');
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [portfolioLinkKind, setPortfolioLinkKind] = useState('repository');
  const [submitting, setSubmitting] = useState(false);
  const [pickerAccept, setPickerAccept] = useState('image/*,video/*,audio/*,.gif,.pdf,.doc,.docx,.zip');
  const fileInputRef = useRef(null);
  const isPortfolioMode = !forcedPostType && postMode === 'portfolio';

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const checkZuniVideo = (videoFile) => new Promise((resolve, reject) => {
    if (!videoFile?.type?.startsWith('video/')) {
      reject(new Error('Zuni aceita apenas video. Limite: ate 1:30 e qualidade maxima 720p.'));
      return;
    }
    const url = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const tooLong = video.duration > 90;
      const tooLarge = Math.min(video.videoWidth, video.videoHeight) > 720;
      if (tooLong || tooLarge) {
        reject(new Error('Video muito grande. Zuni aceita ate 1:30 e qualidade maxima 720p.'));
        return;
      }
      resolve();
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nao foi possivel ler o video. Use ate 1:30 e 720p.'));
    };
    video.src = url;
  });

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async () => {
    if (!text.trim() && !file) return;
    const postType = forcedPostType || (postMode === 'zuni' ? 'zuni-post' : (postMode === 'portfolio' ? 'portfolio-post' : undefined));
    setSubmitting(true);
    try {
      if (postType === 'zuni-post') await checkZuniVideo(file);
      if (postType === 'portfolio-post') {
        if (file && file.size > 1024 * 1024) throw new Error('Documento do portfolio deve ter ate 1024 KB por enquanto.');
        if (!text.trim() && !portfolioLink.trim() && !file) throw new Error('Adicione descricao, link ou documento para publicar no portfolio.');
      }
      await onSubmit({
        content: text.replace(/^\s+|\s+$/g, ''),
        file,
        postType,
        portfolioTitle: portfolioTitle.trim(),
        portfolioLink: portfolioLink.trim(),
        portfolioLinkKind,
      });
      setT('');
      setPortfolioTitle('');
      setPortfolioLink('');
      setPortfolioLinkKind('repository');
      clearFile();
    } catch (err) {
      showToast(err.message || 'Erro ao publicar.', '!');
    } finally {
      setSubmitting(false);
    }
  };

  const onPick = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (isPortfolioMode && next.size > 1024 * 1024) {
      showToast('Documento do portfolio deve ter ate 1024 KB.', '!');
      event.target.value = '';
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const openPicker = (accept = fileAccept) => {
    setPickerAccept(accept);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };
  const isImage = file?.type?.startsWith('image/') || file?.type === 'image/gif';
  const isVideo = file?.type?.startsWith('video/');
  const fileAccept = isPortfolioMode
    ? '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'image/*,video/*,.gif,.pdf,.doc,.docx,.zip';

  return (
    <div className="card post-composer">
      <div className="composer-row">
        <Avatar
          size={42}
          src={user?.profilePicture || null}
          name={user?.displayName || user?.username || ''}
          initials={user?.avatar || user?.displayName?.slice(0, 2)}
        />
        <textarea
          className="composer-textarea"
          placeholder={placeholder}
          value={text}
          onChange={e => setT(e.target.value)}
          rows={text.length > 80 ? 4 : 2}
        />
      </div>

      {preview && (
        <div className="composer-preview-wrap">
          <button className="composer-remove-media" onClick={clearFile} title="Remover arquivo" aria-label="Remover arquivo">
            x
          </button>
          <button className="composer-edit-pill" type="button" onClick={openPicker}>
            Editar
          </button>
          {isVideo ? (
            <video src={preview} controls className="composer-preview-media" />
          ) : isImage ? (
            <img src={preview} alt="Preview" className="composer-preview-media" />
          ) : (
            <div className="composer-file-preview">
              <strong>{file?.name}</strong>
              <span>Arquivo anexado</span>
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="composer-extra-line">
          <button type="button">Marcar pessoas</button>
          <button type="button">Adicionar descricao</button>
        </div>
      )}

      <div className="composer-footer">
        {allowMode && (
          <select
            className="form-input composer-mode-select"
            value={postMode}
            onChange={e => setPostMode(e.target.value)}
          >
            <option value="post">Post</option>
            <option value="zuni">Zuni</option>
            <option value="portfolio">Portfólio</option>
          </select>
        )}
        {isPortfolioMode && (
          <div className="composer-portfolio-panel">
            <input
              className="form-input"
              value={portfolioTitle}
              onChange={e => setPortfolioTitle(e.target.value)}
              placeholder="Titulo comercial do projeto"
            />
            <div className="composer-portfolio-grid">
              <input
                className="form-input"
                value={portfolioLink}
                onChange={e => setPortfolioLink(e.target.value)}
                placeholder="Link GitHub, deploy, Figma ou artigo"
              />
              <select className="form-input" value={portfolioLinkKind} onChange={e => setPortfolioLinkKind(e.target.value)}>
                <option value="repository">GitHub/repositorio</option>
                <option value="web_app">Aplicacao web</option>
                <option value="prototype">Figma/prototipo</option>
                <option value="drive">Drive</option>
                <option value="article">Artigo</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <span>Publica no feed e tambem cria um case na aba Portfólio. Documento leve: PDF/DOC/DOCX ate 1024 KB.</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={pickerAccept || fileAccept}
          style={{ display: 'none' }}
          onChange={onPick}
        />
        <button className="composer-btn" title="Foto/GIF" type="button" onClick={() => openPicker('image/*,.gif')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <button className="composer-btn" title="Video" type="button" onClick={() => openPicker('video/*')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <button className="composer-btn" title="Emoji" type="button">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>
        <button className="composer-btn" title="Anexo" type="button" onClick={() => openPicker('image/*,video/*,audio/*,.pdf,.doc,.docx,.zip')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <div className="composer-submit-wrap">
          <button
            className="btn btn-primary btn-sm composer-submit-btn"
            onClick={submit}
            disabled={submitting || (!text.trim() && !file && !(isPortfolioMode && portfolioLink.trim()))}
          >
            {submitting ? 'Publicando...' : 'Postar'}
          </button>
        </div>
      </div>
    </div>
  );
}
