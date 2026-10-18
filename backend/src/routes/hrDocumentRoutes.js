import { Router } from 'express';
import * as hrDocumentController from '../controllers/hrDocumentController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  documentQuerySchema,
  documentIdParamSchema,
  updateDocumentReviewSchema,
  linkDocumentCandidateSchema
} from '../validators/hrDocumentValidator.js';

const router = Router();

// Strict authorization: HR and ADMIN only. Ordinary employees cannot access.
router.use(protect);
router.use(authorizeRoles(ROLES.HR, ROLES.ADMIN));

router.get('/', validate({ query: documentQuerySchema }), hrDocumentController.getDocuments);
router.post('/sync-metadata', writeLimiter, hrDocumentController.syncMetadata);

router.get('/:id', validate({ params: documentIdParamSchema }), hrDocumentController.getDocumentById);
router.patch(
  '/:id/review',
  writeLimiter,
  validate({ params: documentIdParamSchema, body: updateDocumentReviewSchema }),
  hrDocumentController.updateDocumentReview
);
router.patch(
  '/:id/link-candidate',
  writeLimiter,
  validate({ params: documentIdParamSchema, body: linkDocumentCandidateSchema }),
  hrDocumentController.linkCandidate
);

export default router;
