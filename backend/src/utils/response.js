export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const fail = (status, code, message, details) => new ApiError(status, code, message, details);
