import { Router } from 'express';
import { listTeachers } from '../controllers/course.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const teacherRouter = Router();
teacherRouter.use(authenticate, authorize('ADMIN'));
teacherRouter.get('/', listTeachers);
