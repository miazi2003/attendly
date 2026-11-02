import { Router } from 'express';
import { createSemester, deactivateSemester, listSemesters, updateSemester } from '../controllers/semester.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
export const semesterRouter=Router();semesterRouter.use(authenticate);semesterRouter.get('/',listSemesters);semesterRouter.post('/',authorize('ADMIN'),createSemester);semesterRouter.patch('/:id',authorize('ADMIN'),updateSemester);semesterRouter.delete('/:id',authorize('ADMIN'),deactivateSemester);
