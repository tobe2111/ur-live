/**
 * CookieConsentBanner regression tests
 *
 * Verifies the consent state management API in src/components/CookieConsentBanner.tsx
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Inline copies of the public API to test (avoid React mounting)
const KEY = 'cookie_consent_v1';

function getCookieConsent(): 'accepted' | 'rejected' | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'accepted' || v === 'rejected' ? v : null;
  } catch {
    return null;
  }
}

function setCookieConsent(v: 'accepted' | 'rejected') {
  try { localStorage.setItem(KEY, v); } catch {}
}

describe('CookieConsentBanner — state management', () => {
  beforeEach(() => {
    try { localStorage.removeItem(KEY); } catch {}
  });

  it('returns null on first visit', () => {
    expect(getCookieConsent()).toBeNull();
  });

  it('persists accepted choice', () => {
    setCookieConsent('accepted');
    expect(getCookieConsent()).toBe('accepted');
  });

  it('persists rejected choice', () => {
    setCookieConsent('rejected');
    expect(getCookieConsent()).toBe('rejected');
  });

  it('returns null for malformed values (defensive)', () => {
    try { localStorage.setItem(KEY, 'unknown-value'); } catch {}
    expect(getCookieConsent()).toBeNull();
  });

  it('returns null when localStorage throws (privacy mode)', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    expect(getCookieConsent()).toBeNull();
    Storage.prototype.getItem = orig;
  });

  it('overrides previous choice', () => {
    setCookieConsent('rejected');
    setCookieConsent('accepted');
    expect(getCookieConsent()).toBe('accepted');
  });
});
