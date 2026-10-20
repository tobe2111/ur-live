/**
 * Standardized Error Handling for Hono Application
 * 
 * Provides consistent error responses across all 177+ API endpoints
 * Improves debugging and user experience with clear error codes
 */

import type { Context } from 'hono';

/**
 * Custom Application Error Class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Response Interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Error Codes Enum
 */
export const ErrorCode = {
  // Authentication Errors (AUTH_*)
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  
  // Resource Errors (RESOURCE_*)
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  
  // Validation Errors (VALIDATION_*)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  
  // Business Logic Errors (BUSINESS_*)
  BUSINESS_INSUFFICIENT_STOCK: 'BUSINESS_INSUFFICIENT_STOCK',
  BUSINESS_ORDER_CANCELLED: 'BUSINESS_ORDER_CANCELLED',
  BUSINESS_PAYMENT_FAILED: 'BUSINESS_PAYMENT_FAILED',
  BUSINESS_REFUND_NOT_ALLOWED: 'BUSINESS_REFUND_NOT_ALLOWED',
  BUSINESS_DUPLICATE_ACTION: 'BUSINESS_DUPLICATE_ACTION',
  BUSINESS_INVALID_STATUS: 'BUSINESS_INVALID_STATUS',
  
  // System Errors (SYSTEM_*)
  SYSTEM_DB_ERROR: 'SYSTEM_DB_ERROR',
  SYSTEM_EXTERNAL_API_ERROR: 'SYSTEM_EXTERNAL_API_ERROR',
  SYSTEM_INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',
  SYSTEM_TIMEOUT: 'SYSTEM_TIMEOUT',
  
  // Rate Limiting (RATE_*)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * Pre-defined Error Factories
 */
export const ErrorFactory = {
  // Authentication
  authRequired: (message = '인증이 필요합니다') =>
    new AppError(401, ErrorCode.AUTH_REQUIRED, message),
  
  invalidToken: (message = '유효하지 않은 토큰입니다') =>
    new AppError(401, ErrorCode.AUTH_INVALID_TOKEN, message),
  
  invalidCredentials: (message = '이메일 또는 비밀번호가 일치하지 않습니다') =>
    new AppError(401, ErrorCode.AUTH_INVALID_CREDENTIALS, message),
  
  forbidden: (message = '접근 권한이 없습니다') =>
    new AppError(403, ErrorCode.AUTH_FORBIDDEN, message),
  
  sessionExpired: (message = '세션이 만료되었습니다') =>
    new AppError(401, ErrorCode.AUTH_SESSION_EXPIRED, message),
  
  // Resource
  notFound: (resource: string, message?: string) =>
    new AppError(
      404, 
      ErrorCode.RESOURCE_NOT_FOUND, 
      message || `${resource}을(를) 찾을 수 없습니다`
    ),
  
  conflict: (message = '리소스 충돌이 발생했습니다') =>
    new AppError(409, ErrorCode.RESOURCE_CONFLICT, message),
  
  alreadyExists: (resource: string, message?: string) =>
    new AppError(
      409,
      ErrorCode.RESOURCE_ALREADY_EXISTS,
      message || `${resource}이(가) 이미 존재합니다`
    ),
  
  // Validation
  validationFailed: (details?: any, message = '입력값 검증에 실패했습니다') =>
    new AppError(400, ErrorCode.VALIDATION_FAILED, message, details),
  
  missingField: (fieldName: string) =>
    new AppError(
      400, 
      ErrorCode.VALIDATION_MISSING_FIELD, 
      `필수 필드가 누락되었습니다: ${fieldName}`
    ),
  
  invalidFormat: (fieldName: string, expectedFormat?: string) =>
    new AppError(
      400,
      ErrorCode.VALIDATION_INVALID_FORMAT,
      `잘못된 형식입니다: ${fieldName}${expectedFormat ? ` (예상 형식: ${expectedFormat})` : ''}`
    ),
  
  // Business Logic
  insufficientStock: (productName: string, available: number) =>
    new AppError(
      400,
      ErrorCode.BUSINESS_INSUFFICIENT_STOCK,
      `재고가 부족합니다: ${productName} (사용 가능: ${available}개)`,
      { available }
    ),
  
  orderCancelled: (message = '이미 취소된 주문입니다') =>
    new AppError(400, ErrorCode.BUSINESS_ORDER_CANCELLED, message),
  
  paymentFailed: (message = '결제에 실패했습니다', details?: any) =>
    new AppError(400, ErrorCode.BUSINESS_PAYMENT_FAILED, message, details),
  
  refundNotAllowed: (message = '환불이 불가능한 주문 상태입니다') =>
    new AppError(400, ErrorCode.BUSINESS_REFUND_NOT_ALLOWED, message),
  
  duplicateAction: (message = '중복된 요청입니다') =>
    new AppError(409, ErrorCode.BUSINESS_DUPLICATE_ACTION, message),
  
  invalidStatus: (currentStatus: string, allowedStatuses: string[]) =>
    new AppError(
      400,
      ErrorCode.BUSINESS_INVALID_STATUS,
      `잘못된 상태입니다: ${currentStatus} (허용된 상태: ${allowedStatuses.join(', ')})`
    ),
  
  // System
  dbError: (message = '데이터베이스 오류가 발생했습니다', details?: any) =>
    new AppError(500, ErrorCode.SYSTEM_DB_ERROR, message, details),
  
  externalApiError: (service: string, message?: string) =>
    new AppError(
      502,
      ErrorCode.SYSTEM_EXTERNAL_API_ERROR,
      message || `외부 서비스 연동 오류: ${service}`
    ),
  
  internalError: (message = '서버 내부 오류가 발생했습니다') =>
    new AppError(500, ErrorCode.SYSTEM_INTERNAL_ERROR, message),
  
  timeout: (message = '요청 시간이 초과되었습니다') =>
    new AppError(504, ErrorCode.SYSTEM_TIMEOUT, message),
  
  // Rate Limiting
  rateLimitExceeded: (retryAfter: number) =>
    new AppError(
      429,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `너무 많은 요청이 발생했습니다. ${retryAfter}초 후에 다시 시도해주세요.`,
      { retryAfter }
    ),
};

/**
 * Global Error Handler for Hono
 */
export function createErrorHandler() {
  return async (err: Error, c: Context) => {
    // Log error for debugging
    console.error('[ERROR]', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString()
    });

    // Handle AppError (known errors)
    if (err instanceof AppError) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details })
        }
      };
      
      return c.json(response, err.statusCode as any);
    }

    // Handle unexpected errors
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.SYSTEM_INTERNAL_ERROR,
        message: process.env.NODE_ENV === 'production' 
          ? '서버 오류가 발생했습니다.' 
          : err.message
      }
    };
    
    return c.json(response, 500);
  };
}

/**
 * Async Error Wrapper
 * Wraps async handlers to automatically catch and forward errors
 */
export function asyncHandler(handler: Function) {
  return async (c: Context, ...args: any[]) => {
    try {
      return await handler(c, ...args);
    } catch (err) {
      throw err; // Will be caught by global error handler
    }
  };
}
