/**
 * 🍽️ 대기 목록 행에 **영업신고증 보유 여부**만 얹는다 (2026-09-16).
 *
 * `admin-sellers.routes.ts` 는 957줄 동결 파일이라(god 파일 래칫) 여기로 뺐다 —
 * 라우트에 13줄을 더하면 CLAUDE.md 가 금지한 "일단 여기에 한 블록 더" 가 된다.
 *
 * 왜 필요한가: ① 어드민 OCR 패널이 **있는 서류만** 버튼을 띄우게 하려고(없는데 버튼이 보이면
 * 눌러 보고 400 을 받는다 — 안내가 아니라 소음이다) ② **사진을 직접 볼 수 있게** 하려고.
 * 등록증은 카드에 렌더되는데 영업신고증은 볼 방법이 없었다 — 확인 없이 승인하라는 셈이다.
 *
 * 🍽️ 2026-09-21 (대표 *"판매 전으로 하자"*) — **업종 힌트**를 같이 얹는다. 승인 화면이
 *   *"이 매장은 음식을 파는 것 같습니다"* 라고 한 줄 띄울 수 있어야 하는데, 그 판단 재료
 *   (`store_category`·`kakao_category`)가 같은 `seller_meta` 안에 있다 ⇒ **쿼리 추가 0**.
 *   ⚠️ 막지는 않는다(대표 *"어차피 내가 보고 승인해야하잖아"*). 표시만이다.
 *
 * 📍 **호출부 둘**: 서류 검증 큐(`/sellers/pending-business-registration`)와 **승인 목록**(`/sellers`).
 *   후자가 2026-09-21 배선분이다 — 판매가 시작되는 순간이 그 화면의 승인 버튼이라(대표 *"판매 전으로
 *   하자"*) 거기서 서류가 보여야 한다. `admin-sellers.routes.ts` 는 961줄 동결이라 그쪽엔 한 줄만 둔다.
 *
 * ⚠️ 저장 자리는 `seller_meta` K-V 다. `sellers` 는 정확히 100컬럼 = D1 결과셋 한도라 ALTER 금지.
 * ⚠️ **fail-soft** — 못 읽으면 버튼이 안 뜰 뿐이고, 목록 자체는 절대 안 깨진다.
 */
import { needsFoodPermit } from '../../../shared/food-permit'
export async function attachFoodPermitFlag<T extends { id: number }>(
  DB: D1Database,
  rows: T[],
): Promise<T[]> {
  if (!rows || rows.length === 0) return rows
  try {
    const { getSellerMeta } = await import('../../../worker/utils/seller-meta')
    const meta = await getSellerMeta(DB, rows.map((r) => r.id))
    for (const r of rows) {
      const m = meta.get(r.id)
      const url = m?.food_permit_url || null
      ;(r as Record<string, unknown>).food_permit_url = url
      ;(r as Record<string, unknown>).has_food_permit = !!url
      ;(r as Record<string, unknown>).needs_food_permit = needsFoodPermit(m?.store_category, m?.kakao_category)
    }
  } catch { /* additive — fail-soft */ }
  return rows
}
