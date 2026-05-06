import defaultImage from '../assets/unigran_characters.png';

export default function CharacterDisplay({ imageSrc = defaultImage, alt = 'Comunidade Unigran' }) {
  return (
    <div className="character-display">
      <img
        src={imageSrc}
        alt={alt}
        className="character-display-image"
      />
    </div>
  );
}
