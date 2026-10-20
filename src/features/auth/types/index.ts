/**
 * Auth Feature Types
 * 인증 관련 모든 타입 정의
 */

export interface KakaoUser {
  kakaoId: string;
  name: string;
  email?: string;
  emailVerified?: boolean;  // 🛡️ 2026-05-31: 카카오 is_email_verified — 셀러 자동연결 게이트.
  profileImage?: string;
  // 🛡️ 2026-05-24: 카카오 phone_number scope 동의 시 받아옴.
  //   형식: '+82 10-1234-5678' — DB 저장 시 숫자만 정규화.
  phoneNumber?: string;
}

export interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  // 🛡️ 2026-06-20 (OIDC): openid scope 요청 + 콘솔 OIDC 활성화 시 토큰 응답에 동봉.
  //   디코드해 sub/nickname/picture/email 을 얻으면 getUserInfo 왕복 1회 절약.
  id_token?: string;
}

export interface KakaoUserInfoResponse {
  id: number;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    email?: string;
    is_email_verified?: boolean;  // 🛡️ 2026-05-31: 셀러 same-email 자동연결 verified 게이트용.
    phone_number?: string;       // 🛡️ 2026-05-24: phone_number scope 동의 시.
    phone_number_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

export interface KakaoServiceTermsResponse {
  allowed_service_terms?: Array<{
    tag: string;
    agreed_at: string;
  }>;
}

export interface User {
  id: number;
  kakao_id?: string;
  name: string;
  email?: string;
  profile_image?: string;
  firebase_uid?: string;
  created_at?: string;
  last_login_at?: string;
  type?: 'user' | 'seller' | 'admin';
}

export interface FirebaseCustomClaims {
  role: 'user' | 'seller' | 'admin';
  userId: number;
  userName: string;
  email?: string;
  kakaoId?: string;
}

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface KakaoLoginResponse {
  customToken: string;
  user: {
    id: number;
    name: string;
    email?: string;
    profile_image?: string;
    firebaseUID: string;
  };
}
