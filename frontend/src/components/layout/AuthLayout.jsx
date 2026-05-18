import * as React from 'react';
import CharacterDisplay from '../CharacterDisplay';
import charactersImage from '../../assets/unigran_characters.png';
import illustrationImage from '../../assets/login-illustration.png';
import '../../assets/bg-gradient.css';

const CAROUSEL_PHOTOS = [
  {
    id: 'characters',
    src: charactersImage,
    alt: 'Personagens da comunidade Unigran',
  },
  {
    id: 'community',
    src: illustrationImage,
    alt: 'Ilustracao da comunidade Unigran',
  },
];

function AuthLayout({ children }) {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = React.useState(0);
  const selectedPhoto = CAROUSEL_PHOTOS[selectedPhotoIdx];

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setSelectedPhotoIdx(idx => (idx === CAROUSEL_PHOTOS.length - 1 ? 0 : idx + 1));
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="auth-split-layout">
      <div className="auth-shell">
        <div className="auth-visual-side">
          <div className="auth-gradient-bg">
            <div className="auth-visual-content">
              <div className="auth-carousel">
                <div className="auth-character-stage" key={selectedPhoto.id}>
                  <CharacterDisplay
                    imageSrc={selectedPhoto.src}
                    alt={selectedPhoto.alt}
                  />
                </div>
              </div>

              <div className="auth-photo-strip" aria-label="Fotos da comunidade">
                {CAROUSEL_PHOTOS.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={`auth-photo-thumb ${selectedPhotoIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedPhotoIdx(idx)}
                    aria-label={`Selecionar foto ${idx + 1}`}
                  >
                    <img src={photo.src} alt="" />
                  </button>
                ))}
              </div>

              <div className="auth-visual-copy">
                <span>UNIGRAN SOCIAL</span>
                <h2>Bem-vindo de volta</h2>
                <p>Entre, veja sua turma, posts, mensagens e comunidades.</p>
                <div className="auth-visual-arrow" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
