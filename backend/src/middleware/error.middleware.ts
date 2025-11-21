import { Request, Response, NextFunction } from "express";
import { AppErrorClass, ErrorCode } from "../utils/error.utils";

/**
 * Error response formatter
 */
export function formatErrorResponse(error: any): {
  error: {
    code: string;
    message: string;
    details?: any;
  };
} {
  if (error instanceof AppErrorClass) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  // Generic error
  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message || "An unexpected error occurred",
    },
  };
}

/**
 * Global error handler middleware for Express
 */
export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const response = formatErrorResponse(err);

  // Log error
  if (statusCode >= 500) {
    console.error("Server Error:", err);
  } else {
    console.warn("Client Error:", err.message);
  }

  res.status(statusCode).json(response);
}

