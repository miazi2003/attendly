import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['PRESENT', 'ABSENT'], required: true }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  date: { type: Date, required: true, set: value => { const date = new Date(value); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); } },
  records: {
    type: [recordSchema],
    required: true,
    validate: {
      validator(records) { return records.length === new Set(records.map(record => String(record.studentId))).size; },
      message: 'Attendance records cannot contain duplicate students'
    }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

attendanceSchema.index({ courseId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1, courseId: 1 });
export const Attendance = mongoose.model('Attendance', attendanceSchema);
