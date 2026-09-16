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
 * ⚠️ 저장 자리는 `seller_meta` K-V 다. `sellers` 는 정확히 100컬럼 = D1 결과셋 한도라 ALTER 금지.
 * ⚠️ **fail-soft** — 못 읽으면 버튼이 안 뜰 뿐이고, 목록 자체는 절대 안 깨진다.
 */
export async function attachFoodPermitFlag<T extends { id: number }>(
  DB: D1Database,
  rows: T[],
): Promise<T[]> {
  if (!rows || rows.length === 0) return rows
  try {
    const { getSellerMeta } = await import('../../../worker/utils/seller-meta')
    const meta = await getSellerMeta(DB, rows.map((r) => r.id))
    for (const r of rows) {
      const url = meta.get(r.id)?.food_permit_url || null
      ;(r as Record<string, unknown>).food_permit_url = url
      ;(r as Record<string, unknown>).has_food_permit = !!url
    }
  } catch { /* additive — fail-soft */ }
  return rows
}
