import 'dotenv/config';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Course } from '../src/models/Course.js';
import { Semester } from '../src/models/Semester.js';
import { Student } from '../src/models/Student.js';
import { User } from '../src/models/User.js';

const schema = z.object({
  ADMIN_NAME: z.string().min(1), ADMIN_EMAIL: z.email(), ADMIN_PASSWORD: z.string().min(8), ADMIN_DEPARTMENT: z.string().min(1),
  TEACHER_NAME: z.string().min(1), TEACHER_EMAIL: z.email(), TEACHER_PASSWORD: z.string().min(8), TEACHER_DEPARTMENT: z.string().min(1),
  TEACHER_2_NAME: z.string().min(1), TEACHER_2_EMAIL: z.email(), TEACHER_2_PASSWORD: z.string().min(8),
  TEACHER_3_NAME: z.string().min(1), TEACHER_3_EMAIL: z.email(), TEACHER_3_PASSWORD: z.string().min(8)
});
const values = schema.parse(process.env);
const department = 'Computer Science';
const accounts = [
  { name: values.ADMIN_NAME, email: values.ADMIN_EMAIL, password: values.ADMIN_PASSWORD, department: values.ADMIN_DEPARTMENT, role: 'ADMIN' },
  { name: values.TEACHER_NAME, email: values.TEACHER_EMAIL, password: values.TEACHER_PASSWORD, department: values.TEACHER_DEPARTMENT, role: 'TEACHER' },
  { name: values.TEACHER_2_NAME, email: values.TEACHER_2_EMAIL, password: values.TEACHER_2_PASSWORD, department, role: 'TEACHER' },
  { name: values.TEACHER_3_NAME, email: values.TEACHER_3_EMAIL, password: values.TEACHER_3_PASSWORD, department, role: 'TEACHER' }
];

const semesters = [
  { name: 'Spring 2025', academicYear: '2024-2025', startDate: new Date('2025-01-12T00:00:00.000Z'), endDate: new Date('2025-05-15T00:00:00.000Z'), isActive: false },
  { name: 'Fall 2025', academicYear: '2025-2026', startDate: new Date('2025-08-17T00:00:00.000Z'), endDate: new Date('2025-12-18T00:00:00.000Z'), isActive: false },
  { name: 'Spring 2026', academicYear: '2025-2026', startDate: new Date('2026-01-11T00:00:00.000Z'), endDate: new Date('2026-05-14T00:00:00.000Z'), isActive: false },
  { name: 'Fall 2026', academicYear: '2026-2027', startDate: new Date('2026-08-16T00:00:00.000Z'), endDate: new Date('2026-12-17T00:00:00.000Z'), isActive: true }
];

