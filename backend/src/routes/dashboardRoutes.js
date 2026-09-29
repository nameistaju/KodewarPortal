import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();

router.use(protect);

router.get('/admin', authorizeRoles(ROLES.ADMIN), dashboardController.adminDashboard);
router.get('/employee', dashboardController.employeeDashboard);

export default router;
