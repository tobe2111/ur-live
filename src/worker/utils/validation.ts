/**
 * Common Validation Utilities
 * 
 * Centralized validation functions for API requests
 * Provides consistent error messages and validation logic
 * 
 * Created: 2026-03-09
 * Purpose: Backend refactoring - DRY principle
 */

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Email validation
 */
export function validateEmail(email: unknown): string {
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string', 'email', 'INVALID_TYPE');
  }
  
  const trimmed = email.trim();
  
  if (!trimmed) {
    throw new ValidationError('Email is required', 'email', 'REQUIRED');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new ValidationError('Invalid email format', 'email', 'INVALID_FORMAT');
  }
  
  if (trimmed.length > 255) {
    throw new ValidationError('Email is too long (max 255 characters)', 'email', 'TOO_LONG');
  }
  
  return trimmed.toLowerCase();
}

/**
 * Password validation
 */
export function validatePassword(password: unknown, options: {
  minLength?: number;
  maxLength?: number;
  requireSpecialChar?: boolean;
  requireNumber?: boolean;
  requireUppercase?: boolean;
} = {}): string {
  const {
    minLength = 8,
    maxLength = 128,
    requireSpecialChar = false,
    requireNumber = false,
    requireUppercase = false,
  } = options;
  
  if (typeof password !== 'string') {
    throw new ValidationError('Password must be a string', 'password', 'INVALID_TYPE');
  }
  
  if (!password) {
    throw new ValidationError('Password is required', 'password', 'REQUIRED');
  }
  
  if (password.length < minLength) {
    throw new ValidationError(
      `Password must be at least ${minLength} characters`,
      'password',
      'TOO_SHORT'
    );
  }
  
  if (password.length > maxLength) {
    throw new ValidationError(
      `Password must be at most ${maxLength} characters`,
      'password',
      'TOO_LONG'
    );
  }
  
  if (requireNumber && !/\d/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one number',
      'password',
      'MISSING_NUMBER'
    );
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one uppercase letter',
      'password',
      'MISSING_UPPERCASE'
    );
  }
  
  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one special character',
      'password',
      'MISSING_SPECIAL_CHAR'
    );
  }
  
  return password;
}

/**
 * Strip zero-width chars, bidirectional overrides, and ASCII control characters.
 * Blocks spoofing attacks (RLO/LRO/PDF unicode tricks) and log injection.
 * Keeps \n (0x0A), \r (0x0D), \t (0x09).
 *
 * Ranges stripped:
 *   - ASCII C0 control chars (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F) + DEL (0x7F)
 *   - Zero-width chars: U+200B, U+200C, U+200D, U+FEFF
 *   - Bidi overrides:   U+202A-U+202E (LRE/RLE/PDF/LRO/RLO),
 *                       U+2066-U+2069 (LRI/RLI/FSI/PDI)
 */
const CONTROL_AND_INVISIBLE_RE = new RegExp(
  // ASCII C0 control chars (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F) + DEL (0x7F)
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]' +
  // Zero-width chars: U+200B-U+200D (ZWSP/ZWNJ/ZWJ)
  '|[\\u200B-\\u200D]' +
  // Byte order mark / zero-width no-break: U+FEFF
  '|\\uFEFF' +
  // Bidi overrides: U+202A-U+202E (LRE/RLE/PDF/LRO/RLO), U+2066-U+2069 (LRI/RLI/FSI/PDI)
  '|[\\u202A-\\u202E\\u2066-\\u2069]',
  'g'
);

function stripControlAndInvisibleChars(s: string): string {
  return s.replace(CONTROL_AND_INVISIBLE_RE, '');
}

/**
 * Required string validation
 *
 * Applies defense-in-depth sanitization: strips control chars, zero-width chars,
 * and unicode bidirectional overrides before length/content validation.
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    trim?: boolean;
  } = {}
): string {
  const { minLength = 1, maxLength = 1000, trim = true } = options;

  if (typeof value !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      fieldName,
      'INVALID_TYPE'
    );
  }

  // ✅ Sanitize first — invisible / control chars could bypass min-length checks
  //    (e.g. a string of pure zero-width chars would otherwise pass as "valid").
  const sanitized = stripControlAndInvisibleChars(value);
  const processed = trim ? sanitized.trim() : sanitized;

  if (!processed) {
    throw new ValidationError(
      `${fieldName} is required`,
      fieldName,
      'REQUIRED'
    );
  }

  if (processed.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      fieldName,
      'TOO_SHORT'
    );
  }

  if (processed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${maxLength} characters`,
      fieldName,
      'TOO_LONG'
    );
  }

  return processed;
}

/**
 * Optional string validation
 */
export function validateOptionalString(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    trim?: boolean;
  } = {}
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  return validateRequiredString(value, fieldName, options);
}

