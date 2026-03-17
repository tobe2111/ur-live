// Firebase Configuration for Frontend - Lazy Loading Optimized
// Updated: 2026-03-17 - Moved to environment variables for security

import type { FirebaseApp } from 'firebase/app'
import type { Database } from 'firebase/database'
import type { Auth } from 'firebase/auth'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Validate Firebase configuration
const missingVars = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.toUpperCase().replace(/([A-Z])/g, '_$1')}`);

if (missingVars.length > 0) {
  console.error('❌ Missing Firebase environment variables:', missingVars.join(', '));
  console.error('⚠️ Firebase will not work properly without these variables');
}

// Lazy-initialized instances (null until first use)
let appInstance: FirebaseApp | null = null
let databaseInstance: Database | null = null
let authInstance: Auth | null = null

/**
 * Initialize Firebase App (lazy)
 * Only loads firebase/app when first called
 */
export async function initializeFirebase(): Promise<FirebaseApp> {
  if (appInstance) {
    return appInstance
  }

  console.log('🔥 Lazy loading Firebase App...')
  const { initializeApp } = await import('firebase/app')
  appInstance = initializeApp(firebaseConfig)
  console.log('✅ Firebase App initialized')
  
  return appInstance
}

/**
 * Get Firebase Realtime Database (lazy)
 * Only loads firebase/database when first called
 */
export async function getFirebaseDatabase(): Promise<Database> {
  if (databaseInstance) {
    return databaseInstance
  }

  console.log('🔥 Lazy loading Firebase Database...')
  const app = await initializeFirebase()
  const { getDatabase } = await import('firebase/database')
  databaseInstance = getDatabase(app)
  console.log('✅ Firebase Database initialized')
  
  return databaseInstance
}

/**
 * Get Firebase Auth (lazy)
 * Only loads firebase/auth when first called
 */
export async function getFirebaseAuth(): Promise<Auth> {
  if (authInstance) {
    return authInstance
  }

  console.log('🔥 Lazy loading Firebase Auth...')
  const app = await initializeFirebase()
  const { getAuth } = await import('firebase/auth')
  authInstance = getAuth(app)
  console.log('✅ Firebase Auth initialized')
  
  return authInstance
}

/**
 * Get Firebase App instance (lazy)
 * Use this if you need the app instance directly
 */
export async function getFirebaseApp(): Promise<FirebaseApp> {
  return initializeFirebase()
}

// For backward compatibility - deprecated, use async functions instead
// ⚠️ IMPORTANT: Don't use these directly - they might be null
// Use getFirebaseApp(), getFirebaseDatabase(), getFirebaseAuth() instead
export let app: FirebaseApp | null = null
export let database: Database | null = null
export let auth: Auth | null = null

// Update exports when initialized
export async function initializeAll() {
  const firebaseApp = await initializeFirebase()
  app = firebaseApp
  return firebaseApp
}

// Default export for backward compatibility
export default {
  get app() { return app },
  get database() { return database },
  get auth() { return auth }
}
