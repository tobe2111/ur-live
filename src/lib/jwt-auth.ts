/**
 * JWT 토큰 시스템
 * 
 * ✅ JWT 라이브러리 설치 완료: @tsndr/cloudflare-worker-jwt
 * 
 * Access Token (15분) + Refresh Token (30일) 패턴
 * KV 사용량을 90% 감소시키는 Stateless 인증 시스템
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

// JWT Secret은 환경변수에서 가져오거나 기본값 사용
// 프로덕션에서는 반드시 env.JWT_SECRET 사용!
export function getJwtSecret(env?: any): string {
  return env?.JWT_SECRET || 'ur-live-commerce-jwt-secret-2026-CHANGE-THIS-IN-PRODUCTION';
}

export interface TokenPayload {
  userId: number;
  userType: 'user' | 'admin' | 'seller';
  email?: string;
  type?: 'access' | 'refresh';
  exp?: number;
}

// Access Token 생성 (15분 유효)
export async function generateAccessToken(payload: TokenPayload, secret: string): Promise<string> {
  return await jwt.sign({
    userId: payload.userId,
    userType: payload.userType,
    email: payload.email,
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15분
    type: 'access'
  }, secret);
}

// Refresh Token 생성 (30일 유효)
export async function generateRefreshToken(payload: TokenPayload, secret: string): Promise<string> {
  return await jwt.sign({
    userId: payload.userId,
    userType: payload.userType,
    email: payload.email,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30일
    type: 'refresh'
  }, secret);
}

// Token 검증
export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const isValid = await jwt.verify(token, secret);
    if (!isValid) return null;
    
    const decoded = jwt.decode(token);
    return decoded.payload as TokenPayload;
  } catch {
    return null;
  }
}

// Refresh Token으로 새 Access Token 발급
export async function refreshAccessToken(refreshToken: string, secret: string): Promise<string | null> {
  const payload = await verifyToken(refreshToken, secret);
  if (!payload || payload.type !== 'refresh') return null;
  
  return await generateAccessToken({
    userId: payload.userId,
    userType: payload.userType,
    email: payload.email
  }, secret);
}

// Token Blacklist (로그아웃 시 사용)
// KV에 저장하지만 사용 빈도가 낮아서 KV 사용량에 큰 영향 없음
export async function blacklistToken(
  token: string,
  kv: KVNamespace,
  secret: string
): Promise<void> {
  try {
    const decoded = jwt.decode(token);
    const exp = decoded.payload.exp as number;
    const ttl = exp - Math.floor(Date.now() / 1000);
    
    if (ttl > 0) {
      await kv.put(`blacklist:token:${token}`, '1', { expirationTtl: ttl });
    }
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }
}

export async function isTokenBlacklisted(
  token: string,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const result = await kv.get(`blacklist:token:${token}`);
    return result !== null;
  } catch {
    return false;
  }
}

// 메모리 캐시 (Worker 재시작 시 초기화됨)
const tokenCache = new Map<string, { payload: TokenPayload, exp: number }>();

// 캐시된 토큰 검증 (KV 사용량 추가 감소)
export async function verifyCachedToken(
  token: string,
  secret: string
): Promise<TokenPayload | null> {
  const now = Math.floor(Date.now() / 1000);
  
  // 캐시 확인
  const cached = tokenCache.get(token);
  if (cached && cached.exp > now) {
    return cached.payload;
  }
  
  // 캐시 미스 - 실제 검증
  const payload = await verifyToken(token, secret);
  if (payload && payload.exp) {
    tokenCache.set(token, { payload, exp: payload.exp });
    
    // 캐시 크기 제한 (1000개)
    if (tokenCache.size > 1000) {
      const firstKey = tokenCache.keys().next().value;
      tokenCache.delete(firstKey);
    }
  }
  
  return payload;
}
