import mongoose from 'mongoose';
import { z } from 'zod';
import { HttpError } from './http.js';

export const objectId = z.string().refine(value => mongoose.isValidObjectId(value), 'Invalid ID');
export const nonEmpty = z.string().trim().min(1).max(150);
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'VALIDATION_ERROR', result.error.issues[0]?.message || 'Invalid request');
  return result.data;
}
export function duplicate(error, message) {
  if (error?.code === 11000) throw new HttpError(409, 'DUPLICATE', message);
  throw error;
}
