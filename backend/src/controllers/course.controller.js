import { z } from 'zod';
import { Course } from '../models/Course.js';
import { Semester } from '../models/Semester.js';
import { Student } from '../models/Student.js';
import { User } from '../models/User.js';
import { HttpError, success } from '../utils/http.js';
import { duplicate, nonEmpty, objectId, parse } from '../utils/validation.js';

const schedule=z.object({day:z.number().int().min(0).max(6),startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),durationMinutes:z.number().int().positive(),room:z.string().trim().max(100).optional()}).strict();
const base=z.object({code:nonEmpty,name:nonEmpty,department:nonEmpty,semesterId:objectId,teacherId:objectId,enrolledStudentIds:z.array(objectId).optional(),schedule:z.array(schedule).optional(),isActive:z.boolean().optional()}).strict();
const createSchema=base.refine(value=>new Set(value.enrolledStudentIds||[]).size===(value.enrolledStudentIds||[]).length,'Duplicate student enrollments are not allowed');
const updateSchema=base.partial().refine(value=>Object.keys(value).length>0,'No changes supplied').refine(value=>!value.enrolledStudentIds||new Set(value.enrolledStudentIds).size===value.enrolledStudentIds.length,'Duplicate student enrollments are not allowed');
const populate=query=>query.populate('semesterId','name academicYear startDate endDate isActive').populate('teacherId','name email department role isActive').populate('enrolledStudentIds','name roll department semester isActive');
async function validateReferences(input, existingStudentIds=[]){
  if(input.semesterId&&!await Semester.exists({_id:input.semesterId,isActive:true}))throw new HttpError(400,'INVALID_REFERENCE','Active semester not found');
  if(input.teacherId&&!await User.exists({_id:input.teacherId,role:'TEACHER',isActive:true}))throw new HttpError(400,'INVALID_REFERENCE','Active teacher not found');
  if(input.enrolledStudentIds){const found=await Student.find({_id:{$in:input.enrolledStudentIds}}).select('_id isActive').lean();if(found.length!==input.enrolledStudentIds.length)throw new HttpError(400,'INVALID_REFERENCE','One or more students were not found');const existing=new Set(existingStudentIds.map(String));if(found.some(student=>!student.isActive&&!existing.has(String(student._id))))throw new HttpError(400,'INVALID_REFERENCE','Inactive students cannot be newly enrolled');}
}
export async function listCourses(req,res,next){try{const filter=req.user.role==='ADMIN'?{}:{teacherId:req.user.id,isActive:true};const courses=await populate(Course.find(filter).sort({code:1})).lean();success(res,{courses});}catch(error){next(error);}}
export async function getCourse(req,res,next){try{const id=parse(objectId,req.params.id),filter={_id:id,...(req.user.role==='TEACHER'?{teacherId:req.user.id,isActive:true}:{})};const course=await populate(Course.findOne(filter)).lean();if(!course)throw new HttpError(404,'NOT_FOUND','Course not found');success(res,{course});}catch(error){next(error);}}
export async function createCourse(req,res,next){try{const input=parse(createSchema,req.body);await validateReferences(input);const course=await Course.create(input);success(res,{course:await populate(Course.findById(course.id)).lean()},'Course created');}catch(error){try{duplicate(error,'This course code already exists in the selected semester');}catch(mapped){next(mapped);}}}
export async function updateCourse(req,res,next){try{const id=parse(objectId,req.params.id),input=parse(updateSchema,req.body),existing=await Course.findById(id).select('enrolledStudentIds');if(!existing)throw new HttpError(404,'NOT_FOUND','Course not found');await validateReferences(input,existing.enrolledStudentIds);const course=await populate(Course.findByIdAndUpdate(id,input,{new:true,runValidators:true}));success(res,{course},'Course updated');}catch(error){try{duplicate(error,'This course code already exists in the selected semester');}catch(mapped){next(mapped);}}}
export async function deactivateCourse(req,res,next){try{const id=parse(objectId,req.params.id),course=await Course.findByIdAndUpdate(id,{isActive:false},{new:true});if(!course)throw new HttpError(404,'NOT_FOUND','Course not found');success(res,{course},'Course deactivated');}catch(error){next(error);}}
export async function listTeachers(_req,res,next){try{const teachers=await User.find({role:'TEACHER',isActive:true}).select('name email department role').sort({name:1}).lean();success(res,{teachers});}catch(error){next(error);}}
