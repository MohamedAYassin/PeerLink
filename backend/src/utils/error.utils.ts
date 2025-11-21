/**
 * Comprehensive error handling utilities
 * Prevents crashes and provides structured error responses
 */

export enum ErrorCode {
  // Client errors (400-499)
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE",

  // Server errors (500-599)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  REDIS_ERROR = "REDIS_ERROR",
  WEBSOCKET_ERROR = "WEBSOCKET_ERROR",

  // File transfer errors
  UPLOAD_FAILED = "UPLOAD_FAILED",
  DOWNLOAD_FAILED = "DOWNLOAD_FAILED",
  CHUNK_INVALID = "CHUNK_INVALID",
  CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",

  // Session errors
  SHARE_SESSION_FULL = "SHARE_SESSION_FULL",
}

export interface AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: any;
  isOperational: boolean;
}

export class AppErrorClass extends Error implements AppError {
  code: ErrorCode;
  statusCode: number;
  details?: any;
  isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error factories
export const ErrorFactory = {
  badRequest: (message: string, details?: any) =>
    new AppErrorClass(ErrorCode.BAD_REQUEST, message, 400, details),

  unauthorized: (message: string = "Unauthorized") =>
    new AppErrorClass(ErrorCode.UNAUTHORIZED, message, 401),

  forbidden: (message: string = "Forbidden") =>
    new AppErrorClass(ErrorCode.FORBIDDEN, message, 403),

  notFound: (resource: string = "Resource") =>
    new AppErrorClass(ErrorCode.NOT_FOUND, `${resource} not found`, 404),

  conflict: (message: string, details?: any) =>
    new AppErrorClass(ErrorCode.CONFLICT, message, 409, details),

  rateLimited: (resetAt: number) =>
    new AppErrorClass(
      ErrorCode.RATE_LIMITED,
      "Rate limit exceeded",
      429,
      { resetAt }
    ),

  payloadTooLarge: (maxSize: number) =>
    new AppErrorClass(
      ErrorCode.PAYLOAD_TOO_LARGE,
      `Payload too large. Maximum: ${maxSize} bytes`,
      413,
      { maxSize }
    ),

  internalError: (message: string = "Internal server error", details?: any) =>
    new AppErrorClass(ErrorCode.INTERNAL_ERROR, message, 500, details),

  serviceUnavailable: (service: string) =>
    new AppErrorClass(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} is currently unavailable`,
      503
    ),

  uploadFailed: (message: string, details?: any) =>
    new AppErrorClass(ErrorCode.UPLOAD_FAILED, message, 500, details),

  checksumMismatch: (expected: string, actual: string) =>
    new AppErrorClass(
      ErrorCode.CHECKSUM_MISMATCH,
      "Checksum verification failed",
      400,
      { expected, actual }
    ),

  fileTooLarge: (size: number, maxSize: number) =>
    new AppErrorClass(
      ErrorCode.FILE_TOO_LARGE,
      `File too large: ${size} bytes (max: ${maxSize})`,
      413,
      { size, maxSize }
    ),

  shareSessionFull: (shareId: string) =>
    new AppErrorClass(
      ErrorCode.SHARE_SESSION_FULL,
      `Share session is full: ${shareId}`,
      409,
      { shareId }
    ),
};

/**
 * Safe error handler wrapper
 * Prevents crashes by catching and logging errors
 */
export function safeHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  errorHandler?: (error: any, ...args: T) => void
): (...args: T) => Promise<R | void> {
  return async (...args: T): Promise<R | void> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("Error in handler:", error);
      if (errorHandler) {
        errorHandler(error, ...args);
      }
    }
  };
}

/**
 * Async error boundary for Express routes
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Retry utility with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        if (onRetry) {
          onRetry(attempt, error);
        }
        console.log(`Retry attempt ${attempt}/${maxRetries} in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export default {
  ErrorCode,
  ErrorFactory,
  AppErrorClass,
  safeHandler,
  asyncHandler,
  retry,
};
