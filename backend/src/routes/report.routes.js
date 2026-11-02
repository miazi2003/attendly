import { Router } from 'express';
import { courseReports, overview, studentReports, trendReport } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
export const reportRouter=Router();reportRouter.use(authenticate);reportRouter.get('/overview',overview);reportRouter.get('/courses',courseReports);reportRouter.get('/students',studentReports);reportRouter.get('/trend',trendReport);
