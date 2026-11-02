import { Attendance } from '../models/Attendance.js';
import { Course } from '../models/Course.js';
import { Student } from '../models/Student.js';
import { success } from '../utils/http.js';
import { authorizedCourses, buildDateFilter, dateString, parseRange, requireCourse } from '../utils/attendance.js';
import { objectId, parse } from '../utils/validation.js';

const round=value=>Math.round(value*10)/10;
const percentage=(present,total)=>total?round(present/total*100):null;
async function context(req,{populateStudents=false}={}){
  let courses=await authorizedCourses(req.user);
  if(req.query.courseId){await requireCourse(req.user,req.query.courseId);courses=courses.filter(course=>String(course._id)===req.query.courseId);}
  if(req.query.semesterId){parse(objectId,req.query.semesterId);courses=courses.filter(course=>String(course.semesterId)===req.query.semesterId);}
  const query=Attendance.find({courseId:{$in:courses.map(course=>course._id)},...buildDateFilter(parseRange(req.query))}).sort({date:1});
  if(populateStudents)query.populate('records.studentId','name roll department');
  return {courses,sessions:await query.lean()};
}
const totals=sessions=>{const records=sessions.flatMap(session=>session.records),present=records.filter(record=>record.status==='PRESENT').length,absent=records.length-present;return {classes:sessions.length,present,absent,total:records.length,percentage:percentage(present,records.length)};};
export async function overview(req,res,next){try{const {sessions}=await context(req);success(res,{overview:totals(sessions)});}catch(error){next(error);}}
export async function courseReports(req,res,next){try{const {courses,sessions}=await context(req);const byCourse=new Map();for(const session of sessions){const key=String(session.courseId);if(!byCourse.has(key))byCourse.set(key,[]);byCourse.get(key).push(session);}const reports=courses.map(course=>({courseId:String(course._id),code:course.code,name:course.name,semesterId:String(course.semesterId),...totals(byCourse.get(String(course._id))||[])}));success(res,{courses:reports});}catch(error){next(error);}}
export async function studentReports(req,res,next){try{const {courses,sessions}=await context(req,{populateStudents:true}),studentIds=[...new Set(courses.flatMap(course=>course.enrolledStudentIds.map(String)))],students=await Student.find({_id:{$in:studentIds}}).select('name roll department').lean(),rows=new Map(students.map(student=>[String(student._id),{studentId:String(student._id),name:student.name,roll:student.roll,department:student.department,courses:new Set(),recorded:0,present:0,absent:0}]));for(const session of sessions)for(const record of session.records){const raw=record.studentId;if(!raw)continue;const id=String(raw._id||raw);if(!rows.has(id))rows.set(id,{studentId:id,name:raw.name||'Historical student',roll:raw.roll||id,department:raw.department||'',courses:new Set(),recorded:0,present:0,absent:0});const row=rows.get(id);row.courses.add(String(session.courseId));row.recorded++;row[record.status==='PRESENT'?'present':'absent']++;}const reports=[...rows.values()].map(row=>({...row,courses:[...row.courses],percentage:percentage(row.present,row.recorded)})).sort((a,b)=>a.name.localeCompare(b.name));success(res,{students:reports});}catch(error){next(error);}}
export async function trendReport(req,res,next){try{const {sessions}=await context(req),days=new Map();for(const session of sessions){const date=dateString(session.date),records=session.records,current=days.get(date)||{date,present:0,total:0};current.present+=records.filter(record=>record.status==='PRESENT').length;current.total+=records.length;days.set(date,current);}const trend=[...days.values()].map(day=>({date:day.date,rate:percentage(day.present,day.total)})).sort((a,b)=>a.date.localeCompare(b.date));success(res,{trend});}catch(error){next(error);}}
