import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

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
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  onValue: vi.fn(),
  set: vi.fn(),
  push: vi.fn(),
  get: vi.fn(),
}));

// Mock window.Kakao
global.window.Kakao = {
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  Auth: {
    authorize: vi.fn(),
    getAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    logout: vi.fn(),
  },
} as any;

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
delete (window as any).location;
window.location = {
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

console.log('[Test Setup] Vitest environment configured');
