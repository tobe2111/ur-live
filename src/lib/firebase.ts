// Firebase Configuration for Frontend
// Auto-generated: 2026-02-27

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

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

// Initialize Firebase
let app: FirebaseApp;
let database: Database;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);
  console.log('✅ Firebase initialized successfully');
  console.log('✅ Firebase Auth initialized');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  throw error;
}

export { app, database, auth };
export default database;
