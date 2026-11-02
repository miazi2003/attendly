import { api } from './api.js';
import { store } from './state.js';

const queryString=params=>{const query=new URLSearchParams();Object.entries(params||{}).forEach(([key,value])=>{if(value)query.set(key,value);});const text=query.toString();return text?`?${text}`:'';};
export const attendanceFromApi=session=>({id:session.id||session._id,courseId:session.courseId?._id||session.courseId,course:session.courseId,date:session.date,archiveStatus:session.archiveStatus,records:(session.records||[]).map(record=>({studentId:record.studentId?._id||record.studentId,student:record.studentId,status:record.status}))});
export async function loadAttendance(params={}){const data=await api(`/api/attendance${queryString(params)}`);const attendance=data.attendance.map(attendanceFromApi);store.replaceAttendance(attendance);return attendance;}
export async function loadReports(params={}){const query=queryString(params),[overview,courses,students,trend]=await Promise.all([api(`/api/reports/overview${query}`),api(`/api/reports/courses${query}`),api(`/api/reports/students${query}`),api(`/api/reports/trend${query}`)]);const reports={overview:overview.overview,courses:courses.courses,students:students.students,trend:trend.trend};store.replaceReports(reports);return reports;}
