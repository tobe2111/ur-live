/**
 * Common Response Formatters
 * 
 * Provides consistent API response formats across all endpoints
 * Includes success, error, and pagination responses
 * 
 * Created: 2026-03-09
 * Purpose: Backend refactoring - Consistent API responses
 */

/**
 * Standard success response format
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    field?: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  code?: string,
  field?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    error: {
      message,
      code,
      field,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a created (201) response
 */
export function createdResponse<T>(
  data: T,
  message: string = 'Resource created successfully'
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a no content (204) response
 */
export function noContentResponse(): { success: true } {
  return { success: true };
}

/**
 * Create a not found (404) error response
 */
export function notFoundResponse(
  resource: string = 'Resource'
): ErrorResponse {
  return errorResponse(
    `${resource} not found`,
    'NOT_FOUND',
    undefined,
    { resource }
  );
}

/**
 * Create an unauthorized (401) error response
 */
export function unauthorizedResponse(
  message: string = 'Unauthorized access'
): ErrorResponse {
  return errorResponse(message, 'UNAUTHORIZED');
}

/**
 * Create a forbidden (403) error response
 */
export function forbiddenResponse(
  message: string = 'Forbidden access'
): ErrorResponse {
  return errorResponse(message, 'FORBIDDEN');
}

/**
 * Create a bad request (400) error response
 */
export function badRequestResponse(
  message: string,
  field?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return errorResponse(message, 'BAD_REQUEST', field, details);
}

/**
 * Create a validation error (422) response
 */
export function validationErrorResponse(
  message: string,
  field?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return errorResponse(message, 'VALIDATION_ERROR', field, details);
}

/**
 * Create a conflict (409) error response
 */
export function conflictResponse(
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return errorResponse(message, 'CONFLICT', undefined, details);
}

/**
 * Create an internal server error (500) response
 */
export function internalServerErrorResponse(
  message: string = 'Internal server error',
  details?: Record<string, unknown>
): ErrorResponse {
  return errorResponse(message, 'INTERNAL_SERVER_ERROR', undefined, details);
}

/**
 * Create a rate limit (429) error response
 */
export function rateLimitResponse(
  retryAfter?: number
): ErrorResponse {
  return errorResponse(
    'Rate limit exceeded',
    'RATE_LIMIT_EXCEEDED',
    undefined,
    { retryAfter }
  );
}

/**
 * Response status code mappings
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Get HTTP status code from error code
 */
export function getStatusFromErrorCode(errorCode?: string): number {
  switch (errorCode) {
    case 'BAD_REQUEST':
      return HTTP_STATUS.BAD_REQUEST;
    case 'UNAUTHORIZED':
      return HTTP_STATUS.UNAUTHORIZED;
    case 'FORBIDDEN':
      return HTTP_STATUS.FORBIDDEN;
    case 'NOT_FOUND':
      return HTTP_STATUS.NOT_FOUND;
    case 'CONFLICT':
      return HTTP_STATUS.CONFLICT;
    case 'VALIDATION_ERROR':
      return HTTP_STATUS.UNPROCESSABLE_ENTITY;
    case 'RATE_LIMIT_EXCEEDED':
      return HTTP_STATUS.TOO_MANY_REQUESTS;
    case 'INTERNAL_SERVER_ERROR':
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Helper to format error from Error object
 */
export function formatErrorResponse(error: unknown): ErrorResponse {
  // ValidationError from validation.ts
  if (error !== null && typeof error === 'object' && (error as { name?: string }).name === 'ValidationError') {
    const ve = error as { name: string; message: string; field?: string; code?: string };
    return validationErrorResponse(ve.message, ve.field, { code: ve.code });
  }

  // Standard Error
  if (error instanceof Error) {
    return errorResponse(
      error.message || 'An error occurred',
      'ERROR',
      undefined,
      { name: error.name, stack: error.stack }
    );
  }

  // Unknown error
  return errorResponse(
    typeof error === 'string' ? error : 'Unknown error',
    'UNKNOWN_ERROR'
  );
}

// ─── Hono Context 래퍼 ──────────────────────────────────────────────────────
// 코드베이스 표준 포맷: { success: boolean, error?: string, ...data }
// 새 엔드포인트에서 사용하면 포맷 일관성 유지 가능

import type { Context } from 'hono';

// 성공: { success: true, ...rest }
export function jsonOk<T extends Record<string, unknown>>(
  c: Context,
  data: T,
  status: 200 | 201 = 200
) {
  return c.json({ success: true, ...data }, status);
}

// 에러: { success: false, error: string }
export function jsonFail(
  c: Context,
  error: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 = 400
) {
  return c.json({ success: false, error }, status);
}

// 단축 헬퍼
export const jsonCreated = <T extends Record<string, unknown>>(c: Context, data: T) =>
  c.json({ success: true, ...data }, 201);
export const jsonNotFound = (c: Context, msg = '찾을 수 없습니다') => jsonFail(c, msg, 404);
export const jsonUnauthorized = (c: Context, msg = '인증이 필요합니다') => jsonFail(c, msg, 401);
export const jsonForbidden = (c: Context, msg = '권한이 없습니다') => jsonFail(c, msg, 403);
export const jsonBadRequest = (c: Context, msg: string) => jsonFail(c, msg, 400);
export const jsonConflict = (c: Context, msg: string) => jsonFail(c, msg, 409);
export const jsonServerError = (c: Context, msg = '서버 오류가 발생했습니다') => jsonFail(c, msg, 500);
