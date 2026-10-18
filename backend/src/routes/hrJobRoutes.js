import { Router } from 'express';
import * as hrJobController from '../controllers/hrJobController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  jobQuerySchema,
  jobIdParamSchema,
  createJobSchema,
  updateJobSchema
} from '../validators/hrJobValidator.js';

const router = Router();

// Strict authorization: HR or Admin only. Ordinary employees cannot access.
router.use(protect);
router.use(authorizeRoles(ROLES.HR, ROLES.ADMIN));

router.get('/', validate({ query: jobQuerySchema }), hrJobController.getJobs);
router.post('/', writeLimiter, validate({ body: createJobSchema }), hrJobController.createJob);

router.get('/:id', validate({ params: jobIdParamSchema }), hrJobController.getJobById);
router.put('/:id', writeLimiter, validate({ params: jobIdParamSchema, body: updateJobSchema }), hrJobController.updateJob);
router.delete('/:id', writeLimiter, validate({ params: jobIdParamSchema }), hrJobController.archiveJob);

export default router;
