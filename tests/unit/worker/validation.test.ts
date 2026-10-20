/**
 * Unit Tests — validation.ts
 *
 * Coverage:
 *   - safeJsonParse()
 *   - validateNumber() / validateInteger()
 *   - validateString() (non-throwing helper)
 *   - validateRequiredString() / validateOptionalString()
 *   - sanitizeString()
 *   - validateEmail() / validateEmailSoft()
 *   - validateImageUrl() / validateUrlSoft() / isPrivateHost()
 *   - ValidationError class
 */

import { describe, it, expect } from 'vitest';
import {
  safeJsonParse,
  validateNumber,
  validateInteger,
  validateString,
  validateRequiredString,
  validateOptionalString,
  sanitizeString,
  validateEmail,
  validateEmailSoft,
  validateImageUrl,
  validateUrlSoft,
  isPrivateHost,
  ValidationError,
  MAX_URL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
} from '@/worker/utils/validation';

// ── ValidationError ──────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('is an instance of Error', () => {
    const e = new ValidationError('bad input');
    expect(e instanceof Error).toBe(true);
  });

  it('has name="ValidationError"', () => {
    expect(new ValidationError('msg').name).toBe('ValidationError');
  });

  it('stores optional field and code', () => {
    const e = new ValidationError('bad', 'email', 'INVALID_FORMAT');
    expect(e.field).toBe('email');
    expect(e.code).toBe('INVALID_FORMAT');
  });
});

// ── safeJsonParse ────────────────────────────────────────────────────────────

describe('safeJsonParse()', () => {
  it('parses a valid JSON string', () => {
    expect(safeJsonParse('{"key":"value"}', null)).toEqual({ key: 'value' });
  });

  it('parses a JSON number string', () => {
    expect(safeJsonParse('42', 0)).toBe(42);
  });

  it('parses a JSON array', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('{bad json}', 'default')).toBe('default');
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', 'fb')).toBe('fb');
  });

  it('returns fallback for non-string input (number)', () => {
    expect(safeJsonParse(123, 'fb')).toBe('fb');
  });

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, 'fb')).toBe('fb');
  });

  it('returns fallback for undefined input', () => {
    expect(safeJsonParse(undefined, -1)).toBe(-1);
  });

  it('preserves falsy fallback values (0)', () => {
    expect(safeJsonParse('{broken', 0)).toBe(0);
  });

  it('preserves falsy fallback values (false)', () => {
    expect(safeJsonParse('{broken', false)).toBe(false);
  });
});

// ── validateNumber (throwing) ────────────────────────────────────────────────

describe('validateNumber()', () => {
  it('returns a valid number', () => {
    expect(validateNumber(42, 'price')).toBe(42);
  });

  it('coerces a numeric string', () => {
    expect(validateNumber('3.14', 'amount')).toBe(3.14);
  });

  it('throws on NaN input', () => {
    expect(() => validateNumber('abc', 'qty')).toThrow(ValidationError);
  });

  it('returns Infinity as-is (implementation does not block Infinity)', () => {
    // validateNumber uses Number(value) + isNaN check; Infinity passes isNaN but
    // is accepted unless min/max constraints are set. This documents current behavior.
    expect(validateNumber(Infinity, 'price')).toBe(Infinity);
  });

  it('throws on Infinity when max is set', () => {
    expect(() => validateNumber(Infinity, 'price', { max: 1_000_000 })).toThrow(ValidationError);
  });

  it('respects min option', () => {
    expect(() => validateNumber(-1, 'price', { min: 0 })).toThrow(ValidationError);
    expect(validateNumber(0, 'price', { min: 0 })).toBe(0);
  });

  it('respects max option', () => {
    expect(() => validateNumber(1001, 'stock', { max: 1000 })).toThrow(ValidationError);
    expect(validateNumber(1000, 'stock', { max: 1000 })).toBe(1000);
  });

  it('rejects non-integer when integer:true', () => {
    expect(() => validateNumber(1.5, 'qty', { integer: true })).toThrow(ValidationError);
  });

  it('allows integer with integer:true', () => {
    expect(validateNumber(5, 'qty', { integer: true })).toBe(5);
  });

  it('handles negative zero (returned as-is, numeric equality holds)', () => {
    // -0 === 0 in JS numeric comparison; toBe uses Object.is so we check with ==
    const result = validateNumber(-0, 'val');
    expect(result == 0).toBe(true); // eslint-disable-line eqeqeq
  });
});

// ── validateInteger (non-throwing helper) ────────────────────────────────────

