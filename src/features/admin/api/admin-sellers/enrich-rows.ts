/**
 * 🧩 어드민 셀러 목록 행에 **보여 줄 것들을 한 번에 얹는다** (2026-09-21).
 *
 * ## 왜 한 자리에 모았나
 * `admin-sellers.routes.ts` 는 **961줄 동결 파일**이다(god 파일 래칫). 목록에 뭔가 하나 더
 * 보여 줄 때마다 거기에 한 줄씩 늘리면 그 동결이 뚫린다 — 실제로 이번에 뚫렸고 가드가 막았다.
 * ⇒ 라우트에는 **호출 한 줄**만 두고, 무엇을 얹는지는 여기서 자란다.
 *
 * ## 지금 얹는 것
 * 1. 🧾 **등록증 URL 폴백** — 매장 등록 문이 `seller_meta` 에만 적던 시절 행이 있어
 *    컬럼만 읽으면 어드민이 "서류 없음" 으로 본다 (2026-09-20).
 * 2. 🍽️ **영업신고증 + 업종 힌트** — 판매가 시작되는 순간(승인 버튼)에 서류가 보여야 한다
 *    (2026-09-21 대표 *"판매 전으로 하자"*). ⚠️ **막지 않는다** — 표시 전용이다
 *    (대표 *"등록증이 없어도 승인 되게끔 해줘. 어차피 내가 보고 승인해야하잖아"*).
 *
 * ⚠️ 둘 다 **fail-soft** — 못 읽으면 그 값만 비고, 목록 자체는 절대 안 깨진다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export async function enrichSellerRows<T extends { id: number }>(
  DB: D1Database,
  rows: T[],
): Promise<T[]> {
  if (!rows || rows.length === 0) return rows
  await import('./cert-fallback').then((m) => m.attachCertUrls(DB, rows))
  await import('../seller-permit-flag').then((m) => m.attachFoodPermitFlag(DB, rows))
  return rows
}
