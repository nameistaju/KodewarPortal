import { Router } from 'express';
import * as teamController from '../controllers/teamController.js';
import { ROLES } from '../constants/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimiters.js';
import {
  teamIdParamsSchema,
  teamQuerySchema,
  teamSchema,
  updateTeamSchema
} from '../validators/teamValidator.js';

const router = Router();

router.use(protect);

router.get('/', validate({ query: teamQuerySchema }), teamController.getTeams);

router.use(authorizeRoles(ROLES.ADMIN));

router.post('/', writeLimiter, validate({ body: teamSchema }), teamController.createTeam);
router.put('/:id', writeLimiter, validate({ params: teamIdParamsSchema, body: updateTeamSchema }), teamController.updateTeam);
router.delete('/:id', writeLimiter, validate({ params: teamIdParamsSchema }), teamController.deleteTeam);

export default router;