/**
 * Number validation
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): number {
  const { min, max, integer = false } = options;
  
  const num = Number(value);
  
  if (isNaN(num)) {
    throw new ValidationError(
      `${fieldName} must be a number`,
      fieldName,
      'INVALID_TYPE'
    );
  }
  
  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(
      `${fieldName} must be an integer`,
      fieldName,
      'NOT_INTEGER'
    );
  }
  
  if (min !== undefined && num < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min}`,
      fieldName,
      'TOO_SMALL'
    );
  }
  
  if (max !== undefined && num > max) {
    throw new ValidationError(
      `${fieldName} must be at most ${max}`,
      fieldName,
      'TOO_LARGE'
    );
  }
  
  return num;
}

/**
 * Phone number validation (Korean format)
 */
export function validatePhoneNumber(phone: unknown): string {
  if (typeof phone !== 'string') {
    throw new ValidationError('Phone number must be a string', 'phone', 'INVALID_TYPE');
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    throw new ValidationError('Phone number is required', 'phone', 'REQUIRED');
  }

  // 국제 전화번호 (+로 시작) → 그대로 반환
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return trimmed;
    throw new ValidationError('Invalid international phone number', 'phone', 'INVALID_FORMAT');
  }

  // 숫자만 추출
  const cleaned = trimmed.replace(/\D/g, '');

  if (!cleaned || cleaned.length < 7) {
    throw new ValidationError('Phone number is too short', 'phone', 'INVALID_LENGTH');
  }
  if (cleaned.length > 15) {
    throw new ValidationError('Phone number is too long', 'phone', 'INVALID_LENGTH');
  }

  // 한국 전화번호 포맷팅
  if (cleaned.startsWith('010') && cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.startsWith('02') && cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }
  if (cleaned.startsWith('02') && cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }

  return trimmed; // 그 외 → 원본 반환
}

/**
 * URL validation
 */
export function validateURL(url: unknown, fieldName: string = 'URL'): string {
  if (typeof url !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }
  
  const trimmed = url.trim();
  
  if (!trimmed) {
    throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
  }
  
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName, 'INVALID_FORMAT');
  }
}

/**
 * Enum validation
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      fieldName,
      'INVALID_TYPE'
    );
  }
  
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      fieldName,
      'INVALID_VALUE'
    );
  }
  
  return value as T;
}

/**
 * Array validation
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: unknown, index: number) => T;
  } = {}
): T[] {
  const { minLength = 0, maxLength = Infinity, itemValidator } = options;
  
  if (!Array.isArray(value)) {
    throw new ValidationError(
      `${fieldName} must be an array`,
      fieldName,
      'INVALID_TYPE'
    );
  }
  
  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must contain at least ${minLength} items`,
      fieldName,
      'TOO_SHORT'
    );
  }
  
  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must contain at most ${maxLength} items`,
      fieldName,
      'TOO_LONG'
    );
  }
  
  if (itemValidator) {
    return value.map((item, index) => itemValidator(item, index));
  }
  
  return value as T[];
}

/**
 * Date validation
 */
export function validateDate(
  value: unknown,
  fieldName: string,
  options: {
    min?: Date;
    max?: Date;
    future?: boolean;
    past?: boolean;
  } = {}
): Date {
  const { min, max, future = false, past = false } = options;
  
  let date: Date;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    throw new ValidationError(
      `${fieldName} must be a valid date`,
      fieldName,
      'INVALID_TYPE'
    );
  }
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(
      `${fieldName} is not a valid date`,
      fieldName,
      'INVALID_DATE'
    );
  }
  
  const now = new Date();
  
  if (future && date <= now) {
    throw new ValidationError(
      `${fieldName} must be in the future`,
      fieldName,
      'NOT_FUTURE'
    );
  }
  
  if (past && date >= now) {
    throw new ValidationError(
      `${fieldName} must be in the past`,
      fieldName,
      'NOT_PAST'
    );
  }
  
  if (min && date < min) {
    throw new ValidationError(
      `${fieldName} must be after ${min.toISOString()}`,
      fieldName,
      'TOO_EARLY'
    );
  }
  
  if (max && date > max) {
    throw new ValidationError(
      `${fieldName} must be before ${max.toISOString()}`,
      fieldName,
      'TOO_LATE'
    );
  }
  
  return date;
}

/**
 * Batch validation - validates multiple fields and collects all errors
 */
export function validateBatch(
  validators: Array<() => void>
): void {
  const errors: ValidationError[] = [];
  
  for (const validator of validators) {
    try {
      validator();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        throw error;
      }
    }
  }
  
  if (errors.length > 0) {
    const message = errors.map(e => `${e.field}: ${e.message}`).join(', ');
    throw new ValidationError(message, undefined, 'BATCH_VALIDATION_FAILED');
  }
}

