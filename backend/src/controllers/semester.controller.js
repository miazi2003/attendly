import { z } from 'zod';
import { Course } from '../models/Course.js';
import { Semester } from '../models/Semester.js';
import { HttpError, success } from '../utils/http.js';
import { duplicate, nonEmpty, objectId, parse } from '../utils/validation.js';

const dateString=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use YYYY-MM-DD dates');
const base=z.object({name:nonEmpty,academicYear:nonEmpty,startDate:dateString,endDate:dateString,isActive:z.boolean().optional()}).strict();
const datesValid=value=>!value.startDate||!value.endDate||new Date(value.startDate)<=new Date(value.endDate);
const createSchema=base.refine(datesValid,{message:'End date must be on or after start date'});
const updateSchema=base.partial().refine(value=>Object.keys(value).length>0,'No changes supplied');
export async function listSemesters(_req,res,next){try{const semesters=await Semester.find().sort({startDate:-1}).lean();success(res,{semesters});}catch(error){next(error);}}
export async function createSemester(req,res,next){try{const input=parse(createSchema,req.body);const semester=await Semester.create(input);success(res,{semester},'Semester created');}catch(error){try{duplicate(error,'This semester and academic year already exist');}catch(mapped){next(mapped);}}}
export async function updateSemester(req,res,next){try{const id=parse(objectId,req.params.id),input=parse(updateSchema,req.body),current=await Semester.findById(id);if(!current)throw new HttpError(404,'NOT_FOUND','Semester not found');const merged={startDate:input.startDate||current.startDate.toISOString().slice(0,10),endDate:input.endDate||current.endDate.toISOString().slice(0,10)};if(!datesValid(merged))throw new HttpError(400,'VALIDATION_ERROR','End date must be on or after start date');Object.assign(current,input);await current.save();success(res,{semester:current},'Semester updated');}catch(error){try{duplicate(error,'This semester and academic year already exist');}catch(mapped){next(mapped);}}}
export async function deactivateSemester(req,res,next){try{const id=parse(objectId,req.params.id),semester=await Semester.findById(id);if(!semester)throw new HttpError(404,'NOT_FOUND','Semester not found');semester.isActive=false;await semester.save();const relatedCourses=await Course.countDocuments({semesterId:id});success(res,{semester,relatedCourses},relatedCourses?'Semester deactivated; related courses were preserved':'Semester deactivated');}catch(error){next(error);}}
