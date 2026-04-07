import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeUserId } from '@/utils/orderIdGenerator';
import {
  getUserIdSync,
  getUserEmail,
  getUserNameSync,
  getUserType,
  getUserProfileImage,
  isLoggedInSync,
  getAccessToken,
  clearAuthData,
  saveTempCartItem,
  getTempCartItem,
  clearTempCartItem,
  saveFirebaseTokens,
} from '@/utils/auth';

/**
 * Auth utility tests.
 *
 * Only tests pure / synchronous functions that rely on localStorage.
 * Does NOT test async Firebase functions (isLoggedIn, getUserId, getUserName, logout).
 */

describe('sanitizeUserId', () => {
  it('passes through simple numeric IDs', () => {
    expect(sanitizeUserId(123)).toBe('123');
    expect(sanitizeUserId('456')).toBe('456');
  });

  it('passes through alphanumeric strings', () => {
    expect(sanitizeUserId('abc123XYZ')).toBe('abc123XYZ');
  });

  it('removes Korean characters', () => {
    expect(sanitizeUserId('사용자123')).toBe('123');
  });

  it('removes special characters except hyphens and underscores', () => {
    expect(sanitizeUserId('user@email.com')).toBe('useremailcom');
    expect(sanitizeUserId('hello world!')).toBe('helloworld');
  });

  it('preserves hyphens and underscores', () => {
    expect(sanitizeUserId('user-name_123')).toBe('user-name_123');
  });

  it('truncates to 16 characters', () => {
    expect(sanitizeUserId('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnop');
    expect(sanitizeUserId('a'.repeat(100))).toHaveLength(16);
  });

  it('handles empty string', () => {
    expect(sanitizeUserId('')).toBe('');
  });

  it('handles number 0', () => {
    expect(sanitizeUserId(0)).toBe('0');
  });
});

describe('getUserIdSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no user_id is stored', () => {
    expect(getUserIdSync()).toBeNull();
  });

  it('returns user_id from localStorage', () => {
    localStorage.setItem('user_id', '42');
    expect(getUserIdSync()).toBe('42');
  });

  it('falls back to legacy userId key', () => {
    localStorage.setItem('userId', '99');
    expect(getUserIdSync()).toBe('99');
  });

  it('prefers user_id over legacy userId', () => {
    localStorage.setItem('user_id', '42');
    localStorage.setItem('userId', '99');
    expect(getUserIdSync()).toBe('42');
  });
});

describe('getUserEmail', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no email is stored', () => {
    expect(getUserEmail()).toBeNull();
  });

  it('returns email for user type', () => {
    localStorage.setItem('user_type', 'user');
    localStorage.setItem('user_email', 'test@example.com');
    expect(getUserEmail()).toBe('test@example.com');
  });

  it('returns email when user_type is not set (defaults to user)', () => {
    localStorage.setItem('user_email', 'test@example.com');
    expect(getUserEmail()).toBe('test@example.com');
  });

  it('falls back to legacy userEmail key', () => {
    localStorage.setItem('user_type', 'user');
    localStorage.setItem('userEmail', 'legacy@example.com');
    expect(getUserEmail()).toBe('legacy@example.com');
  });

  it('returns null for seller type (seller should use seller_email)', () => {
    localStorage.setItem('user_type', 'seller');
    localStorage.setItem('user_email', 'test@example.com');
    expect(getUserEmail()).toBeNull();
  });

  it('returns null for admin type (admin should use admin_email)', () => {
    localStorage.setItem('user_type', 'admin');
    localStorage.setItem('user_email', 'test@example.com');
    expect(getUserEmail()).toBeNull();
  });
});

describe('getUserNameSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(getUserNameSync()).toBeNull();
  });

  it('returns user_name for regular user', () => {
    localStorage.setItem('user_type', 'user');
    localStorage.setItem('user_name', 'John');
    expect(getUserNameSync()).toBe('John');
  });

  it('returns email prefix as fallback when only email is set', () => {
    localStorage.setItem('user_type', 'user');
    localStorage.setItem('user_email', 'john@example.com');
    expect(getUserNameSync()).toBe('john');
  });

  it('returns seller_name for seller type', () => {
    localStorage.setItem('user_type', 'seller');
    localStorage.setItem('seller_name', 'SellerCo');
    expect(getUserNameSync()).toBe('SellerCo');
  });

  it('falls back to user_name for seller if seller_name not set', () => {
    localStorage.setItem('user_type', 'seller');
    localStorage.setItem('user_name', 'FallbackName');
    expect(getUserNameSync()).toBe('FallbackName');
  });

  it('returns admin_name for admin type', () => {
    localStorage.setItem('user_type', 'admin');
    localStorage.setItem('admin_name', 'AdminUser');
    expect(getUserNameSync()).toBe('AdminUser');
  });
});

