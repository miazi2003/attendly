import { Router } from 'express';
import { createAttendance, getAttendance, listAttendance, updateAttendance } from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.js';
export const attendanceRouter=Router();attendanceRouter.use(authenticate);attendanceRouter.get('/',listAttendance);attendanceRouter.get('/:id',getAttendance);attendanceRouter.post('/',createAttendance);attendanceRouter.patch('/:id',updateAttendance);
