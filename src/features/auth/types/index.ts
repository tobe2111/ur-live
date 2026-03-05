/**
 * Auth Feature Types
 * 인증 관련 모든 타입 정의
 */

export interface KakaoUser {
  kakaoId: string;
  name: string;
  email?: string;
  profileImage?: string;
}

export interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export interface KakaoUserInfoResponse {
  id: number;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    email?: string;
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
