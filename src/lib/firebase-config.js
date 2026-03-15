// Firebase Configuration for Frontend - Lazy Loading Optimized
// Updated: 2026-03-09
// Firebase configuration from environment
const firebaseConfig = {
    apiKey: "AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8",
    authDomain: "urteam-live-commerce-5b284.firebaseapp.com",
    databaseURL: "https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "urteam-live-commerce-5b284",
    storageBucket: "urteam-live-commerce-5b284.firebasestorage.app",
    messagingSenderId: "352937066044",
    appId: "1:352937066044:web:e5bfd5e1d8f61688e30d39"
};
// Lazy-initialized instances (null until first use)
let appInstance = null;
let databaseInstance = null;
let authInstance = null;
/**
 * Initialize Firebase App (lazy)
 * Only loads firebase/app when first called
 */
export async function initializeFirebase() {
    if (appInstance) {
        return appInstance;
    }
    console.log('🔥 Lazy loading Firebase App...');
    const { initializeApp } = await import('firebase/app');
    appInstance = initializeApp(firebaseConfig);
    console.log('✅ Firebase App initialized');
    return appInstance;
}
/**
 * Get Firebase Realtime Database (lazy)
 * Only loads firebase/database when first called
 */
export async function getFirebaseDatabase() {
    if (databaseInstance) {
        return databaseInstance;
    }
    console.log('🔥 Lazy loading Firebase Database...');
    const app = await initializeFirebase();
    const { getDatabase } = await import('firebase/database');
    databaseInstance = getDatabase(app);
    console.log('✅ Firebase Database initialized');
    return databaseInstance;
}
/**
 * Get Firebase Auth (lazy)
 * Only loads firebase/auth when first called
 */
export async function getFirebaseAuth() {
    if (authInstance) {
        return authInstance;
    }
    console.log('🔥 Lazy loading Firebase Auth...');
    const app = await initializeFirebase();
    const { getAuth } = await import('firebase/auth');
    authInstance = getAuth(app);
    console.log('✅ Firebase Auth initialized');
    return authInstance;
}
/**
 * Get Firebase App instance (lazy)
 * Use this if you need the app instance directly
 */
export async function getFirebaseApp() {
    return initializeFirebase();
}
// For backward compatibility - deprecated, use async functions instead
// ⚠️ IMPORTANT: Don't use these directly - they might be null
// Use getFirebaseApp(), getFirebaseDatabase(), getFirebaseAuth() instead
export let app = null;
export let database = null;
export let auth = null;
// Update exports when initialized
export async function initializeAll() {
    const firebaseApp = await initializeFirebase();
    app = firebaseApp;
    return firebaseApp;
}
// Default export for backward compatibility
export default {
    get app() { return app; },
    get database() { return database; },
    get auth() { return auth; }
};
