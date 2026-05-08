import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from '../ui';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export default function ImageCropModal({ file, shape = 'cover', onCancel, onConfirm }) {
  const [pos, setPos] = useState({ x: 50, y: 50, zoom: 1.08 });
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, startX: 50, startY: 50 });

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!file || !preview) return null;

  const moveBy = (clientX, clientY) => {
    const dx = clientX - dragRef.current.x;
    const dy = clientY - dragRef.current.y;
    const box = imgRef.current?.parentElement?.getBoundingClientRect();
    if (!box) return;
    setPos(p => ({
      ...p,
      x: clamp(dragRef.current.startX - (dx / box.width) * 100, 0, 100),
      y: clamp(dragRef.current.startY - (dy / box.height) * 100, 0, 100),
    }));
  };

  const startDrag = (clientX, clientY) => {
    dragRef.current = { x: clientX, y: clientY, startX: pos.x, startY: pos.y };
    setDragging(true);
  };

  const endDrag = () => setDragging(false);

  const onWheel = (event) => {
    event.preventDefault();
    const nextZoom = pos.zoom + (event.deltaY > 0 ? -0.06 : 0.06);
    setPos(p => ({ ...p, zoom: clamp(nextZoom, 1, 2.8) }));
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startDrag(event.clientX, event.clientY);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    moveBy(event.clientX, event.clientY);
  };

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
      <div
        className={`crop-box ${shape === 'avatar' ? 'avatar-shape' : ''} ${dragging ? 'dragging' : ''}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          src={preview}
          alt="crop"
          style={{
            objectPosition: `${pos.x}% ${pos.y}%`,
            transform: `scale(${pos.zoom})`,
          }}
          draggable={false}
        />
        <div className="crop-help">Arraste para posicionar. Role para zoom.</div>
      </div>
    </Modal>
  );
}
