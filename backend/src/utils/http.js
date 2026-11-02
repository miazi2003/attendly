export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export const success = (res, data = null, message = 'OK') => res.json({ success: true, message, data });
