export function notFound(_req, _res, next) {
  const error = new Error('Route not found'); error.status = 404; error.code = 'NOT_FOUND'; next(error);
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: status >= 500 ? 'An unexpected error occurred' : error.message } });
}
