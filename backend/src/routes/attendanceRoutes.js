import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { attendanceLimiter, writeLimiter } from '../middleware/rateLimiters.js';
import {
  adminAttendanceQuerySchema,
  attendanceHistoryQuerySchema,
  attendanceSettingSchema,
  monthlySummaryQuerySchema,
  punchSchema
} from '../validators/attendanceValidator.js';

const router = Router();

router.use(protect);

router.get('/settings', attendanceController.getOfficeSetting);
router.put(
  '/settings',
  authorizeRoles(ROLES.ADMIN),
  writeLimiter,
  validate({ body: attendanceSettingSchema }),
  attendanceController.configureOffice
);
router.get('/status', attendanceController.getTodayStatus);
router.post(
  '/punch-in',
  authorizeRoles(ROLES.EMPLOYEE),
  attendanceLimiter,
  validate({ body: punchSchema }),
  attendanceController.punchIn
);
router.post(
  '/punch-out',
  authorizeRoles(ROLES.EMPLOYEE),
  attendanceLimiter,
  validate({ body: punchSchema }),
  attendanceController.punchOut
);
router.get(
  '/admin',
  authorizeRoles(ROLES.ADMIN),
  validate({ query: adminAttendanceQuerySchema }),
  attendanceController.adminAttendanceCenter
);
router.get(
  '/admin/export',
  authorizeRoles(ROLES.ADMIN),
  validate({ query: adminAttendanceQuerySchema }),
  attendanceController.exportAdminAttendance
);
router.get('/admin/:id', authorizeRoles(ROLES.ADMIN), attendanceController.adminAttendanceDetail);
router.get('/history', validate({ query: attendanceHistoryQuerySchema }), attendanceController.history);
router.get('/monthly-summary', validate({ query: monthlySummaryQuerySchema }), attendanceController.monthlySummary);

export default router;
