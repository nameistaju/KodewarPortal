import { Router } from 'express';
import * as employeeController from '../controllers/employeeController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { upload, validateImageUpload } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authSensitiveLimiter, uploadLimiter, writeLimiter } from '../middleware/rateLimiters.js';
import {
  createEmployeeSchema,
  employeeIdParamsSchema,
  employeeQuerySchema,
  updateEmployeeSchema,
  updateProfileSchema
} from '../validators/employeeValidator.js';
import { resetPasswordSchema } from '../validators/authValidator.js';

const router = Router();

router.use(protect);

router.get('/me/profile', employeeController.getProfile);
router.patch(
  '/me/profile',
  uploadLimiter,
  upload.single('profilePhoto'),
  validateImageUpload,
  validate({ body: updateProfileSchema }),
  employeeController.updateProfile
);

router.use(authorizeRoles(ROLES.ADMIN));

router
  .route('/')
  .post(
    writeLimiter,
    uploadLimiter,
    upload.single('profilePhoto'),
    validateImageUpload,
    validate({ body: createEmployeeSchema }),
    employeeController.createEmployee
  )
  .get(validate({ query: employeeQuerySchema }), employeeController.getEmployees);

router
  .route('/:employeeId')
  .get(validate({ params: employeeIdParamsSchema }), employeeController.getEmployeeById)
  .patch(
    writeLimiter,
    uploadLimiter,
    upload.single('profilePhoto'),
    validateImageUpload,
    validate({ params: employeeIdParamsSchema, body: updateEmployeeSchema }),
    employeeController.updateEmployee
  );

router.post(
  '/:employeeId/deactivate',
  writeLimiter,
  validate({ params: employeeIdParamsSchema }),
  employeeController.deactivateEmployee
);
router.post(
  '/:employeeId/activate',
  writeLimiter,
  validate({ params: employeeIdParamsSchema }),
  employeeController.activateEmployee
);
router.post(
  '/:employeeId/reset-password',
  authSensitiveLimiter,
  validate({ params: employeeIdParamsSchema, body: resetPasswordSchema }),
  employeeController.resetEmployeePassword
);
router.get(
  '/:employeeId/security',
  validate({ params: employeeIdParamsSchema }),
  employeeController.getEmployeeSecurity
);
router.post(
  '/:employeeId/logout-all',
  writeLimiter,
  validate({ params: employeeIdParamsSchema }),
  employeeController.logoutEmployeeFromAllDevices
);

export default router;
