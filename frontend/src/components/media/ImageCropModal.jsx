import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from '../ui';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export default function ImageCropModal({ file, shape = 'cover', onCancel, onConfirm }) {
  const [pos, setPos] = useState({ x: 50, y: 50, zoom: 1 });
  const imgRef = useRef(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!file || !preview) return null;

  const crop = async () => {
    const img = imgRef.current;
    if (!img?.naturalWidth || !img?.naturalHeight) return;
    const outW = shape === 'avatar' ? 720 : 1600;
    const outH = shape === 'avatar' ? 720 : 520;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, outW, outH);

    const scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight) * pos.zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const maxX = Math.max(0, drawW - outW);
    const maxY = Math.max(0, drawH - outH);
    const dx = -maxX * (pos.x / 100);
    const dy = -maxY * (pos.y / 100);
    ctx.drawImage(img, dx, dy, drawW, drawH);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92));
    if (!blob) return;
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    onConfirm(new File([blob], `crop-${Date.now()}.${ext}`, { type: blob.type }));
  };

  return (
    <Modal title="Escolher parte da foto" onClose={onCancel} maxWidth={720} footer={
      <>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={crop}>Usar imagem</Button>
      </>
    }>
      <div className={`crop-box ${shape === 'avatar' ? 'avatar-shape' : ''}`}>
        <img
          ref={imgRef}
          src={preview}
          alt="crop"
          style={{
            objectPosition: `${pos.x}% ${pos.y}%`,
            transform: `scale(${pos.zoom})`,
          }}
        />
      </div>
      <div className="crop-controls">
        <label>Horizontal <input type="range" min="0" max="100" value={pos.x} onChange={e => setPos(p => ({ ...p, x: clamp(e.target.value, 0, 100) }))} /></label>
        <label>Vertical <input type="range" min="0" max="100" value={pos.y} onChange={e => setPos(p => ({ ...p, y: clamp(e.target.value, 0, 100) }))} /></label>
        <label>Zoom <input type="range" min="1" max="2.4" step="0.05" value={pos.zoom} onChange={e => setPos(p => ({ ...p, zoom: clamp(e.target.value, 1, 2.4) }))} /></label>
      </div>
    </Modal>
  );
}
