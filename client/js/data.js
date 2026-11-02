export const teacher = { id: 'T001', name: 'Teacher', email: '', role: 'TEACHER', department: 'Computer Science' };

export const courses = [
  { id:'CSE301', code:'CSE 301', name:'Database Management Systems', department:'Computer Science', semester:'5th Semester', color:'#4f46e5', room:'Room 402', schedule:[{day:5,time:'09:00',duration:90}] },
  { id:'CSE303', code:'CSE 303', name:'Computer Networks', department:'Computer Science', semester:'5th Semester', color:'#0891b2', room:'Lab 2', schedule:[{day:5,time:'11:30',duration:90}] },
  { id:'CSE305', code:'CSE 305', name:'Software Engineering', department:'Computer Science', semester:'5th Semester', color:'#7c3aed', room:'Room 305', schedule:[{day:5,time:'14:00',duration:90}] },
  { id:'CSE307', code:'CSE 307', name:'Web Engineering', department:'Computer Science', semester:'5th Semester', color:'#ea580c', room:'Lab 1', schedule:[{day:1,time:'10:00',duration:90}] },
  { id:'CSE309', code:'CSE 309', name:'Artificial Intelligence', department:'Computer Science', semester:'5th Semester', color:'#16a34a', room:'Room 501', schedule:[{day:3,time:'12:00',duration:90}] }
];

const firstNames=['Aarav','Aditi','Arif','Anika','Farhan','Nusrat','Rafi','Sadia','Tanvir','Mahi'];
const lastNames=['Ahmed','Rahman','Hasan','Akter','Hossain'];
export const students = Array.from({length:50}, (_,i) => ({ id:`NU-CSE-${String(i+1).padStart(3,'0')}`, name:`${firstNames[i%firstNames.length]} ${lastNames[Math.floor(i/10)]}`, department:'Computer Science', semester:'5th Semester' }));

export const enrollments = courses.map((course, ci) => ({
  courseId: course.id,
  studentIds: students.filter((_,si) => ((si + ci * 3) % 10) !== 0 || si < 8).slice(0, 38 + ci * 2).map(s => s.id)
}));

const iso = d => d.toISOString().slice(0,10);
const historyDates = Array.from({length:28}, (_,i) => { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-(28-i)); return iso(d); });
export const attendance = historyDates.flatMap((date,di) => courses.map((course,ci) => {
  const roster = enrollments.find(e=>e.courseId===course.id).studentIds;
  return { id:`A-${di}-${ci}`, courseId:course.id, date, records:roster.map((studentId,si)=>({ studentId, status:((si*7+di*3+ci*5)%17 < 14-ci%2)?'PRESENT':'ABSENT' })) };
}));
