import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Import MSW server
import './mocks/server';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
}));

vi.mock('@/lib/firebase-config', () => ({
  initializeAll: vi.fn().mockResolvedValue({ name: '[DEFAULT]' }),
  initializeFirebase: vi.fn().mockResolvedValue({ name: '[DEFAULT]' }),
  initializeDatabase: vi.fn().mockResolvedValue({}),
  initializeAuth: vi.fn().mockResolvedValue({ currentUser: null }),
}));

vi.mock('@/lib/firebase', () => ({
  app: { name: '[DEFAULT]' },
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((cb: (user: null) => void) => { cb(null); return vi.fn(); }),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  signInWithCustomToken: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return vi.fn(); // unsubscribe function
  }),
  sendPasswordResetEmail: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  browserLocalPersistence: 'LOCAL',
  browserSessionPersistence: 'SESSION',
  inMemoryPersistence: 'NONE',
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  onValue: vi.fn(),
  set: vi.fn(),
  push: vi.fn(),
  get: vi.fn(),
}));

// Global mock for @/lib/firebase-auth lazy loader
// Individual tests can override with their own vi.mock('@/lib/firebase-auth', ...)
vi.mock('@/lib/firebase-auth', () => ({
  getFirebaseAuth: vi.fn().mockResolvedValue({ currentUser: null }),
  signInWithCustomToken: vi.fn().mockResolvedValue({
    user: { uid: 'mock-uid', getIdToken: vi.fn().mockResolvedValue('mock-token') },
  }),
  signInWithEmailAndPassword: vi.fn().mockResolvedValue({
    user: { uid: 'mock-uid', email: 'test@test.com', getIdToken: vi.fn().mockResolvedValue('mock-token') },
  }),
  createUserWithEmailAndPassword: vi.fn().mockResolvedValue({
    user: { uid: 'new-uid', email: 'new@test.com', getIdToken: vi.fn().mockResolvedValue('new-token') },
  }),
  signInWithPopup: vi.fn().mockResolvedValue({ user: { uid: 'popup-uid' } }),
  signOut: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return vi.fn();
  }),
}));

// 🌐 2026-11-01: node 환경(= prerender 와 같은 조건의 SSR 렌더 시험)에는 `window` 가 없다.
//   종전엔 이 줄이 바로 TypeError 를 내 **node 환경 시험 자체가 불가능**했고, 그래서
//   "렌더 중 window 접근" 을 재는 가드를 아무도 못 썼다(App.tsx 의 그 결함이 몇 달 살아남은 이유).
//   jsdom(기존 전 시험)에서는 `__win === window` 라 **byte-동일 동작**이다.
const __win: any = typeof window !== 'undefined' ? window : {}

// Mock window.Kakao
__win.Kakao = {
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  Auth: {
    authorize: vi.fn(),
    getAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    logout: vi.fn(),
  },
} as any;

// Mock react-i18next — return defaultValue with {{var}} interpolation so tests don't need full i18n init
vi.mock('react-i18next', () => {
  const interpolate = (template: string, vars?: Record<string, unknown>): string => {
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`));
  };
  const t = (key: string, opts?: Record<string, unknown> | string) => {
    if (typeof opts === 'string') return interpolate(opts);
    if (opts && typeof opts === 'object') {
      const dv = (opts as { defaultValue?: string }).defaultValue;
      return interpolate(dv ?? key, opts as Record<string, unknown>);
    }
    return key;
  };
  return {
    useTranslation: () => ({
      t,
      i18n: { changeLanguage: vi.fn().mockResolvedValue(undefined), language: 'ko' },
    }),
    Trans: ({ children, i18nKey, defaults }: { children?: unknown; i18nKey?: string; defaults?: string }) =>
      children ?? defaults ?? i18nKey ?? '',
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  };
});

// Mock Sentry
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
}));

// Mock window.location
delete __win.location;
__win.location = {
  href: 'http://localhost:5173',
  hostname: 'localhost',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'http://localhost:5173',
  protocol: 'http:',
  host: 'localhost:5173',
  port: '5173',
  assign: vi.fn(),
  reload: vi.fn(),
  replace: vi.fn(),
} as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
  error: console.error,
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

console.log('[Test Setup] Vitest environment configured');
