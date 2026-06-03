import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { createCloudinaryUploadSignature, uploadAudioBuffer, uploadMediaBuffer } from '../services/cloudinary.service.js';
import { uploadDocumentBuffer } from '../services/document.service.js';
import { parseResumeFile } from '../services/resume.service.js';
import { getPortfolioMlAnalysis, savePortfolioResume } from '../modules/academic/typedbPortfolioStore.js';

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
    if (!req.file) return res.status(400).json({ error: 'Arquivo  obrigatrio' });
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
    res.status(500).json({ error: err.message || 'Falha ao enviar midia' });
  }
});

router.post('/audio', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Audio obrigatorio' });
    const audio = await uploadAudioBuffer(req.file, 'unigran/messages');
    res.status(201).json(audio);
  } catch (err) {
    console.error('[upload audio]', err);
    if (err?.statusCode && Number.isInteger(err.statusCode)) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (String(err?.message || '').toLowerCase().includes('unauthorized')) {
      return res.status(401).json({ error: 'Cloudinary rejeitou credenciais (401). Verifique CLOUDINARY_API_KEY/API_SECRET.' });
    }
    res.status(500).json({ error: err.message || 'Falha ao enviar audio' });
  }
});

router.post('/documents', auth, upload.single('file'), async (req, res) => {
  try {
    const document = await uploadDocumentBuffer({ file: req.file, user: req.user, folder: 'ava-entregas' });
    res.status(201).json({ document });
  } catch (err) {
    console.error('[upload document]', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Falha ao enviar documento' });
  }
});

router.post('/resume', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Curriculo obrigatorio' });
    const lower = String(req.file.originalname || '').toLowerCase();
    const allowed = lower.endsWith('.pdf') || lower.endsWith('.docx') || req.file.mimetype?.includes('pdf') || req.file.mimetype?.includes('wordprocessingml');
    if (!allowed) return res.status(400).json({ error: 'Envie um curriculo em PDF ou DOCX' });

    const parsed = parseResumeFile(req.file);
    const document = await uploadDocumentBuffer({ file: req.file, user: req.user, folder: 'portfolio-curriculos' });
    const resume = await savePortfolioResume(req.user, {
      ...parsed,
      documentUrl: document.url,
      documentName: document.name,
      documentStorage: document.storage,
      documentPath: document.path,
      mimeType: document.mimeType,
      size: document.size,
    });
    const analysis = await getPortfolioMlAnalysis(req.user.username);
    res.status(201).json({ resume, analysis });
  } catch (err) {
    console.error('[upload resume]', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Falha ao processar curriculo' });
  }
});

export default router;


