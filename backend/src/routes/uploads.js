import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { uploadMediaBuffer } from '../services/cloudinary.service.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/media', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo é obrigatório' });
    const media = await uploadMediaBuffer(req.file);
    res.status(201).json(media);
  } catch (err) {
    console.error('[upload media]', err);
    res.status(500).json({ error: 'Falha ao enviar mídia' });
  }
});

export default router;
