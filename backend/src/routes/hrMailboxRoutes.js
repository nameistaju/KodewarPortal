import { Router } from 'express';
import * as hrMailboxController from '../controllers/hrMailboxController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { syncMailboxSchema, emailQuerySchema, emailIdParamSchema, updateCategorySchema } from '../validators/hrMailboxValidator.js';
import { writeLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Strict authorization: HR or Admin only. Ordinary employees cannot access.
router.use(protect);
router.use(authorizeRoles(ROLES.HR, ROLES.ADMIN));

router.get('/status', hrMailboxController.getSyncStatus);
router.post('/sync', writeLimiter, validate({ body: syncMailboxSchema }), hrMailboxController.triggerSync);
router.get('/emails', validate({ query: emailQuerySchema }), hrMailboxController.getEmails);
router.get('/emails/:id', validate({ params: emailIdParamSchema }), hrMailboxController.getEmailById);
router.patch('/emails/:id/category', writeLimiter, validate({ params: emailIdParamSchema, body: updateCategorySchema }), hrMailboxController.updateEmailCategory);


export default router;
