import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { createCloudinaryUploadSignature, uploadMediaBuffer } from '../services/cloudinary.service.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get('/signature', auth, (req, res) => {
  try {
    const resourceType = String(req.query.resourceType || 'image');
    const folder = String(req.query.folder || 'unigran/posts');
    const signatureData = createCloudinaryUploadSignature({ folder, resourceType });
    res.json(signatureData);
  } catch (err) {
    console.error('[upload signature]', err);
    res.status(500).json({ error: String(err.message || 'Falha ao gerar assinatura de upload') });
  }
});

router.post('/media', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo é obrigatório' });
    const media = await uploadMediaBuffer(req.file);
    res.status(201).json(media);
  } catch (err) {
    console.error('[upload media]', err);
    if (err?.statusCode && Number.isInteger(err.statusCode)) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (String(err?.message || '').toLowerCase().includes('unauthorized')) {
      return res.status(401).json({ error: 'Cloudinary rejeitou credenciais (401). Verifique CLOUDINARY_API_KEY/API_SECRET.' });
    }
    res.status(500).json({ error: err.message || 'Falha ao enviar mídia' });
  }
});

export default router;
