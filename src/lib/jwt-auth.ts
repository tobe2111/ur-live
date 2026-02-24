/**
 * JWT 토큰 시스템
 * 
 * TODO: 프로젝트에 JWT 라이브러리 추가
 * npm install @tsndr/cloudflare-worker-jwt
 * 
 * Access Token (15분) + Refresh Token (30일) 패턴
 */

/*
import jwt from '@tsndr/cloudflare-worker-jwt';

const JWT_SECRET = 'your-secret-key-here'; // env.JWT_SECRET 사용

export interface TokenPayload {
  userId: number;
  userType: 'user' | 'admin' | 'seller';
  email?: string;
}

// Access Token 생성 (15분 유효)
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return await jwt.sign({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15분
    type: 'access'
  }, JWT_SECRET);
}

// Refresh Token 생성 (30일 유효)
export async function generateRefreshToken(payload: TokenPayload): Promise<string> {
  return await jwt.sign({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30일
    type: 'refresh'
  }, JWT_SECRET);
}

// Token 검증
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const isValid = await jwt.verify(token, JWT_SECRET);
    if (!isValid) return null;
    
    const decoded = jwt.decode(token);
    return decoded.payload as TokenPayload;
  } catch {
    return null;
  }
}

// Refresh Token으로 새 Access Token 발급
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const payload = await verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') return null;
  
  return await generateAccessToken({
    userId: payload.userId,
    userType: payload.userType,
    email: payload.email
  });
}

// Token Blacklist (로그아웃 시 사용)
export async function blacklistToken(
  token: string,
  kv: KVNamespace
): Promise<void> {
  const decoded = jwt.decode(token);
  const exp = decoded.payload.exp as number;
  const ttl = exp - Math.floor(Date.now() / 1000);
  
  if (ttl > 0) {
    await kv.put(`blacklist:token:${token}`, '1', { expirationTtl: ttl });
  }
}

export async function isTokenBlacklisted(
  token: string,
  kv: KVNamespace
): Promise<boolean> {
  const result = await kv.get(`blacklist:token:${token}`);
  return result !== null;
}
*/

export const placeholder = true;
