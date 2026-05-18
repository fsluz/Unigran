export default function UnigranLogo({ size = 34, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="unigran-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00A8FF" />
          <stop offset="60%" stopColor="#3366FF" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path
        d="M18 14 C18 14 18 62 18 67 C18 82 33 92 50 92 C67 92 82 82 82 67 C82 62 82 44 82 44"
        stroke="url(#unigran-logo-gradient)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M34 14 C34 14 34 56 34 61 C34 72 42 79 50 79 C58 79 66 72 66 61 C66 56 66 44 66 44"
        stroke="url(#unigran-logo-gradient)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.66"
      />
      <circle cx="82" cy="30" r="5" fill="url(#unigran-logo-gradient)" />
      <line x1="82" y1="35" x2="82" y2="52" stroke="url(#unigran-logo-gradient)" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="82" cy="57" rx="5.5" ry="8" fill="#7C3AED" />
    </svg>
  );
}
