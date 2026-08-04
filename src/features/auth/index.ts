/**
 * Auth Feature Public API
 * 
 * 다른 모듈에서 auth feature를 사용할 때 이 파일만 import
 * 내부 구현이 변경되어도 public API는 유지됨
 */

// Routes
export { default as kakaoRoutes } from './api/kakao.routes';
// 🔥 2026-08-04: googleRoutes 제거 — 2026-07-28(#806)에 이미 마운트 해제돼 있었다.
export { default as sellerRoutes } from './api/seller.routes';
export { default as adminRoutes } from './api/admin.routes';

// Services
export { KakaoAuthService } from './services/KakaoAuthService';
export { GoogleAuthService } from './services/GoogleAuthService';
// 🔥 2026-08-04: FirebaseAuthService 제거 — 서버 수용은 2026-07-28(#806)에 이미 끊겼고 GLOBAL 미런칭(#804).

// Types
export type {
  KakaoUser,
  KakaoTokenResponse,
  KakaoUserInfoResponse,
  KakaoServiceTermsResponse,
  User,
  FirebaseCustomClaims,
  AuthResponse,
  KakaoLoginResponse
} from './types';
