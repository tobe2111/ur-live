/**
 * Auth Feature Public API
 * 
 * 다른 모듈에서 auth feature를 사용할 때 이 파일만 import
 * 내부 구현이 변경되어도 public API는 유지됨
 */

// Routes
export { default as kakaoRoutes } from './api/kakao.routes';

// Services
export { KakaoAuthService } from './services/KakaoAuthService';
export { FirebaseAuthService } from './services/FirebaseAuthService';

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
