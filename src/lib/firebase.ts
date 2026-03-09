// Firebase Configuration for Frontend - Lazy Loading
// Updated: 2026-03-09
// This file re-exports from firebase-config.ts for backward compatibility

export { 
  initializeFirebase,
  getFirebaseApp,
  getFirebaseDatabase,
  getFirebaseAuth
} from './firebase-config'

// Deprecated exports for backward compatibility
// Please use the async functions above instead
export const app = null as any
export const database = null as any
export const auth = null as any

export function isFirebaseInitialized(): boolean {
  // Firebase is now lazy-loaded, so always return true
  // Individual components will handle loading state
  return true
}

export default null as any
