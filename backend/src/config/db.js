import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise;
mongoose.connection.on('error', error => console.error('MongoDB connection error:', error.message));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then(() => { console.log('MongoDB connected'); return mongoose.connection; })
      .catch(error => { connectionPromise = undefined; throw error; });
  }
  return connectionPromise;
}

export async function disconnectDatabase() {
  connectionPromise = undefined;
  await mongoose.disconnect();
}

export async function requireDatabase(_req, _res, next) {
  try { await connectDatabase(); next(); }
  catch (error) { next(error); }
}
