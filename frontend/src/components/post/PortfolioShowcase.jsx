import { Briefcase, Layers, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { parsePortfolioSections } from '../../utils/portfolioSections';

const SECTION_ICONS = {
  perfil: Briefcase,
  problema: Target,
  solucao: Zap,
  resultado: Trophy,
  complexidade: Layers,
};

function PortfolioBlueprintSvg() {
  return (
    <svg className="portfolio-showcase-svg" viewBox="0 0 520 320" role="img" aria-label="Preview visual do portfólio">
      <defs>
        <linearGradient id="portfolioSvgBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#6d28d9" />
          <stop offset=".55" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="portfolioSvgCard" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.28)" />
          <stop offset="1" stopColor="rgba(255,255,255,.08)" />
        </linearGradient>
      </defs>
      <rect width="520" height="320" rx="28" fill="url(#portfolioSvgBg)" />
      <rect x="34" y="36" width="452" height="248" rx="22" fill="rgba(3,10,22,.34)" stroke="rgba(255,255,255,.22)" />
      <circle cx="62" cy="64" r="7" fill="#fb7185" />
      <circle cx="86" cy="64" r="7" fill="#fbbf24" />
      <circle cx="110" cy="64" r="7" fill="#34d399" />
      <rect x="62" y="96" width="170" height="18" rx="9" fill="rgba(255,255,255,.72)" />
      <rect x="62" y="128" width="250" height="12" rx="6" fill="rgba(255,255,255,.36)" />
      <rect x="62" y="150" width="210" height="12" rx="6" fill="rgba(255,255,255,.28)" />
      <rect x="62" y="196" width="116" height="58" rx="16" fill="url(#portfolioSvgCard)" stroke="rgba(255,255,255,.18)" />
      <rect x="194" y="196" width="116" height="58" rx="16" fill="url(#portfolioSvgCard)" stroke="rgba(255,255,255,.18)" />
      <rect x="326" y="96" width="112" height="112" rx="28" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.2)" />
      <path d="M354 165l28-42 24 30 13-14 22 26" fill="none" stroke="rgba(255,255,255,.74)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="397" cy="124" r="10" fill="rgba(255,255,255,.72)" />
      <rect x="326" y="224" width="122" height="16" rx="8" fill="rgba(255,255,255,.48)" />
      <rect x="326" y="250" width="82" height="12" rx="6" fill="rgba(255,255,255,.28)" />
    </svg>
  );
}

function PortfolioLinkPreview({ meta, url }) {
  if (!meta) return null;
  const tone = meta.tone || 'generic';
  return (
    <div className={`portfolio-showcase-preview portfolio-showcase-preview--${tone}`}>
      <div className="portfolio-window-dots"><span /><span /><span /></div>
      <PortfolioBlueprintSvg />
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
              <PortfolioBlueprintSvg />
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
