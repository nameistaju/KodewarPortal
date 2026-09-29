import { Router } from 'express';
import * as leaveController from '../controllers/leaveController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  applyLeaveSchema,
  cancelLeaveSchema,
  leaveIdParamsSchema,
  leaveQuerySchema,
  reviewLeaveSchema
} from '../validators/leaveValidator.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .post(writeLimiter, validate({ body: applyLeaveSchema }), leaveController.apply)
  .get(validate({ query: leaveQuerySchema }), leaveController.history);

router.post(
  '/:leaveId/cancel',
  writeLimiter,
  validate({ params: leaveIdParamsSchema, body: cancelLeaveSchema }),
  leaveController.cancel
);
router.post(
  '/:leaveId/approve',
  authorizeRoles(ROLES.ADMIN),
  writeLimiter,
  validate({ params: leaveIdParamsSchema, body: reviewLeaveSchema }),
  leaveController.approve
);
router.post(
  '/:leaveId/reject',
  authorizeRoles(ROLES.ADMIN),
  writeLimiter,
  validate({ params: leaveIdParamsSchema, body: reviewLeaveSchema }),
  leaveController.reject
);

export default router;
