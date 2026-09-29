import { Router } from 'express';
import * as holidayController from '../controllers/holidayController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  holidayIdParamsSchema,
  holidayQuerySchema,
  holidaySchema,
  updateHolidaySchema
} from '../validators/holidayValidator.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(validate({ query: holidayQuerySchema }), holidayController.list)
  .post(authorizeRoles(ROLES.ADMIN), writeLimiter, validate({ body: holidaySchema }), holidayController.create);

router
  .route('/:holidayId')
  .patch(
    authorizeRoles(ROLES.ADMIN),
    writeLimiter,
    validate({ params: holidayIdParamsSchema, body: updateHolidaySchema }),
    holidayController.update
  )
  .delete(authorizeRoles(ROLES.ADMIN), writeLimiter, validate({ params: holidayIdParamsSchema }), holidayController.remove);

export default router;