describe('validateInteger()', () => {
  it('returns null for a valid integer within range', () => {
    expect(validateInteger(5, 1, 10, 'qty')).toBeNull();
  });

  it('returns error string for non-finite value', () => {
    expect(validateInteger(NaN, 0, 100, 'qty')).toBeTruthy();
    expect(validateInteger(Infinity, 0, 100, 'qty')).toBeTruthy();
  });

  it('returns error string for non-integer (float)', () => {
    expect(validateInteger(2.5, 0, 10, 'qty')).toBeTruthy();
  });

  it('returns error string when below min', () => {
    expect(validateInteger(-1, 0, 100, 'qty')).toBeTruthy();
  });

  it('returns error string when above max', () => {
    expect(validateInteger(101, 0, 100, 'qty')).toBeTruthy();
  });

  it('accepts boundary values (min and max)', () => {
    expect(validateInteger(0, 0, 100, 'qty')).toBeNull();
    expect(validateInteger(100, 0, 100, 'qty')).toBeNull();
  });
});

// ── validateString (non-throwing helper) ─────────────────────────────────────

describe('validateString()', () => {
  it('returns null for a valid string', () => {
    expect(validateString('hello', 100, 'name')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateString('', 100, 'name')).toBeTruthy();
  });

  it('returns error for string exceeding maxLength', () => {
    expect(validateString('a'.repeat(101), 100, 'name')).toBeTruthy();
  });

  it('returns error for non-string (number)', () => {
    expect(validateString(42 as any, 100, 'name')).toBeTruthy();
  });

  it('accepts a string of exactly maxLength', () => {
    expect(validateString('a'.repeat(MAX_NAME_LENGTH), MAX_NAME_LENGTH, 'name')).toBeNull();
  });
});

// ── validateRequiredString (throwing) ────────────────────────────────────────

describe('validateRequiredString()', () => {
  it('returns trimmed string for valid input', () => {
    expect(validateRequiredString('  hello  ', 'field')).toBe('hello');
  });

  it('throws when value is not a string', () => {
    expect(() => validateRequiredString(123, 'field')).toThrow(ValidationError);
  });

  it('throws for empty string after trim', () => {
    expect(() => validateRequiredString('   ', 'field')).toThrow(ValidationError);
  });

  it('throws when length exceeds maxLength', () => {
    expect(() =>
      validateRequiredString('a'.repeat(10), 'field', { maxLength: 5 }),
    ).toThrow(ValidationError);
  });

  it('strips zero-width chars before length check', () => {
    // A string of pure zero-width spaces should fail "required" check
    const zwsp = '​'.repeat(10);
    expect(() => validateRequiredString(zwsp, 'field')).toThrow(ValidationError);
  });

  it('strips bidi override characters', () => {
    // RLO (U+202E) is a bidi override — should be stripped
    const bidi = '‮hello‬';
    const result = validateRequiredString(bidi, 'field');
    expect(result).not.toContain('‮');
  });
});

// ── validateOptionalString ───────────────────────────────────────────────────

describe('validateOptionalString()', () => {
  it('returns null for null input', () => {
    expect(validateOptionalString(null, 'field')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(validateOptionalString(undefined, 'field')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateOptionalString('', 'field')).toBeNull();
  });

  it('validates and returns trimmed value when non-empty', () => {
    expect(validateOptionalString('  hello  ', 'field')).toBe('hello');
  });

  it('throws when non-empty value fails length constraints', () => {
    expect(() =>
      validateOptionalString('a'.repeat(20), 'field', { maxLength: 5 }),
    ).toThrow(ValidationError);
  });
});

// ── sanitizeString ───────────────────────────────────────────────────────────

describe('sanitizeString()', () => {
  it('returns the string unchanged when no control chars present', () => {
    expect(sanitizeString('hello world')).toBe('hello world');
  });

  it('strips null bytes (0x00)', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
  });

  it('strips ASCII control chars in 0x01-0x08 range', () => {
    expect(sanitizeString('a\x01\x08b')).toBe('ab');
  });

  it('strips 0x7F (DEL)', () => {
    expect(sanitizeString('a\x7Fb')).toBe('ab');
  });

  it('preserves \\n (0x0A)', () => {
    expect(sanitizeString('line1\nline2')).toBe('line1\nline2');
  });

  it('preserves \\t (0x09)', () => {
    expect(sanitizeString('col1\tcol2')).toBe('col1\tcol2');
  });

  it('preserves \\r (0x0D)', () => {
    expect(sanitizeString('line1\r\nline2')).toBe('line1\r\nline2');
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });
});

// ── validateEmail (throwing) ──────────────────────────────────────────────────