const firstNames = ['Arafat','Nusrat','Tanvir','Sadia','Mahin','Farzana','Rafi','Anika','Sakib','Tasnia','Nabil','Sumaiya','Adnan','Mim','Fahim'];
const lastNames = ['Rahman','Ahmed','Hasan','Akter'];
const studentProfiles = Array.from({ length: 60 }, (_, index) => ({
  name: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`,
  roll: `CSE-2026-${String(index + 1).padStart(3, '0')}`,
  department,
  isActive: true
}));

const courseTemplates = [
  { code: 'CSE-221', name: 'Data Structures and Algorithms', semester: 'Spring 2025|2024-2025', teacher: 0, count: 32, offset: 0, schedule: [{ day: 1, startTime: '09:00', durationMinutes: 90, room: 'Room 302' }] },
  { code: 'CSE-223', name: 'Object-Oriented Programming', semester: 'Spring 2025|2024-2025', teacher: 1, count: 30, offset: 7, schedule: [{ day: 3, startTime: '11:00', durationMinutes: 90, room: 'Programming Lab 1' }] },
  { code: 'CSE-311', name: 'Database Management Systems', semester: 'Fall 2025|2025-2026', teacher: 0, count: 38, offset: 13, schedule: [{ day: 0, startTime: '10:30', durationMinutes: 90, room: 'Room 405' }] },
  { code: 'CSE-313', name: 'Computer Networks', semester: 'Fall 2025|2025-2026', teacher: 2, count: 35, offset: 21, schedule: [{ day: 2, startTime: '13:30', durationMinutes: 90, room: 'Network Lab' }] },
  { code: 'CSE-321', name: 'Software Engineering', semester: 'Spring 2026|2025-2026', teacher: 1, count: 40, offset: 5, schedule: [{ day: 1, startTime: '12:00', durationMinutes: 90, room: 'Room 501' }] },
  { code: 'CSE-323', name: 'Operating Systems', semester: 'Spring 2026|2025-2026', teacher: 2, count: 34, offset: 17, schedule: [{ day: 4, startTime: '09:30', durationMinutes: 90, room: 'Systems Lab' }] },
  { code: 'CSE-411', name: 'Artificial Intelligence', semester: 'Fall 2026|2026-2027', teacher: 0, count: 36, offset: 9, schedule: [{ day: 0, startTime: '14:00', durationMinutes: 90, room: 'AI Lab' }] },
  { code: 'CSE-413', name: 'Web Engineering', semester: 'Fall 2026|2026-2027', teacher: 1, count: 28, offset: 27, schedule: [{ day: 3, startTime: '10:00', durationMinutes: 90, room: 'Programming Lab 2' }] }
];

function assertSeedData() {
  const unique = values => new Set(values).size === values.length;
  if (accounts.filter(account => account.role === 'TEACHER').length !== 3) throw new Error('Seed must define exactly three teachers');
  if (semesters.length !== 4 || studentProfiles.length !== 60 || courseTemplates.length !== 8) throw new Error('Academic seed counts are invalid');
  if (!unique(studentProfiles.map(student => student.roll))) throw new Error('Student rolls must be unique');
  if (!courseTemplates.every(course => course.count >= 25 && course.count <= 40)) throw new Error('Course enrollment counts must be between 25 and 40');
  if (!unique(courseTemplates.map(course => `${course.semester}|${course.code}`))) throw new Error('Course codes must be unique within a semester');
}

async function seedAccount(account) {
  const email = account.email.toLowerCase();
  if (await User.exists({ email })) return User.findOne({ email });
  const { password, ...profile } = account;
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ ...profile, email, passwordHash });
}

try {
  assertSeedData();
  await connectDatabase();

  const seededUsers = [];
  for (const account of accounts) seededUsers.push(await seedAccount(account));
  const teachers = seededUsers.filter(user => user.role === 'TEACHER');

  await Semester.bulkWrite(semesters.map(semester => ({
    updateOne: { filter: { name: semester.name, academicYear: semester.academicYear }, update: { $setOnInsert: semester }, upsert: true }
  })), { ordered: true });
  const semesterDocuments = await Semester.find({ $or: semesters.map(({ name, academicYear }) => ({ name, academicYear })) });
  const semesterByKey = new Map(semesterDocuments.map(semester => [`${semester.name}|${semester.academicYear}`, semester]));
  const currentSemester = semesterByKey.get('Fall 2026|2026-2027');
  if (!currentSemester) throw new Error('Current semester could not be resolved');

  await Student.bulkWrite(studentProfiles.map(student => ({
    updateOne: { filter: { roll: student.roll }, update: { $setOnInsert: { ...student, semester: currentSemester._id } }, upsert: true }
  })), { ordered: true });
  const studentDocuments = await Student.find({ roll: { $in: studentProfiles.map(student => student.roll) } }).sort({ roll: 1 });
  const studentByRoll = new Map(studentDocuments.map(student => [student.roll, student]));
  const orderedStudents = studentProfiles.map(profile => studentByRoll.get(profile.roll));
  if (orderedStudents.some(student => !student)) throw new Error('One or more seeded students could not be resolved');

  await Course.bulkWrite(courseTemplates.map(course => {
    const semester = semesterByKey.get(course.semester);
    const teacher = teachers[course.teacher];
    if (!semester || !teacher) throw new Error(`References could not be resolved for ${course.code}`);
    const enrolledStudentIds = Array.from({ length: course.count }, (_, index) => orderedStudents[(course.offset + index) % orderedStudents.length]._id);
    return { updateOne: {
      filter: { code: course.code, semesterId: semester._id },
      update: { $setOnInsert: { code: course.code, name: course.name, department, semesterId: semester._id, teacherId: teacher._id, enrolledStudentIds, schedule: course.schedule, isActive: true } },
      upsert: true
    } };
  }), { ordered: true });

  console.log('Seed complete: 3 teachers, 4 semesters, 60 students, and 8 courses are available. Existing records were preserved.');
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
