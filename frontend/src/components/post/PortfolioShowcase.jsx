import { Briefcase, Layers, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { parsePortfolioSections } from '../../utils/portfolioSections';

const SECTION_ICONS = {
  perfil: Briefcase,
  problema: Target,
  solucao: Zap,
  resultado: Trophy,
  complexidade: Layers,
};

function PortfolioLinkPreview({ meta, url }) {
  if (!meta) return null;
  const tone = meta.tone || 'generic';
  return (
    <div className={`portfolio-showcase-preview portfolio-showcase-preview--${tone}`}>
      <div className="portfolio-window-dots"><span /><span /><span /></div>
      <div className="portfolio-showcase-mock-ui">
        <i /><i /><i />
      </div>
      <span className="portfolio-showcase-preview-badge">{meta.label || 'Link'}</span>
    </div>
  );
}

function portfolioLinkMeta(url = '', fallback = '') {
  const raw = String(url || '');
  const clean = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  const github = raw.match(/github\.com\/([^/\s]+)\/([^/?#\s]+)/i);
  if (github) {
    return { label: 'GitHub', title: `${github[1]}/${github[2].replace(/\.git$/i, '')}`, subtitle: 'Repositorio', tone: 'github' };
  }
  const domain = clean.split('/')[0] || fallback || 'Link';
  return { label: fallback || 'Link', title: domain, subtitle: clean, tone: 'generic' };
}

export default function PortfolioShowcase({ portfolio, compact = false }) {
  if (!portfolio) return null;

  const sections = portfolio.sections?.length
    ? portfolio.sections
    : parsePortfolioSections(portfolio.summary);
  const linkMeta = portfolio.externalLink ? portfolioLinkMeta(portfolio.externalLink, portfolio.externalKind) : null;
  const ctaHref = portfolio.caseLink || portfolio.externalLink || '';

  return (
    <article className={`portfolio-showcase ${compact ? 'is-compact' : ''}`}>
      <div className="portfolio-showcase-hero">
        <div className="portfolio-showcase-visual">
          {portfolio.mediaUrl && portfolio.mediaType !== 'video' ? (
            <img src={portfolio.mediaUrl} alt="" loading="lazy" />
          ) : portfolio.mediaUrl && portfolio.mediaType === 'video' ? (
            <video src={portfolio.mediaUrl} muted playsInline controls preload="metadata" />
          ) : linkMeta ? (
            <PortfolioLinkPreview meta={linkMeta} url={portfolio.externalLink} />
          ) : (
            <div className="portfolio-showcase-visual-fallback">
              <div className="portfolio-window-dots"><span /><span /><span /></div>
              <div className="portfolio-showcase-mock-ui"><i /><i /><i /></div>
            </div>
          )}
        </div>
        <div className="portfolio-showcase-meta">
          {portfolio.tags.slice(0, 2).map(tag => (
            <span key={tag} className="portfolio-showcase-meta-tag">
              <Sparkles size={14} aria-hidden="true" />
              {tag}
            </span>
          ))}
          {!portfolio.tags.length && portfolio.profileArea && (
            <span className="portfolio-showcase-meta-tag">{portfolio.profileArea}</span>
          )}
        </div>
      </div>

      <div className="portfolio-showcase-body">
        <span className="portfolio-showcase-kicker">PORTFOLIO</span>
        <h3>{portfolio.title}</h3>

        {sections.length > 0 ? (
          <ul className="portfolio-showcase-sections">
            {sections.map(section => {
              const Icon = SECTION_ICONS[section.key] || Briefcase;
              return (
                <li key={section.key}>
                  <span className="portfolio-showcase-section-icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  <div>
                    <strong>{section.label}</strong>
                    <p>{section.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : portfolio.summary ? (
          <p className="portfolio-showcase-summary">{portfolio.summary}</p>
        ) : null}

        {portfolio.tags.length > 0 && (
          <div className="portfolio-showcase-tags">
            {portfolio.tags.map(tag => <span key={tag}>{tag}</span>)}
          </div>
        )}

        {ctaHref && (
          <a className="portfolio-showcase-cta" href={ctaHref} target={ctaHref.startsWith('http') ? '_blank' : undefined} rel={ctaHref.startsWith('http') ? 'noreferrer' : undefined}>
            Ver projeto completo
            <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </article>
  );
}