describe('validateEmail()', () => {
  it('returns lowercase trimmed email for valid input', () => {
    expect(validateEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('throws for non-string input', () => {
    expect(() => validateEmail(null)).toThrow(ValidationError);
  });

  it('throws for empty string', () => {
    expect(() => validateEmail('')).toThrow(ValidationError);
  });

  it('throws for email without @', () => {
    expect(() => validateEmail('notemail')).toThrow(ValidationError);
  });

  it('throws for email exceeding 255 characters', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(() => validateEmail(long)).toThrow(ValidationError);
  });
});

// ── validateEmailSoft (non-throwing) ─────────────────────────────────────────

describe('validateEmailSoft()', () => {
  it('returns null for valid email', () => {
    expect(validateEmailSoft('user@example.com')).toBeNull();
  });

  it('returns error string for non-string', () => {
    expect(validateEmailSoft(123)).toBeTruthy();
  });

  it('returns error string for invalid format', () => {
    expect(validateEmailSoft('notanemail')).toBeTruthy();
  });

  it('returns error string for email exceeding max length', () => {
    const long = 'a'.repeat(MAX_EMAIL_LENGTH + 1) + '@b.com';
    expect(validateEmailSoft(long)).toBeTruthy();
  });
});

// ── validateImageUrl ──────────────────────────────────────────────────────────

describe('validateImageUrl()', () => {
  it('returns { valid: true } for undefined', () => {
    expect(validateImageUrl(undefined)).toEqual({ valid: true });
  });

  it('returns { valid: true } for null', () => {
    expect(validateImageUrl(null)).toEqual({ valid: true });
  });

  it('returns { valid: true } for empty string', () => {
    expect(validateImageUrl('')).toEqual({ valid: true });
  });

  it('returns { valid: true } for a valid https URL', () => {
    expect(validateImageUrl('https://cdn.example.com/img.jpg')).toEqual({ valid: true });
  });

  it('returns { valid: false } for non-https URL (ftp)', () => {
    expect(validateImageUrl('ftp://files.example.com/img.jpg').valid).toBe(false);
  });

  it('returns { valid: false } for a URL pointing to localhost', () => {
    expect(validateImageUrl('http://localhost/img.jpg').valid).toBe(false);
  });

  it('returns { valid: false } for internal IP (169.254.169.254)', () => {
    expect(validateImageUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
  });

  it('returns { valid: false } for non-string input', () => {
    expect(validateImageUrl(42).valid).toBe(false);
  });

  it('returns { valid: false } for URL exceeding MAX_URL_LENGTH', () => {
    const long = 'https://cdn.example.com/' + 'a'.repeat(MAX_URL_LENGTH);
    expect(validateImageUrl(long).valid).toBe(false);
  });
});

// ── validateUrlSoft (non-throwing) ───────────────────────────────────────────

describe('validateUrlSoft()', () => {
  it('returns null for a valid http URL', () => {
    expect(validateUrlSoft('http://example.com')).toBeNull();
  });

  it('returns null for a valid https URL', () => {
    expect(validateUrlSoft('https://example.com/path?q=1')).toBeNull();
  });

  it('returns error string for non-string', () => {
    expect(validateUrlSoft(123)).toBeTruthy();
  });

  it('returns error string for non-http(s) protocol', () => {
    expect(validateUrlSoft('javascript:alert(1)')).toBeTruthy();
  });

  it('returns error string for private/internal host', () => {
    expect(validateUrlSoft('http://192.168.1.1/api')).toBeTruthy();
  });

  it('returns error string for malformed URL', () => {
    expect(validateUrlSoft('not a url at all')).toBeTruthy();
  });

  it('returns error string when URL exceeds MAX_URL_LENGTH', () => {
    const long = 'https://cdn.example.com/' + 'a'.repeat(MAX_URL_LENGTH);
    expect(validateUrlSoft(long)).toBeTruthy();
  });
});

// ── isPrivateHost ────────────────────────────────────────────────────────────

describe('isPrivateHost()', () => {
  it('returns true for localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
  });

  it('returns true for subdomain.localhost', () => {
    expect(isPrivateHost('dev.localhost')).toBe(true);
  });

  it('returns true for 127.0.0.1', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
  });

  it('returns true for 169.254.169.254 (AWS metadata)', () => {
    expect(isPrivateHost('169.254.169.254')).toBe(true);
  });

  it('returns true for 10.0.0.1 (RFC1918)', () => {
    expect(isPrivateHost('10.0.0.1')).toBe(true);
  });

  it('returns true for 192.168.1.1 (RFC1918)', () => {
    expect(isPrivateHost('192.168.1.1')).toBe(true);
  });

  it('returns true for 172.16.0.1 (RFC1918)', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true);
  });

  it('returns true for 172.31.255.255 (RFC1918 upper edge)', () => {
    expect(isPrivateHost('172.31.255.255')).toBe(true);
  });

  it('returns false for 172.32.0.0 (outside RFC1918)', () => {
    expect(isPrivateHost('172.32.0.0')).toBe(false);
  });

  it('returns true for IPv6 loopback ::1', () => {
    expect(isPrivateHost('::1')).toBe(true);
  });

  it('returns true for metadata.google.internal', () => {
    expect(isPrivateHost('metadata.google.internal')).toBe(true);
  });

  it('returns false for a public hostname', () => {
    expect(isPrivateHost('example.com')).toBe(false);
  });

  it('returns true for empty string', () => {
    expect(isPrivateHost('')).toBe(true);
  });
});
