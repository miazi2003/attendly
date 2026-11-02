import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.connection.on('error', error => console.error('MongoDB connection error:', error.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB connected');
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
