import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  roll: { type: String, required: true, unique: true, trim: true },
  department: { type: String, required: true, trim: true, index: true },
  semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

export const Student = mongoose.model('Student', studentSchema);
