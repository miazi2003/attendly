import { z } from 'zod';
import { Attendance } from '../models/Attendance.js';
import { HttpError, success } from '../utils/http.js';
import { archiveCutoff, archiveStatus, authorizedCourses, buildDateFilter, dateString, institutionalToday, isoDate, parseRange, requireCourse, toUtcDate } from '../utils/attendance.js';
import { objectId, parse } from '../utils/validation.js';

const record=z.object({studentId:objectId,status:z.enum(['PRESENT','ABSENT'])}).strict();
const createSchema=z.object({courseId:objectId,date:isoDate,records:z.array(record).min(1)}).strict();
const updateSchema=z.object({records:z.array(record).min(1)}).strict();
const uniqueRecords=records=>new Set(records.map(item=>item.studentId)).size===records.length;
function validateRecords(records,expectedIds){const actual=new Set(records.map(item=>item.studentId)),expected=new Set(expectedIds.map(String));if(!uniqueRecords(records)||actual.size!==expected.size||[...actual].some(id=>!expected.has(id)))throw new HttpError(400,'VALIDATION_ERROR','Attendance must contain exactly one record for every enrolled student');}
const publicSession=session=>{const raw=session.toObject?session.toObject():session;return {...raw,id:String(raw._id),date:dateString(raw.date),archiveStatus:archiveStatus(raw.date)};};

export async function listAttendance(req,res,next){try{const courses=await authorizedCourses(req.user),courseIds=courses.map(course=>course._id);if(req.query.courseId){await requireCourse(req.user,req.query.courseId);courseIds.splice(0,courseIds.length,req.query.courseId);}if(req.query.semesterId){parse(objectId,req.query.semesterId);const allowed=new Set(courses.filter(course=>String(course.semesterId)===req.query.semesterId).map(course=>String(course._id)));for(let index=courseIds.length-1;index>=0;index--)if(!allowed.has(String(courseIds[index])))courseIds.splice(index,1);}const range=parseRange(req.query),date=buildDateFilter(range).date||{};if(req.query.status){if(!['ACTIVE','ARCHIVED'].includes(req.query.status))throw new HttpError(400,'VALIDATION_ERROR','Invalid archive status');const cutoff=archiveCutoff();if(req.query.status==='ACTIVE')date.$gte=date.$gte&&date.$gte>cutoff?date.$gte:cutoff;else date.$lt=cutoff;}const filter={courseId:{$in:courseIds},...(Object.keys(date).length?{date}:{})};const sessions=(await Attendance.find(filter).populate('courseId','code name semesterId teacherId').populate('records.studentId','name roll department').sort({date:-1,courseId:1}).lean()).map(publicSession);success(res,{attendance:sessions});}catch(error){next(error);}}
export async function getAttendance(req,res,next){try{parse(objectId,req.params.id);const session=await Attendance.findById(req.params.id).populate('courseId','code name semesterId teacherId').populate('records.studentId','name roll department');if(!session)throw new HttpError(404,'NOT_FOUND','Attendance session not found');await requireCourse(req.user,String(session.courseId._id));success(res,{attendance:publicSession(session)});}catch(error){next(error);}}
export async function createAttendance(req,res,next){
  try{
    const input=parse(createSchema,req.body),course=await requireCourse(req.user,input.courseId,{activeOnly:true});
    if(input.date>institutionalToday())throw new HttpError(400,'VALIDATION_ERROR','Attendance cannot be recorded for a future date');
    if(req.user.role==='TEACHER'&&archiveStatus(toUtcDate(input.date))==='ARCHIVED')throw new HttpError(403,'ARCHIVED','Archived attendance can only be recorded by an administrator');
    validateRecords(input.records,course.enrolledStudentIds);
    const session=await Attendance.create({...input,date:toUtcDate(input.date),createdBy:req.user.id});
    success(res,{attendance:publicSession(session)},'Attendance saved');
  }catch(error){
    if(error?.code===11000)return next(new HttpError(409,'DUPLICATE','Attendance already exists for this course and date'));
    next(error);
  }
}
export async function updateAttendance(req,res,next){
  try{
    parse(objectId,req.params.id);
    const input=parse(updateSchema,req.body),session=await Attendance.findById(req.params.id);
    if(!session)throw new HttpError(404,'NOT_FOUND','Attendance session not found');
    await requireCourse(req.user,String(session.courseId));
    if(req.user.role==='TEACHER'&&archiveStatus(session.date)==='ARCHIVED')throw new HttpError(403,'ARCHIVED','Archived attendance can only be corrected by an administrator');
    validateRecords(input.records,session.records.map(item=>item.studentId));
    session.records=input.records;
    await session.save();
    success(res,{attendance:publicSession(session)},'Attendance updated');
  }catch(error){next(error);}
}
export async function deleteAttendance(req,res,next){
  try{
    parse(objectId,req.params.id);
    const session=await Attendance.findById(req.params.id);
    if(!session)throw new HttpError(404,'NOT_FOUND','Attendance session not found');
    await requireCourse(req.user,String(session.courseId));
    if(req.user.role==='TEACHER'&&archiveStatus(session.date)==='ARCHIVED')throw new HttpError(403,'ARCHIVED','Archived attendance can only be deleted by an administrator');
    await Attendance.findByIdAndDelete(req.params.id);
    success(res,null,'Attendance session deleted');
  }catch(error){next(error);}
}
