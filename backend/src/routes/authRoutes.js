import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authSensitiveLimiter, loginLimiter, refreshLimiter } from '../middleware/rateLimiters.js';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema
} from '../validators/authValidator.js';

const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', refreshLimiter, validate({ body: refreshTokenSchema }), authController.refresh);

router.use(protect);

router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);
router.post(
  '/change-password',
  authSensitiveLimiter,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);
router.post(
  '/reset-password/:employeeId',
  authSensitiveLimiter,
  authorizeRoles(ROLES.ADMIN),
  validate({ params: resetPasswordParamsSchema, body: resetPasswordSchema }),
  authController.resetEmployeePassword
);

export default router;
