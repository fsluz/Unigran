export default function ImageLightbox({ src, alt = 'Imagem', onClose }) {
  if (!src) return null;
  return (
    <div className="image-lightbox" onClick={onClose}>
      <button className="image-lightbox-close" onClick={onClose}>x</button>
      <img src={src} alt={alt} onClick={e => e.stopPropagation()} />
    </div>
  );
}
