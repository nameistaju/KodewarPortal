import { Router } from 'express';
import * as hrApplicationController from '../controllers/hrApplicationController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  applicationQuerySchema,
  applicationIdParamSchema,
  createApplicationSchema,
  updateApplicationSchema,
  updateApplicationStatusSchema,
  createApplicationFromEmailSchema
} from '../validators/hrApplicationValidator.js';

const router = Router();

// Strict authorization: HR or Admin only. Ordinary employees cannot access.
router.use(protect);
router.use(authorizeRoles(ROLES.HR, ROLES.ADMIN));

router.get('/', validate({ query: applicationQuerySchema }), hrApplicationController.getApplications);
router.post('/', writeLimiter, validate({ body: createApplicationSchema }), hrApplicationController.createApplication);
router.post('/from-email', writeLimiter, validate({ body: createApplicationFromEmailSchema }), hrApplicationController.createFromEmail);

router.get('/:id', validate({ params: applicationIdParamSchema }), hrApplicationController.getApplicationById);
router.put('/:id', writeLimiter, validate({ params: applicationIdParamSchema, body: updateApplicationSchema }), hrApplicationController.updateApplication);
router.patch('/:id/status', writeLimiter, validate({ params: applicationIdParamSchema, body: updateApplicationStatusSchema }), hrApplicationController.updateApplicationStatus);
router.get('/:id/audit-logs', validate({ params: applicationIdParamSchema }), hrApplicationController.getApplicationAuditLogs);

export default router;