describe('isLoggedInSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when nothing is stored', () => {
    expect(isLoggedInSync()).toBe(false);
  });

  it('returns true when seller_token exists', () => {
    localStorage.setItem('seller_token', 'some-token');
    expect(isLoggedInSync()).toBe(true);
  });

  it('returns true when admin_token exists', () => {
    localStorage.setItem('admin_token', 'some-token');
    expect(isLoggedInSync()).toBe(true);
  });

  it('returns true for Firebase user with user_id and user_type=user', () => {
    localStorage.setItem('user_id', '123');
    localStorage.setItem('user_type', 'user');
    expect(isLoggedInSync()).toBe(true);
  });

  it('returns true for Firebase user with user_id and no user_type', () => {
    localStorage.setItem('user_id', '123');
    expect(isLoggedInSync()).toBe(true);
  });

  it('returns true when firebase_token exists (legacy)', () => {
    localStorage.setItem('firebase_token', 'some-token');
    expect(isLoggedInSync()).toBe(true);
  });

  it('returns false when only user_type is set without user_id', () => {
    localStorage.setItem('user_type', 'user');
    expect(isLoggedInSync()).toBe(false);
  });
});

describe('getAccessToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token stored', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('returns the firebase_token', () => {
    localStorage.setItem('firebase_token', 'my-firebase-token');
    expect(getAccessToken()).toBe('my-firebase-token');
  });
});

describe('getUserType', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when not set', () => {
    expect(getUserType()).toBeNull();
  });

  it('returns the stored user type', () => {
    localStorage.setItem('user_type', 'seller');
    expect(getUserType()).toBe('seller');
  });
});

describe('getUserProfileImage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when not set', () => {
    expect(getUserProfileImage()).toBeNull();
  });

  it('returns the stored profile image URL', () => {
    localStorage.setItem('user_profile_image', 'https://example.com/photo.jpg');
    expect(getUserProfileImage()).toBe('https://example.com/photo.jpg');
  });
});

describe('clearAuthData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears user-specific keys when type is user', () => {
    localStorage.setItem('firebase_token', 'token');
    localStorage.setItem('user_id', '123');
    localStorage.setItem('user_name', 'Test');
    localStorage.setItem('user_email', 'test@test.com');
    localStorage.setItem('seller_token', 'seller-keep');

    clearAuthData('user');

    expect(localStorage.getItem('firebase_token')).toBeNull();
    expect(localStorage.getItem('user_id')).toBeNull();
    expect(localStorage.getItem('user_name')).toBeNull();
    expect(localStorage.getItem('user_email')).toBeNull();
    // Seller token should NOT be cleared
    expect(localStorage.getItem('seller_token')).toBe('seller-keep');
  });

  it('clears seller-specific keys when type is seller', () => {
    localStorage.setItem('seller_token', 'seller-token');
    localStorage.setItem('seller_id', 's1');
    localStorage.setItem('user_id', 'u1');

    clearAuthData('seller');

    expect(localStorage.getItem('seller_token')).toBeNull();
    // user_id should NOT be cleared by seller logout
    expect(localStorage.getItem('user_id')).toBe('u1');
  });

  it('clears admin-specific keys when type is admin', () => {
    localStorage.setItem('admin_token', 'admin-token');
    localStorage.setItem('admin_id', 'a1');
    localStorage.setItem('user_id', 'u1');

    clearAuthData('admin');

    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(localStorage.getItem('user_id')).toBe('u1');
  });
});

describe('saveTempCartItem / getTempCartItem / clearTempCartItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves a temp cart item', () => {
    saveTempCartItem(42, 2, 15000, 'stream-1', 'Test Product');
    const item = getTempCartItem();
    expect(item).not.toBeNull();
    expect(item.productId).toBe(42);
    expect(item.quantity).toBe(2);
    expect(item.priceSnapshot).toBe(15000);
    expect(item.liveStreamId).toBe('stream-1');
    expect(item.productName).toBe('Test Product');
    expect(item.timestamp).toBeTypeOf('number');
  });

  it('returns null when no temp cart item exists', () => {
    expect(getTempCartItem()).toBeNull();
  });

  it('clears temp cart item', () => {
    saveTempCartItem(1, 1, 1000);
    clearTempCartItem();
    expect(getTempCartItem()).toBeNull();
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem('tempCartItem', 'not-json');
    expect(getTempCartItem()).toBeNull();
    // Should also remove the corrupted value
    expect(localStorage.getItem('tempCartItem')).toBeNull();
  });
});

describe('saveFirebaseTokens', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores all provided values', () => {
    saveFirebaseTokens('fb-token', '123', 'TestUser', 'user', 'test@test.com', 'https://img.com/photo.jpg');

    expect(localStorage.getItem('firebase_token')).toBe('fb-token');
    expect(localStorage.getItem('user_id')).toBe('123');
    expect(localStorage.getItem('user_name')).toBe('TestUser');
    expect(localStorage.getItem('user_type')).toBe('user');
    expect(localStorage.getItem('user_email')).toBe('test@test.com');
    expect(localStorage.getItem('user_profile_image')).toBe('https://img.com/photo.jpg');
  });

  it('converts numeric userId to string', () => {
    saveFirebaseTokens('token', 456, 'User', 'user');
    expect(localStorage.getItem('user_id')).toBe('456');
  });

  it('removes email when not provided', () => {
    localStorage.setItem('user_email', 'old@test.com');
    saveFirebaseTokens('token', '1', 'User', 'user');
    expect(localStorage.getItem('user_email')).toBeNull();
  });

  it('removes profile image when not provided', () => {
    localStorage.setItem('user_profile_image', 'old-url');
    saveFirebaseTokens('token', '1', 'User', 'user');
    expect(localStorage.getItem('user_profile_image')).toBeNull();
  });
});
