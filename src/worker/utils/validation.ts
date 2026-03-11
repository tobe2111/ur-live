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
 * Required string validation
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
  
  const processed = trim ? value.trim() : value;
  
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
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) {
    throw new ValidationError('Phone number is required', 'phone', 'REQUIRED');
  }
  
  // Korean phone number formats: 010-XXXX-XXXX, 02-XXX-XXXX, etc.
  if (cleaned.length < 9 || cleaned.length > 11) {
    throw new ValidationError('Invalid phone number length', 'phone', 'INVALID_LENGTH');
  }
  
  // Format: 010-1234-5678
  if (cleaned.startsWith('010') && cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  
  // Format: 02-123-4567 or 031-123-4567
  if (cleaned.startsWith('02') && cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }
  
  if (cleaned.startsWith('02') && cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  if (cleaned.length === 11 && !cleaned.startsWith('010')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  
  return cleaned; // Return cleaned version if format doesn't match
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
