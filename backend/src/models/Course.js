import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  day: { type: Number, min: 0, max: 6, required: true },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  durationMinutes: { type: Number, min: 1, required: true },
  room: { type: String, trim: true }
}, { _id: false });

const courseSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true, index: true },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  enrolledStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  schedule: { type: [scheduleSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

courseSchema.index({ code: 1, semesterId: 1 }, { unique: true });
export const Course = mongoose.model('Course', courseSchema);
