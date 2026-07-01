/**
 * 유어애즈(/api/ads) 라우터 공유 헬퍼 — marketing.routes.ts 분할 시 추출(2026-07-01).
 *   부모 라우터(연관키워드/키워드도구)와 searchad 서브 라우터가 함께 사용 → 단일 SSOT.
 */
import type { Context, Next } from 'hono'
import type { Env } from '@/worker/types/env'
import { loadSearchAdConnection } from '../searchad-connection'
import { searchAdCredsFrom, type SearchAdCreds } from '../searchad-client'
import { adsAccountIdFrom, getAdsAccount } from '../ads-account'

// ── 🔒 베타 액세스 게이트 (서버측 강제) ──────────────────────────────────────
//   그간 `access_unlocked` 는 클라(대시보드 redirect)에서만 검사 → 토큰만 있으면 데이터 API 직접
//   호출로 우회 가능했음. 이 미들웨어가 데이터 엔드포인트 전체를 서버측에서 게이트한다. 면제:
//     · /ping(공개 헬스) · /auth/*(가입/로그인/me/계정/비번/**unlock**/forgot/reset — 잠금상태에서도 필요)
//     · /clickguard/pixel.js · /clickguard/hit (광고주 사이트 삽입 공개 픽셀 — 무인증)
//   그 외는 유효 토큰 + access_unlocked=1 + status='active' 필수(정지 계정의 옛 토큰 재사용도 차단).
const unlockExempt = (rel: string): boolean =>
  rel === '/ping' || rel.startsWith('/auth/') || rel === '/clickguard/pixel.js' || rel === '/clickguard/hit'

export async function requireAdsUnlocked(c: Context<{ Bindings: Env }>, next: Next) {
  const rel = c.req.path.replace(/^\/api\/ads/, '')
  if (unlockExempt(rel)) return next()
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const acc = await getAdsAccount(c.env.DB, id).catch(() => null)
  if (!acc || (acc.status && acc.status !== 'active')) return c.json({ success: false, error: '이용이 제한된 계정입니다' }, 403)
  if (acc.access_unlocked !== 1) return c.json({ success: false, error: '베타 액세스 코드 입력이 필요합니다', locked: true }, 403)
  return next()
}

/** 베타 액세스 코드(대표 지정). env 로 교체 가능, 기본 358533. */
export const adsAccessCode = (env: Env) => (env as unknown as { ADS_ACCESS_CODE?: string }).ADS_ACCESS_CODE || '358533'

// 오픈API 자격증명 — NAVER_SEARCH_* 우선, 없으면 NAVER_* 폴백.
export const naverOpenId = (env: Env) => env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
export const naverOpenSecret = (env: Env) => env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET

/** 연관키워드/예상가용 자격증명: 연결된 고객사 키 우선, 없으면 플랫폼(관리계정 47982) 폴백.
 *  RelKwdStat/Estimate 는 customer-level 이라 둘 다 동작 — 연결 시 그 계정 컨텍스트로. */
export async function resolveSearchAdCreds(c: { env: Env }, sellerId: number): Promise<SearchAdCreds | null> {
  const tenant = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  return tenant || searchAdCredsFrom(c.env)
}
