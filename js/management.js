import { api } from './api.js';
import { store } from './state.js';

const colors=['#4f46e5','#0891b2','#7c3aed','#ea580c','#16a34a','#dc2626'];
const studentFromApi=student=>({id:student._id,name:student.name,roll:student.roll,department:student.department,semester:student.semester?.name||'Unassigned',semesterId:student.semester?._id||student.semester,isActive:student.isActive});
const courseFromApi=(course,index)=>({id:course._id,code:course.code,name:course.name,department:course.department,semester:course.semesterId?.name||'Unassigned',semesterId:course.semesterId?._id||course.semesterId,teacherId:course.teacherId?._id||course.teacherId,teacher:course.teacherId,enrolledStudentIds:(course.enrolledStudentIds||[]).map(student=>student._id||student),schedule:(course.schedule||[]).map(item=>({day:item.day,time:item.startTime,duration:item.durationMinutes,room:item.room||'—'})),room:course.schedule?.[0]?.room||'—',isActive:course.isActive,color:colors[index%colors.length]});

export async function loadManagementData(){
  const admin=store.data.teacher.role==='ADMIN';
  const [studentData,semesterData,courseData,teacherData]=await Promise.all([api('/api/students'),api('/api/semesters'),api('/api/courses'),admin?api('/api/teachers'):Promise.resolve({teachers:[]})]);
  const students=studentData.students.map(studentFromApi),courses=courseData.courses.map(courseFromApi);
  store.replaceManagement({students,courses,semesters:semesterData.semesters,teachers:teacherData.teachers,enrollments:courses.map(course=>({courseId:course.id,studentIds:course.enrolledStudentIds}))});
}

export { studentFromApi, courseFromApi };
