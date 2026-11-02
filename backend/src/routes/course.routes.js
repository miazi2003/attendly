import { Router } from 'express';
import { createCourse, deactivateCourse, getCourse, listCourses, listTeachers, updateCourse } from '../controllers/course.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
export const courseRouter=Router();courseRouter.use(authenticate);courseRouter.get('/teachers',authorize('ADMIN'),listTeachers);courseRouter.get('/',listCourses);courseRouter.get('/:id',getCourse);courseRouter.post('/',authorize('ADMIN'),createCourse);courseRouter.patch('/:id',authorize('ADMIN'),updateCourse);courseRouter.delete('/:id',authorize('ADMIN'),deactivateCourse);
