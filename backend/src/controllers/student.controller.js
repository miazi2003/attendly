import { z } from 'zod';
import { Course } from '../models/Course.js';
import { Semester } from '../models/Semester.js';
import { Student } from '../models/Student.js';
import { HttpError, success } from '../utils/http.js';
import { duplicate, nonEmpty, objectId, parse } from '../utils/validation.js';

const createSchema = z.object({ name: nonEmpty, roll: nonEmpty, department: nonEmpty, semester: objectId, isActive: z.boolean().optional() }).strict();
const updateSchema = createSchema.partial().refine(value => Object.keys(value).length > 0, 'No changes supplied');
const semesterExists = async id => { if (!await Semester.exists({ _id: id })) throw new HttpError(400, 'INVALID_REFERENCE', 'Semester not found'); };
const teacherStudentIds = async teacherId => (await Course.find({ teacherId, isActive: true }).distinct('enrolledStudentIds')).map(String);

export async function listStudents(req, res, next) {
  try {
    const filter = req.user.role === 'ADMIN' ? {} : { _id: { $in: await teacherStudentIds(req.user.id) }, isActive: true };
    const students = await Student.find(filter).populate('semester', 'name academicYear').sort({ name: 1 }).lean();
    success(res, { students });
  } catch (error) { next(error); }
}
export async function getStudent(req, res, next) {
  try {
    const id = parse(objectId, req.params.id);
    if (req.user.role === 'TEACHER' && !(await teacherStudentIds(req.user.id)).includes(id)) throw new HttpError(403, 'FORBIDDEN', 'Student is not enrolled in your courses');
    const student = await Student.findById(id).populate('semester', 'name academicYear').lean();
    if (!student) throw new HttpError(404, 'NOT_FOUND', 'Student not found');
    success(res, { student });
  } catch (error) { next(error); }
}
export async function createStudent(req, res, next) {
  try { const input=parse(createSchema,req.body);await semesterExists(input.semester);const student=await Student.create(input);success(res,{student},'Student created'); }
  catch(error){try{duplicate(error,'A student with this ID already exists');}catch(mapped){next(mapped);}}
}
export async function updateStudent(req, res, next) {
  try { const id=parse(objectId,req.params.id),input=parse(updateSchema,req.body);if(input.semester)await semesterExists(input.semester);const student=await Student.findByIdAndUpdate(id,input,{new:true,runValidators:true}).populate('semester','name academicYear');if(!student)throw new HttpError(404,'NOT_FOUND','Student not found');success(res,{student},'Student updated'); }
  catch(error){try{duplicate(error,'A student with this ID already exists');}catch(mapped){next(mapped);}}
}
export async function deactivateStudent(req,res,next){try{const id=parse(objectId,req.params.id);const student=await Student.findByIdAndUpdate(id,{isActive:false},{new:true});if(!student)throw new HttpError(404,'NOT_FOUND','Student not found');success(res,{student},'Student deactivated');}catch(error){next(error);}}
