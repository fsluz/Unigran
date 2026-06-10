import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar } from '../ui';

function ComposerModeIcon({ type }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (type === 'portfolio') {
    return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" /><path d="M3 12h18" /><path d="M10 12v2h4v-2" /></svg>;
  }
  if (type === 'zuni') {
    return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m10 8 6 4-6 4V8Z" fill="currentColor" stroke="none" /></svg>;
  }
  return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
}

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
    if (!text.trim() && !file && !(isPortfolioMode && (portfolioTitle.trim() || portfolioLink.trim()))) return;
    const postType = forcedPostType || (postMode === 'zuni' ? 'zuni-post' : (postMode === 'portfolio' ? 'portfolio-post' : undefined));
    setSubmitting(true);
    try {
      if (postType === 'zuni-post') await checkZuniVideo(file);
      if (postType === 'portfolio-post') {
        if (file && file.size > 1024 * 1024) throw new Error('Documento do Portfólio deve ter ate 1024 KB por enquanto.');
        if (!portfolioTitle.trim()) throw new Error('Adicione um titulo para publicar no Portfólio.');
        if (!text.trim() && !portfolioLink.trim() && !file) throw new Error('Adicione descricao, link ou documento para publicar no Portfólio.');
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

  const attachSelectedFile = (next) => {
    if (!next) return;
    if (isPortfolioMode && next.size > 1024 * 1024) {
      showToast('Documento do Portfólio deve ter ate 1024 KB.', '!');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const onPick = (event) => {
    const next = event.target.files?.[0];
    if (isPortfolioMode && next?.size > 1024 * 1024) event.target.value = '';
    attachSelectedFile(next);
  };

  const handlePaste = (event) => {
    const item = Array.from(event.clipboardData?.items || [])
      .find(entry => entry.kind === 'file' && entry.type?.startsWith('image/'));
    if (!item) return;
    const pasted = item.getAsFile();
    if (!pasted) return;
    event.preventDefault();
    const ext = pasted.type?.split('/')[1] || 'png';
    const next = new File([pasted], `imagem-${Date.now()}.${ext}`, { type: pasted.type || 'image/png' });
    attachSelectedFile(next);
    showToast('Imagem colada. Pronta para publicar.', 'OK');
  };

  const isImage = file?.type?.startsWith('image/') || file?.type === 'image/gif';
  const isVideo = file?.type?.startsWith('video/');
  const isZuniMode = !forcedPostType && postMode === 'zuni';
  const fileAccept = isPortfolioMode
    ? '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'image/*,video/*,.gif,.pdf,.doc,.docx,.zip';
  const openPicker = (accept = fileAccept) => {
    setPickerAccept(accept);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };
  const addPortfolioTag = (tag) => {
    const clean = String(tag || '').trim().replace(/^#/, '');
    if (!clean || portfolioTags.includes(clean)) return;
    setPortfolioTags(prev => [...prev, clean].slice(0, 8));
    setPortfolioTagInput('');
  };
  const composerModes = [
    { id: 'portfolio', label: 'Portfólio' },
    { id: 'post', label: 'Post' },
    { id: 'zuni', label: 'Zuni' },
  ];
  const placeholderText = isPortfolioMode
    ? 'Descreva o projeto. Para destacar fatos na vitrine, inclua: Problema: ... e Resultado: ...'
    : isZuniMode
      ? 'Publique um vídeo curto no Zuni. Escreva uma legenda rápida...'
      : 'O que você está construindo hoje?\nCompartilhe ideias, projetos, portfólios ou conquistas com a comunidade.';
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
    <div className={`card post-composer ${isPortfolioMode ? 'is-portfolio' : ''}`}>
      <div className="composer-row">
        <Avatar
          size={42}
          src={user?.profilePicture || null}
          name={user?.displayName || user?.username || ''}
          initials={user?.avatar || user?.displayName?.slice(0, 2)}
        />
        <div className="composer-editor">
          {isPortfolioMode && (
            <div className="composer-format-toolbar" aria-label="Formatacao do Portfólio">
              <button type="button" onClick={() => formatSelection('**', '**', 'texto em negrito')}><strong>B</strong></button>
              <button type="button" onClick={() => prefixLines('## ', 'Sobre o projeto')}>Titulo</button>
              <button type="button" onClick={() => prefixLines('- ', 'Tecnologia utilizada')}>Lista</button>
              <button type="button" onClick={() => formatSelection('[', '](https://)', 'link')}>Link</button>
            </div>
          )}
          <textarea
            ref={textInputRef}
            className="composer-textarea"
            placeholder={allowMode ? placeholderText : placeholder}
            value={text}
            onChange={e => setT(e.target.value)}
            onPaste={handlePaste}
            maxLength={500}
            rows={isPortfolioMode ? Math.max(6, text.length > 240 ? 10 : 6) : (text.length > 80 ? 4 : 2)}
          />
          <span className="composer-char-count">{text.length}/500</span>
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
          <div className="composer-type-tabs" role="tablist" aria-label="Tipo de publicação">
            {composerModes.map(mode => (
              <button
                key={mode.id}
                type="button"
                className={`composer-type-pill is-${mode.id} ${postMode === mode.id ? 'active' : ''}`}
                onClick={() => setPostMode(mode.id)}
              >
                <ComposerModeIcon type={mode.id} />
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
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
            <span className="composer-portfolio-help">A vitrine mostra apenas fatos que você documentar e arquivos/links anexados. Use Problema: e Resultado: quando forem reais. Formatos: PDF, DOCX (até 1MB).</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={pickerAccept || fileAccept}
          style={{ display: 'none' }}
          onChange={onPick}
        />
        <div className="composer-publish-row">
          <span className="composer-add-label">Adicionar:</span>
          <div className="composer-attachment-actions">
        <button className="composer-btn" title="Foto/GIF" type="button" onClick={() => openPicker('image/*,.gif')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Imagem</span>
        </button>
        <button className="composer-btn" title="Video" type="button" onClick={() => openPicker('video/*')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
          <span>Vídeo</span>
        </button>
        <button className="composer-btn" title="Emoji" type="button">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          <span>Emoji</span>
        </button>
        <button className="composer-btn" title="Anexo" type="button" onClick={() => openPicker('image/*,video/*,audio/*,.pdf,.doc,.docx,.zip')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          <span>Anexo</span>
        </button>
        <button className="composer-btn composer-btn-extra" title="GitHub" type="button" onClick={() => setPostMode('portfolio')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6A4.6 4.6 0 0 0 18.7 6a4.2 4.2 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.4 11.4 0 0 0-6.2 0C6.6 2.4 5.6 2.7 5.6 2.7A4.2 4.2 0 0 0 5.5 6 4.6 4.6 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.7 1.2-.7 2V21" />
          </svg>
          <span>GitHub</span>
        </button>
        <button className="composer-btn composer-btn-extra" title="Deploy" type="button" onClick={() => setPostMode('portfolio')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /><path d="m14 4-4 16" />
          </svg>
          <span>Deploy</span>
        </button>
        <button className="composer-btn composer-btn-extra" title="PDF" type="button" onClick={() => openPicker('.pdf,application/pdf')}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
          </svg>
          <span>PDF</span>
        </button>
          </div>
          <div className="composer-submit-wrap">
          <button
            className="btn btn-primary btn-sm composer-submit-btn"
            onClick={submit}
            disabled={submitting || (!text.trim() && !file && !(isPortfolioMode && (portfolioTitle.trim() || portfolioLink.trim())))}
          >
            {submitting ? 'Publicando...' : (isPortfolioMode ? 'Postar Case' : 'Postar')}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
