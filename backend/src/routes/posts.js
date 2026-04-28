import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import {
  createCommentController,
  createPostController,
  getCommentsController,
  getFeedController,
} from '../controllers/post.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/', auth, getFeedController);
router.post('/', auth, upload.single('file'), createPostController);
router.get('/:id/comments', auth, getCommentsController);
router.post('/:id/comments', auth, upload.single('file'), createCommentController);

export default router;
