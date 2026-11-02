import { teacher, courses as mockCourses, students as mockStudents, enrollments as mockEnrollments } from './data.js';

let courses=mockCourses,students=mockStudents,enrollments=mockEnrollments;

const data = { teacher, courses, students, enrollments, semesters:[], teachers:[], attendance:[], reports:{overview:{classes:0,present:0,absent:0,total:0,percentage:null},courses:[],students:[],trend:[]} };
const state = { authenticated:false,persistenceWarning:null };
const listeners=new Set();
const roster = courseId => data.enrollments.find(e=>e.courseId===courseId)?.studentIds || [];
const roundPercent = value => Math.round(value*10)/10;
const rateFor = sessions => { const records=sessions.flatMap(validRecords); return records.length ? roundPercent(records.filter(r=>r.status==='PRESENT').length/records.length*100) : null; };
const student = id => students.find(s=>s.id===id);
const validRecords = session => session.records.filter(r=>['PRESENT','ABSENT'].includes(r.status));
const totalsFor = sessions => { const unique=[...new Map(sessions.map(session=>[`${session.courseId}|${session.date}`,session])).values()],records=unique.flatMap(validRecords),present=records.filter(r=>r.status==='PRESENT').length,absent=records.length-present;return {classes:unique.length,present,absent,total:records.length,percentage:records.length?roundPercent(present/records.length*100):null}; };
const notify = change => listeners.forEach(listener=>{try{listener(change);}catch(error){console.error('State subscriber failed',error);}});

export const store = {
  data,
  subscribe(listener){ if(typeof listener!=='function')return()=>{};listeners.add(listener);return()=>listeners.delete(listener); },
  persistenceWarning(){ return state.persistenceWarning; },
  setAuthenticatedUser(user){ Object.assign(data.teacher,{id:user.id,name:user.name,email:user.email,role:user.role,department:user.department});state.authenticated=true; },
  replaceManagement(payload){courses=payload.courses;students=payload.students;enrollments=payload.enrollments;data.courses=courses;data.students=students;data.enrollments=enrollments;data.semesters=payload.semesters;data.teachers=payload.teachers||[];notify({type:'management'});},
  replaceAttendance(attendance){data.attendance=attendance;notify({type:'attendance'});},
  replaceReports(reports){data.reports=reports;notify({type:'reports'});},
  logout(){ state.authenticated=false; },
  isAuthenticated(){ return state.authenticated; },
  course(id){ return courses.find(c=>c.id===id)||data.attendance.find(session=>session.courseId===id)?.course; },
  student,
  roster,
  courseStudents(id){ return roster(id).map(student).filter(Boolean); },
  studentCourses(id){ return enrollments.filter(e=>e.studentIds.includes(id)).map(e=>courses.find(c=>c.id===e.courseId)).filter(Boolean); },
  enrolledStudents(){ const ids=[...new Set(enrollments.flatMap(e=>e.studentIds))]; return ids.map(student).filter(Boolean); },
  studentCourseRate(studentId,courseId){ const sessions=data.attendance.filter(a=>a.courseId===courseId).map(a=>({...a,records:a.records.filter(r=>r.studentId===studentId)})); return rateFor(sessions); },
  studentRate(studentId){ const sessions=data.attendance.map(a=>({...a,records:a.records.filter(r=>r.studentId===studentId)})); return rateFor(sessions); },
  courseRate(id){ return data.reports.courses.find(report=>report.courseId===id)?.percentage??null; },
  overallRate(){ return data.reports.overview.percentage; },
  uniqueStudents(){ return new Set(enrollments.flatMap(e=>e.studentIds)).size; },
  todayClasses(){ const day=new Date().getDay(); return courses.flatMap(c=>c.schedule.filter(s=>s.day===day).map(s=>({...s,course:c}))); },
  recent(count=5){ return data.attendance.filter(session=>this.course(session.courseId)).sort((a,b)=>b.date.localeCompare(a.date)||a.courseId.localeCompare(b.courseId)).slice(0,count); },
  trend(count=7){ return data.reports.trend.slice(-count); },
  attendanceSessions(){ return data.attendance.filter(session=>this.course(session.courseId)).sort((a,b)=>b.date.localeCompare(a.date)||a.courseId.localeCompare(b.courseId)); },
  reportOverview(){ return data.reports.overview; },
  courseReports(){ return data.reports.courses.map(report=>({course:this.course(report.courseId)||{id:report.courseId,code:report.code,name:report.name,color:'#4f46e5'},...report})); },
  studentReports(courseId=''){
    return data.reports.students.filter(report=>!courseId||report.courses.includes(courseId)).map(report=>({student:this.student(report.studentId)||{id:report.studentId,name:report.name,roll:report.roll},courses:report.courses.map(id=>this.course(id)).filter(Boolean),present:report.present,absent:report.absent,recorded:report.recorded,percentage:report.percentage}));
  },
  attendanceSession(courseId,date){ return data.attendance.find(a=>a.courseId===courseId&&a.date===date); },
  sessionRate: session => rateFor([session])
};
