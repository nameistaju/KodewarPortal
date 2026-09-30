import { Router } from 'express';
import * as chatController from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadChatMedia, validateChatMediaUpload } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter, uploadLimiter } from '../middleware/rateLimiters.js';
import {
  conversationIdParamSchema,
  createConversationSchema,
  getMessagesQuerySchema,
  sendMediaMessageSchema,
  sendTextMessageSchema
} from '../validators/chatValidator.js';

const router = Router();

router.use(protect);

router
  .route('/conversations')
  .get(chatController.getConversations)
  .post(writeLimiter, validate({ body: createConversationSchema }), chatController.createConversation);

router
  .route('/conversations/:conversationId/messages')
  .get(validate({ params: conversationIdParamSchema, query: getMessagesQuerySchema }), chatController.getMessages)
  .post(writeLimiter, validate({ params: conversationIdParamSchema, body: sendTextMessageSchema }), chatController.sendTextMessage);

router.post(
  '/conversations/:conversationId/media',
  uploadLimiter,
  uploadChatMedia.single('file'),
  validateChatMediaUpload,
  validate({ params: conversationIdParamSchema, body: sendMediaMessageSchema }),
  chatController.sendMediaMessage
);

router.post('/cleanup', writeLimiter, chatController.triggerCleanup);

export default router;
