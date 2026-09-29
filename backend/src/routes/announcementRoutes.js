import { Router } from 'express';
import * as announcementController from '../controllers/announcementController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  announcementIdParamsSchema,
  announcementQuerySchema,
  announcementSchema,
  updateAnnouncementSchema
} from '../validators/announcementValidator.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(validate({ query: announcementQuerySchema }), announcementController.list)
  .post(authorizeRoles(ROLES.ADMIN), writeLimiter, validate({ body: announcementSchema }), announcementController.create);

router
  .route('/:announcementId')
  .patch(
    authorizeRoles(ROLES.ADMIN),
    writeLimiter,
    validate({ params: announcementIdParamsSchema, body: updateAnnouncementSchema }),
    announcementController.update
  )
  .delete(
    authorizeRoles(ROLES.ADMIN),
    writeLimiter,
    validate({ params: announcementIdParamsSchema }),
    announcementController.remove
  );

export default router;
