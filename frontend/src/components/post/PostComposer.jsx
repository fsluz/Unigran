import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar } from '../ui';

export default function PostComposer({ onSubmit, placeholder = 'No que você está pensando?', allowMode = true, forcedPostType = null }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [text, setT] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [postMode, setPostMode] = useState('post');
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [portfolioLinkKind, setPortfolioLinkKind] = useState('repository');
  const [portfolioTagInput, setPortfolioTagInput] = useState('');
  const [portfolioTags, setPortfolioTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [pickerAccept, setPickerAccept] = useState('image/*,video/*,audio/*,.gif,.pdf,.doc,.docx,.zip');
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
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
    if (!text.trim() && !file && !(isPortfolioMode && portfolioLink.trim())) return;
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
        portfolioTags,
        portfolioTechnologies: portfolioTags,
        portfolioProjectType: 'social',
      });
      setT('');
      setPortfolioTitle('');
      setPortfolioLink('');
      setPortfolioLinkKind('repository');
      setPortfolioTagInput('');
      setPortfolioTags([]);
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
  const addPortfolioTag = (tag) => {
    const clean = String(tag || '').trim().replace(/^#/, '');
    if (!clean || portfolioTags.includes(clean)) return;
    setPortfolioTags(prev => [...prev, clean].slice(0, 8));
    setPortfolioTagInput('');
  };
  const formatSelection = (before, after = before, example = 'texto') => {
    const input = textInputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const selected = text.slice(start, end) || example;
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setT(next);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const prefixLines = (prefix, example) => {
    const input = textInputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const selected = text.slice(start, end) || example;
    const formatted = selected.split('\n').map(line => `${prefix}${line}`).join('\n');
    setT(`${text.slice(0, start)}${formatted}${text.slice(end)}`);
    requestAnimationFrame(() => input?.focus());
  };

  return (
    <div className="card post-composer">
      <div className="composer-row">
        <Avatar
          size={42}
          src={user?.profilePicture || null}
          name={user?.displayName || user?.username || ''}
          initials={user?.avatar || user?.displayName?.slice(0, 2)}
        />
        <div className="composer-editor">
          {isPortfolioMode && (
            <div className="composer-format-toolbar" aria-label="Formatacao do portfolio">
              <button type="button" onClick={() => formatSelection('**', '**', 'texto em negrito')}><strong>B</strong></button>
              <button type="button" onClick={() => prefixLines('## ', 'Sobre o projeto')}>Titulo</button>
              <button type="button" onClick={() => prefixLines('- ', 'Tecnologia utilizada')}>Lista</button>
              <button type="button" onClick={() => formatSelection('[', '](https://)', 'link')}>Link</button>
            </div>
          )}
          <textarea
            ref={textInputRef}
            className="composer-textarea"
            placeholder={isPortfolioMode ? 'Descreva o projeto. Para destacar fatos na vitrine, inclua: Problema: ... e Resultado: ...' : placeholder}
            value={text}
            onChange={e => setT(e.target.value)}
            rows={isPortfolioMode ? Math.max(6, text.length > 240 ? 10 : 6) : (text.length > 80 ? 4 : 2)}
          />
        </div>
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
            <label className="composer-portfolio-field composer-portfolio-title">
              <span>Titulo do projeto</span>
              <input
                value={portfolioTitle}
                onChange={e => setPortfolioTitle(e.target.value)}
                placeholder="Ex: Dashboard E-commerce 2024"
              />
            </label>
            <div className="composer-portfolio-grid">
              <label className="composer-portfolio-field">
                <span>Links (Github, deploy, Figma)</span>
                <input
                  value={portfolioLink}
                  onChange={e => setPortfolioLink(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="composer-repo-select">
                <span>{portfolioLinkKind === 'repository' ? 'Repositorio' : 'Tipo'}</span>
                <select value={portfolioLinkKind} onChange={e => setPortfolioLinkKind(e.target.value)}>
                  <option value="repository">Selecionar Repo</option>
                  <option value="web_app">Aplicacao web</option>
                  <option value="prototype">Figma/prototipo</option>
                  <option value="drive">Drive</option>
                  <option value="article">Artigo</option>
                  <option value="other">Outro</option>
                </select>
              </label>
            </div>
            <strong className="composer-tech-title">Tecnologias & tags</strong>
            <div className="composer-techs">
              {portfolioTags.map(tag => (
                <button type="button" key={tag} onClick={() => setPortfolioTags(prev => prev.filter(item => item !== tag))}>
                  {tag} x
                </button>
              ))}
              <input
                value={portfolioTagInput}
                onChange={e => setPortfolioTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPortfolioTag(portfolioTagInput);
                  }
                }}
                placeholder="+ tecnologia"
              />
              <button type="button" className="composer-add-tag" onClick={() => addPortfolioTag(portfolioTagInput)}>+ Adicionar</button>
            </div>
            <span className="composer-portfolio-help">A vitrine mostra apenas fatos que voce documentar e arquivos/links anexados. Use Problema: e Resultado: quando forem reais. Formatos: PDF, DOCX (ate 1MB).</span>
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
            {submitting ? 'Publicando...' : (isPortfolioMode ? 'Postar Case' : 'Postar')}
          </button>
        </div>
      </div>
    </div>
  );
}
