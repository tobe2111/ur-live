/**
 * 유어애즈(/api/ads) 라우터 공유 헬퍼 — marketing.routes.ts 분할 시 추출(2026-07-01).
 *   부모 라우터(연관키워드/키워드도구)와 searchad 서브 라우터가 함께 사용 → 단일 SSOT.
 */
import type { Env } from '@/worker/types/env'
import { loadSearchAdConnection } from '../searchad-connection'
import { searchAdCredsFrom, type SearchAdCreds } from '../searchad-client'

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