/**
 * Validate required fields in an object
 * Returns an array of missing field names
 */
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[]
): string[] {
  const missing: string[] = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }

  return missing;
}

// ============================================================
// Defensive Input Validation (non-throwing helpers)
//
// These helpers return an error string when invalid and null when valid.
// They are intended for endpoints that want to surface validation errors
// as JSON responses without raising ValidationError exceptions.
// Length caps are tuned to prevent DoS via oversized payloads.
// ============================================================

export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PHONE_LENGTH = 20;
export const MAX_ADDRESS_LENGTH = 500;
export const MAX_TEXT_FIELD_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_URL_LENGTH = 2048;
export const MAX_REVIEW_LENGTH = 5000;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const MAX_SEARCH_QUERY_LENGTH = 200;

export const MAX_PRICE = 100_000_000;
export const MAX_STOCK = 1_000_000;
export const MAX_QUANTITY = 1_000;
export const MAX_PAGINATION_LIMIT = 100;

export function validateString(
  value: unknown,
  maxLength: number,
  fieldName: string
): string | null {
  if (typeof value !== 'string') return `${fieldName}은(는) 문자열이어야 합니다.`;
  if (value.length === 0) return `${fieldName}은(는) 비어있을 수 없습니다.`;
  if (value.length > maxLength) return `${fieldName}은(는) ${maxLength}자 이하여야 합니다.`;
  return null;
}

export function validateInteger(
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${fieldName}은(는) 유효한 숫자여야 합니다.`;
  if (!Number.isInteger(n)) return `${fieldName}은(는) 정수여야 합니다.`;
  if (n < min || n > max) return `${fieldName}은(는) ${min} 이상 ${max} 이하여야 합니다.`;
  return null;
}

/**
 * Validates that a value is an http(s) URL under the allowed length.
 * Empty strings and undefined are treated as "not provided" (valid: true)
 * so callers can use this for optional URL fields.
 */
export function validateImageUrl(url: unknown): { valid: boolean; error?: string } {
  if (url === undefined || url === null) return { valid: true };
  if (typeof url !== 'string') return { valid: false, error: 'URL은 문자열이어야 합니다.' };
  if (url.length === 0) return { valid: true };
  if (url.length > MAX_URL_LENGTH) return { valid: false, error: `URL은 ${MAX_URL_LENGTH}자 이하여야 합니다.` };
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return { valid: false, error: 'http/https URL만 허용됩니다.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: '올바른 URL 형식이 아닙니다.' };
  }
}

export function validateEmailSoft(email: unknown): string | null {
  if (typeof email !== 'string') return '이메일은 문자열이어야 합니다.';
  if (email.length > MAX_EMAIL_LENGTH) return '이메일이 너무 깁니다.';
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) return '올바른 이메일 형식이 아닙니다.';
  return null;
}

export function validatePhoneSoft(phone: unknown): string | null {
  if (typeof phone !== 'string') return '전화번호는 문자열이어야 합니다.';
  const clean = phone.replace(/[-\s]/g, '');
  if (!/^[0-9+]+$/.test(clean)) return '전화번호에는 숫자만 허용됩니다.';
  if (clean.length < 9 || clean.length > 15) return '전화번호 길이가 올바르지 않습니다.';
  return null;
}

export function validateUrlSoft(url: unknown): string | null {
  if (typeof url !== 'string') return 'URL은 문자열이어야 합니다.';
  if (url.length > MAX_URL_LENGTH) return 'URL이 너무 깁니다.';
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return 'URL은 http:// 또는 https://로 시작해야 합니다.';
    return null;
  } catch {
    return '올바른 URL 형식이 아닙니다.';
  }
}

/**
 * Remove null bytes and ASCII control characters (except \n and \t).
 * Protects downstream consumers from strings that can truncate logs or
 * break protocol framing.
 */
export function sanitizeString(s: string): string {
  // Strip chars 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, and 0x7F (DEL).
  // Allow 0x09 (\t), 0x0A (\n), 0x0D (\r).
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function validatePagination(
  limit: unknown,
  offset: unknown
): { limit: number; offset: number } {
  const l = Math.min(Math.max(1, Number(limit) || 20), MAX_PAGINATION_LIMIT);
  const o = Math.max(0, Number(offset) || 0);
  return { limit: l, offset: o };
}

/**
 * Safe JSON.parse — returns fallback on any error (SyntaxError, circular, etc.)
 * Use when parsing user-supplied JSON where a malformed payload must not crash
 * the request handler.
 */
export function safeJsonParse<T = unknown>(input: unknown, fallback: T): T {
  if (typeof input !== 'string' || input.length === 0) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
