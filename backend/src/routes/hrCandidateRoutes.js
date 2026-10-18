import { Router } from 'express';
import * as hrCandidateController from '../controllers/hrCandidateController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  candidateQuerySchema,
  candidateIdParamSchema,
  createCandidateSchema,
  updateCandidateSchema,
  updateStatusSchema,
  linkEmailSchema,
  unlinkEmailParamSchema,
  createFromEmailSchema
} from '../validators/hrCandidateValidator.js';

const router = Router();

// Strict authorization: HR or Admin only. Ordinary employees cannot access.
router.use(protect);
router.use(authorizeRoles(ROLES.HR, ROLES.ADMIN));

router.get('/', validate({ query: candidateQuerySchema }), hrCandidateController.getCandidates);
router.post('/', writeLimiter, validate({ body: createCandidateSchema }), hrCandidateController.createCandidate);
router.post('/from-email', writeLimiter, validate({ body: createFromEmailSchema }), hrCandidateController.createFromEmail);

router.get('/:id', validate({ params: candidateIdParamSchema }), hrCandidateController.getCandidateById);
router.put('/:id', writeLimiter, validate({ params: candidateIdParamSchema, body: updateCandidateSchema }), hrCandidateController.updateCandidate);
router.patch('/:id/status', writeLimiter, validate({ params: candidateIdParamSchema, body: updateStatusSchema }), hrCandidateController.updateCandidateStatus);
router.get('/:id/audit-logs', validate({ params: candidateIdParamSchema }), hrCandidateController.getCandidateAuditLogs);

router.post('/:id/emails', writeLimiter, validate({ params: candidateIdParamSchema, body: linkEmailSchema }), hrCandidateController.linkEmail);
router.delete('/:id/emails/:emailId', writeLimiter, validate({ params: unlinkEmailParamSchema }), hrCandidateController.unlinkEmail);

export default router;
