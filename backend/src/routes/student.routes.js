import { Router } from 'express';
import { createStudent, deactivateStudent, getStudent, listStudents, updateStudent } from '../controllers/student.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
export const studentRouter=Router();studentRouter.use(authenticate);studentRouter.get('/',listStudents);studentRouter.get('/:id',getStudent);studentRouter.post('/',authorize('ADMIN'),createStudent);studentRouter.patch('/:id',authorize('ADMIN'),updateStudent);studentRouter.delete('/:id',authorize('ADMIN'),deactivateStudent);
