// Every API error has the same shape, so the browser can show a plain message.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}
