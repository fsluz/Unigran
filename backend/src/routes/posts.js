import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import {
  createCommentController,
  favoritesController,
  createPostController,
  deleteCommentController,
  deletePostController,
  editCommentController,
  editPostController,
  getCommentsController,
  getFeedController,
  getTrendPostsController,
  getTrendsController,
  likeCommentController,
  likePostController,
  reportPostController,
  savePostController,
  sharePostController,
  unlikeCommentController,
  unlikePostController,
  unsavePostController,
} from '../controllers/post.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

router.get('/', auth, getFeedController);
router.get('/trends', auth, getTrendsController);
router.get('/trends/:tag', auth, getTrendPostsController);
router.get('/favorites', auth, favoritesController);
router.post('/', auth, upload.single('file'), createPostController);
router.patch('/:id', auth, editPostController);
router.delete('/:id', auth, deletePostController);
router.post('/:id/like', auth, likePostController);
router.delete('/:id/like', auth, unlikePostController);
router.post('/comments/:commentId/like', auth, likeCommentController);
router.delete('/comments/:commentId/like', auth, unlikeCommentController);
router.patch('/comments/:commentId', auth, editCommentController);
router.delete('/:id/comments/:commentId', auth, deleteCommentController);
router.post('/:id/save', auth, savePostController);
router.delete('/:id/save', auth, unsavePostController);
router.post('/:id/share', auth, sharePostController);
router.post('/:id/report', auth, reportPostController);
router.get('/:id/comments', auth, getCommentsController);
router.post('/:id/comments', auth, upload.single('file'), createCommentController);

export default router;
