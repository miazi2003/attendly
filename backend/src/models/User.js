import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['ADMIN', 'TEACHER'], required: true, index: true },
  department: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform(_document, result) { delete result.passwordHash; delete result.__v; return result; }
});

export const User = mongoose.model('User', userSchema);
