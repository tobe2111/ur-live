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
let app: FirebaseApp | null = null;
let database: Database | null = null;
let auth: Auth | null = null;

try {
  console.log('[Firebase] 🔥 초기화 시작...');
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);
  console.log('[Firebase] ✅ Firebase initialized successfully');
  console.log('[Firebase] ✅ Firebase Auth initialized');
  console.log('[Firebase] ✅ Firebase Database initialized');
} catch (error) {
  console.error('[Firebase] ❌ Firebase initialization failed:', error);
  console.error('[Firebase] ❌ Error details:', JSON.stringify(error, null, 2));
  
  // ⚠️ 에러가 발생해도 앱을 완전히 중단하지 않음
  // AuthContext에서 null 체크로 처리
  console.warn('[Firebase] ⚠️ 앱은 계속 실행되지만 Firebase 기능은 사용 불가');
}

// ✅ null 체크 헬퍼 함수
export function isFirebaseInitialized(): boolean {
  return app !== null && database !== null && auth !== null;
}

export { app, database, auth };
export default database;
