import mongoose from 'mongoose';

const semesterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

semesterSchema.index({ name: 1, academicYear: 1 }, { unique: true });
export const Semester = mongoose.model('Semester', semesterSchema);
