import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Attendance } from '../src/models/Attendance.js';
import { Course } from '../src/models/Course.js';
import '../src/models/Semester.js';
import '../src/models/Student.js';
import '../src/models/User.js';

const utcDay=value=>new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth(),value.getUTCDate()));
const sessionsForCourse=(course,semester)=>{
  const day=course.schedule[0]?.day??1,start=utcDay(new Date(semester.startDate)),end=utcDay(new Date(Math.min(new Date(semester.endDate).getTime(),Date.now()))),dates=[];
  const offset=(day-start.getUTCDay()+7)%7;start.setUTCDate(start.getUTCDate()+offset);
  for(let date=new Date(start);date<=end;date.setUTCDate(date.getUTCDate()+14))dates.push(new Date(date));
  return dates.slice(-8);
};

try{
  await connectDatabase();
  const courses=await Course.find({enrolledStudentIds:{$ne:[]}}).populate('semesterId','startDate endDate');
  const operations=[];
  for(const course of courses){
    if(!course.semesterId)continue;
    for(const date of sessionsForCourse(course,course.semesterId)){
      const records=course.enrolledStudentIds.map((studentId,index)=>({studentId,status:(index*7+date.getUTCDate()+course.code.length)%13<10?'PRESENT':'ABSENT'}));
      operations.push({updateOne:{filter:{courseId:course._id,date},update:{$setOnInsert:{courseId:course._id,date,records,createdBy:course.teacherId}},upsert:true}});
    }
  }
  if(operations.length)await Attendance.bulkWrite(operations,{ordered:false});
  console.log(`Attendance seed complete: ${operations.length} deterministic sessions checked; existing sessions were preserved.`);
}catch(error){console.error('Attendance seed failed:',error.message);process.exitCode=1;}finally{await disconnectDatabase();}
