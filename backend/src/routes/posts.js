import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import {
  createCommentController,
  favoritesController,
  createPostController,
  getCommentsController,
  getFeedController,
  likePostController,
  reportPostController,
  savePostController,
  sharePostController,
  unlikePostController,
  unsavePostController,
} from '../controllers/post.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/', auth, getFeedController);
router.get('/favorites', auth, favoritesController);
router.post('/', auth, upload.single('file'), createPostController);
router.post('/:id/like', auth, likePostController);
router.delete('/:id/like', auth, unlikePostController);
router.post('/:id/save', auth, savePostController);
router.delete('/:id/save', auth, unsavePostController);
router.post('/:id/share', auth, sharePostController);
router.post('/:id/report', auth, reportPostController);
router.get('/:id/comments', auth, getCommentsController);
router.post('/:id/comments', auth, upload.single('file'), createCommentController);

export default router;
