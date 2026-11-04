import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/attendly_test';
process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-chars-long!!';
process.env.FRONTEND_ORIGINS = 'http://localhost:3000,https://attendly-app.netlify.app';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';

const { Course } = await import('../src/models/Course.js');
const { Attendance } = await import('../src/models/Attendance.js');
const { createAttendance, updateAttendance, deleteAttendance } = await import('../src/controllers/attendance.controller.js');

test('Teacher & Admin Attendance Authorization & Archive Controls', async (t) => {
  const teacherUser = { id: '654321654321654321654321', role: 'TEACHER' };
  const adminUser = { id: '123456123456123456123456', role: 'ADMIN' };
  const assignedCourseId = '507f1f77bcf86cd799439011';
  const unassignedCourseId = '507f1f77bcf86cd799439022';

  // Helper to mock Course.findOne
  const origCourseFindOne = Course.findOne;
  const origAttendanceFindById = Attendance.findById;
  const origAttendanceCreate = Attendance.create;
  const origAttendanceFindByIdAndDelete = Attendance.findByIdAndDelete;

  t.afterEach(() => {
    Course.findOne = origCourseFindOne;
    Attendance.findById = origAttendanceFindById;
    Attendance.create = origAttendanceCreate;
    Attendance.findByIdAndDelete = origAttendanceFindByIdAndDelete;
  });

  await t.test('prevents teacher from creating attendance in unauthorized course', async () => {
    Course.findOne = () => ({
      // Returns null because filter has teacherId: teacherUser.id
      lean: async () => null,
      then: (resolve) => resolve(null)
    });

    const req = {
      user: teacherUser,
      body: {
        courseId: unassignedCourseId,
        date: '2026-11-04',
        records: [{ studentId: '507f1f77bcf86cd799439033', status: 'PRESENT' }]
      }
    };

    let errorCaught = null;
    await createAttendance(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 404);
    assert.equal(errorCaught.code, 'NOT_FOUND');
  });

  await t.test('prevents teacher from creating attendance for an archived date (direct API bypass attempt)', async () => {
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      teacherId: teacherUser.id,
      enrolledStudentIds: ['507f1f77bcf86cd799439033'],
      isActive: true
    });

    const req = {
      user: teacherUser,
      body: {
        courseId: assignedCourseId,
        date: '2026-08-15', // Archived month (cutoff for Nov 2026 is Oct 1, 2026)
        records: [{ studentId: '507f1f77bcf86cd799439033', status: 'PRESENT' }]
      }
    };

    let errorCaught = null;
    await createAttendance(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 403);
    assert.equal(errorCaught.code, 'ARCHIVED');
  });

  await t.test('allows admin to create attendance for an archived date', async () => {
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      teacherId: teacherUser.id,
      enrolledStudentIds: ['507f1f77bcf86cd799439033'],
      isActive: true
    });
    Attendance.create = (doc) => Promise.resolve({
      ...doc,
      _id: '507f1f77bcf86cd799439099'
    });

    const req = {
      user: adminUser,
      body: {
        courseId: assignedCourseId,
        date: '2026-08-15',
        records: [{ studentId: '507f1f77bcf86cd799439033', status: 'PRESENT' }]
      }
    };

    let responseData = null;
    const res = {
      json: (payload) => { responseData = payload; }
    };

    await createAttendance(req, res, (err) => { assert.ifError(err); });
    assert.ok(responseData);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.attendance.archiveStatus, 'ARCHIVED');
  });

  await t.test('allows teacher to create attendance in active month', async () => {
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      teacherId: teacherUser.id,
      enrolledStudentIds: ['507f1f77bcf86cd799439033'],
      isActive: true
    });
    Attendance.create = (doc) => Promise.resolve({
      ...doc,
      _id: '507f1f77bcf86cd799439099'
    });

    const req = {
      user: teacherUser,
      body: {
        courseId: assignedCourseId,
        date: '2026-11-01',
        records: [{ studentId: '507f1f77bcf86cd799439033', status: 'PRESENT' }]
      }
    };

    let responseData = null;
    const res = {
      json: (payload) => { responseData = payload; }
    };

    await createAttendance(req, res, (err) => { assert.ifError(err); });
    assert.ok(responseData);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.attendance.archiveStatus, 'ACTIVE');
  });

  await t.test('prevents teacher from updating archived attendance', async () => {
    Attendance.findById = () => Promise.resolve({
      _id: '507f1f77bcf86cd799439099',
      courseId: assignedCourseId,
      date: new Date('2026-08-15T00:00:00.000Z'), // Archived
      records: [{ studentId: '507f1f77bcf86cd799439033', status: 'PRESENT' }]
    });
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      teacherId: teacherUser.id,
      isActive: true
    });

    const req = {
      user: teacherUser,
      params: { id: '507f1f77bcf86cd799439099' },
      body: {
        records: [{ studentId: '507f1f77bcf86cd799439033', status: 'ABSENT' }]
      }
    };

    let errorCaught = null;
    await updateAttendance(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 403);
    assert.equal(errorCaught.code, 'ARCHIVED');
  });

  await t.test('allows admin to update archived attendance', async () => {
    let saved = false;
    Attendance.findById = () => Promise.resolve({
      _id: '507f1f77bcf86cd799439099',
      courseId: assignedCourseId,
      date: new Date('2026-08-15T00:00:00.000Z'),
      records: [{ studentId: '507f1f77bcf86cd799439033', status: 'PRESENT' }],
      save: async () => { saved = true; }
    });
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      isActive: true
    });

    const req = {
      user: adminUser,
      params: { id: '507f1f77bcf86cd799439099' },
      body: {
        records: [{ studentId: '507f1f77bcf86cd799439033', status: 'ABSENT' }]
      }
    };

    let responseData = null;
    const res = {
      json: (payload) => { responseData = payload; }
    };

    await updateAttendance(req, res, (err) => { assert.ifError(err); });
    assert.equal(saved, true);
    assert.ok(responseData);
    assert.equal(responseData.success, true);
  });

  await t.test('prevents teacher from deleting archived attendance', async () => {
    Attendance.findById = () => Promise.resolve({
      _id: '507f1f77bcf86cd799439099',
      courseId: assignedCourseId,
      date: new Date('2026-08-15T00:00:00.000Z')
    });
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      teacherId: teacherUser.id,
      isActive: true
    });

    const req = {
      user: teacherUser,
      params: { id: '507f1f77bcf86cd799439099' }
    };

    let errorCaught = null;
    await deleteAttendance(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 403);
    assert.equal(errorCaught.code, 'ARCHIVED');
  });

  await t.test('allows admin to delete archived attendance', async () => {
    let deletedId = null;
    Attendance.findById = () => Promise.resolve({
      _id: '507f1f77bcf86cd799439099',
      courseId: assignedCourseId,
      date: new Date('2026-08-15T00:00:00.000Z')
    });
    Course.findOne = () => Promise.resolve({
      _id: assignedCourseId,
      isActive: true
    });
    Attendance.findByIdAndDelete = (id) => {
      deletedId = id;
      return Promise.resolve();
    };

    const req = {
      user: adminUser,
      params: { id: '507f1f77bcf86cd799439099' }
    };

    let responseData = null;
    const res = {
      json: (payload) => { responseData = payload; }
    };

    await deleteAttendance(req, res, (err) => { assert.ifError(err); });
    assert.equal(deletedId, '507f1f77bcf86cd799439099');
    assert.ok(responseData);
    assert.equal(responseData.success, true);
  });
});

