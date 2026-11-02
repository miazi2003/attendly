import { z } from 'zod';
import { Course } from '../models/Course.js';
import { HttpError } from './http.js';
import { objectId, parse } from './validation.js';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use YYYY-MM-DD dates').refine(value=>{const date=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;},'Invalid date');
export const toUtcDate = value => new Date(`${value}T00:00:00.000Z`);
export const dateString = value => new Date(value).toISOString().slice(0,10);
const dhakaParts = now => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
export const institutionalToday = (now=new Date()) => { const {year,month,day}=dhakaParts(now);return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`; };
export function archiveCutoff(now=new Date()) { const {year,month}=dhakaParts(now);return month===1?new Date(Date.UTC(year-1,11,1)):new Date(Date.UTC(year,month-2,1)); }
export const archiveStatus = (date,now=new Date()) => new Date(date)<archiveCutoff(now)?'ARCHIVED':'ACTIVE';

export async function authorizedCourses(user,{activeOnly=false}={}){
  const filter={...(user.role==='TEACHER'?{teacherId:user.id}:{}),...(activeOnly?{isActive:true}:{})};
  return Course.find(filter).select('_id code name semesterId teacherId enrolledStudentIds schedule isActive').lean();
}
export async function requireCourse(user,id,{activeOnly=false}={}){
  parse(objectId,id);const course=await Course.findOne({_id:id,...(user.role==='TEACHER'?{teacherId:user.id}:{}),...(activeOnly?{isActive:true}:{})});
  if(!course)throw new HttpError(404,'NOT_FOUND','Course not found');return course;
}
export function parseRange(query){
  const from=query.from?parse(isoDate,query.from):null,to=query.to?parse(isoDate,query.to):null;
  if(from&&to&&from>to)throw new HttpError(400,'VALIDATION_ERROR','From date must be on or before To date');
  return {from,to};
}
export function buildDateFilter({from,to}){const date={};if(from)date.$gte=toUtcDate(from);if(to)date.$lte=toUtcDate(to);return Object.keys(date).length?{date}:{};}
