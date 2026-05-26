import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function PortalEntryTransition({ role, onComplete }) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 250 : 1450;

  useEffect(() => {
    const timer = window.setTimeout(onComplete, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <motion.div
      className="portal-entry"
      role="status"
      aria-label="Abrindo portal academico"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <svg className="portal-entry-svg" viewBox="0 0 720 720" aria-hidden="true">
        <defs>
          <radialGradient id="portal-core" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="20%" stopColor="#8be9ff" stopOpacity=".95" />
            <stop offset="52%" stopColor="#4776ff" stopOpacity=".6" />
            <stop offset="100%" stopColor="#6a00f4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="portal-ring" x1="0%" x2="100%">
            <stop stopColor="#00d4ff" />
            <stop offset=".5" stopColor="#ffffff" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle className="portal-entry-halo" cx="360" cy="360" r="250" fill="url(#portal-core)" />
        <g className="portal-entry-rings" fill="none" stroke="url(#portal-ring)">
          <ellipse cx="360" cy="360" rx="205" ry="102" />
          <ellipse cx="360" cy="360" rx="165" ry="236" transform="rotate(38 360 360)" />
          <ellipse cx="360" cy="360" rx="235" ry="138" transform="rotate(-42 360 360)" />
        </g>
        <g className="portal-entry-stars" fill="#ecfeff">
          <circle cx="176" cy="288" r="4" />
          <circle cx="552" cy="234" r="6" />
          <circle cx="518" cy="483" r="4" />
          <circle cx="233" cy="506" r="5" />
          <circle cx="420" cy="153" r="3" />
          <circle cx="302" cy="192" r="3" />
        </g>
        <path className="portal-entry-glyph" d="M300 344l60-36 60 36-60 37-60-37zm16 23v39c23 20 65 20 88 0v-39" />
      </svg>
      <div className="portal-entry-copy">
        <strong>Portal Academico</strong>
        <span>Preparando ambiente para {String(role || 'student').replaceAll('_', ' ')}</span>
      </div>
    </motion.div>
  );
}
