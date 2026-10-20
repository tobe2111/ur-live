/**
 * 🎟️ 공구 세션 저장/조회 (서버) — product_supply_meta K-V 위 gb_* 키.
 *   순수 모델은 src/shared/gb-session.ts (SSOT). 여기선 DB read/write 배선만.
 *   2026-07-06 공구 엔진 완결 스펙 §1. 컬럼 예산 동결 준수(사이드테이블).
 */
import { getSupplyMeta, setSupplyMeta } from './product-supply-meta'
import { parseGbSession, gbSessionToMeta, type GbSession } from '../../shared/gb-session'

/** 단일 상품의 공구 세션 조회(없으면 mode:'off'). */
export async function getGbSession(DB: D1Database, productId: number): Promise<GbSession> {
  const map = await getSupplyMeta(DB, [productId]).catch(() => null)
  return parseGbSession(map?.get(productId))
}

/** 여러 상품의 공구 세션 일괄 조회(리스트/피드 enrich 용). */
export async function getGbSessions(DB: D1Database, productIds: number[]): Promise<Map<number, GbSession>> {
  const out = new Map<number, GbSession>()
  const map = await getSupplyMeta(DB, productIds).catch(() => null)
  for (const id of productIds) out.set(id, parseGbSession(map?.get(id)))
  return out
}

/** 공구 세션 저장(전 키 명시 upsert — off 는 나머지 청소). fail-soft 는 호출부에서. */
export async function saveGbSession(DB: D1Database, productId: number, session: GbSession): Promise<void> {
  await setSupplyMeta(DB, productId, gbSessionToMeta(session))
}
