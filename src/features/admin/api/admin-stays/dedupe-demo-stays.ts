/**
 * 🏨 2026-10-31 (대표 "데모 이용권을 발급하는데 부산에 휴가스테이 이용권이 3개나 나와. 심지어 스탠다드 텐트는
 *   중복으로 2개가 나오고. 방 옵션의 경우에는 이용권 상세페이지 하나에서 다 볼 수 있게 해줘야지").
 *
 * ## 왜 생겼나
 * 데모 숙소 시드의 "같은 실숙소 중복 방지" 검사가 `products.name = 숙소명` 이었다. 그런데 2026-07-20 v3 치유가
 * 제목을 오퍼명(`평일 1박 숙박권 (스탠다드 텐트)`)으로 바꾸고 숙소명은 `restaurant_name` 으로 옮겼다 → 그 뒤로
 * 검사가 **항상 '없음'** 이라 같은 숙소가 다시 시드될 때마다 상품이 하나씩 늘었다(라이브 실측: 활성 25개 중
 * 휴가스테이 3 · 모가스테이 2 · 제주애월별헤는밤 2 · 호텔휴 2).
 *
 * ## 고치는 법
 * ① 시드 검사는 `restaurant_name` 도 본다(`findExistingStay`).
 * ② 이미 생긴 중복은 **한 상세로 합친다**(`mergeDuplicateDemoStays`): 가장 먼저 만든 상품을 남기고, 나머지의
 *    객실 중 남는 상품에 **없는 이름**만 옮긴 뒤 나머지 상품은 비활성(`is_active=0` — 지우지 않는다, 되돌릴 수 있다).
 *    같은 이름 객실(스탠다드 텐트 ×2)은 옮기지 않는다 — 그게 대표가 본 중복이다.
 * 🔒 데모(`slug 'demo-stay-%'`)만 건드린다. 실숙소는 대상이 아니다. 멱등 — 두 번 돌려도 무해.
 */
type D1 = {
  prepare: (sql: string) => {
    bind: (...v: unknown[]) => {
      all: <T = unknown>() => Promise<{ results?: T[] }>
      first: <T = unknown>() => Promise<T | null>
      run: () => Promise<{ meta?: { changes?: number } }>
    }
    all: <T = unknown>() => Promise<{ results?: T[] }>
  }
}

/** 시드 전 검사 — 같은 숙소(숙소명 또는 옛 제목)로 이미 활성 숙소 상품이 있는가. */
export async function findExistingStay(DB: D1, storeName: string): Promise<number | null> {
  const row = await DB.prepare(
    `SELECT id FROM products WHERE category = 'stay_voucher' AND COALESCE(is_active, 1) = 1
        AND (restaurant_name = ? OR name = ?) LIMIT 1`,
  ).bind(storeName, storeName).first<{ id: number }>().catch(() => null)
  return row?.id ?? null
}

/** 같은 숙소로 갈라진 데모 숙소를 하나로 합친다. 합쳐서 비활성으로 돌린 상품 수를 돌려준다. */
export async function mergeDuplicateDemoStays(DB: D1): Promise<number> {
  const { results } = await DB.prepare(
    `SELECT id, restaurant_name FROM products
      WHERE slug LIKE 'demo-stay-%' AND COALESCE(is_active, 1) = 1 AND restaurant_name IS NOT NULL
        AND restaurant_name IN (
          SELECT restaurant_name FROM products
           WHERE slug LIKE 'demo-stay-%' AND COALESCE(is_active, 1) = 1 AND restaurant_name IS NOT NULL
           GROUP BY restaurant_name HAVING COUNT(*) > 1)
      ORDER BY restaurant_name, id`,
  ).all<{ id: number; restaurant_name: string }>().catch(() => ({ results: [] as { id: number; restaurant_name: string }[] }))
  const groups = new Map<string, number[]>()
  for (const r of results || []) {
    const g = groups.get(r.restaurant_name) || []
    g.push(r.id)
    groups.set(r.restaurant_name, g)
  }
  let merged = 0
  for (const ids of groups.values()) {
    const [keeper, ...extras] = ids
    for (const extra of extras) {
      // 남는 상품에 없는 이름의 객실만 옮긴다(같은 이름은 중복이라 버린다 — 비활성 상품에 남는다).
      await DB.prepare(
        `UPDATE product_stay_rooms SET product_id = ?
          WHERE product_id = ? AND name NOT IN (SELECT name FROM product_stay_rooms WHERE product_id = ?)`,
      ).bind(keeper, extra, keeper).run().catch(() => null)
      await DB.prepare(
        `UPDATE product_stay_calendar SET product_id = ?
          WHERE room_id IN (SELECT id FROM product_stay_rooms WHERE product_id = ?) AND product_id = ?`,
      ).bind(keeper, keeper, extra).run().catch(() => null)
      const r = await DB.prepare(
        `UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND slug LIKE 'demo-stay-%'`,
      ).bind(extra).run().catch(() => null)
      if ((r?.meta?.changes ?? 0) > 0) merged++
    }
    // 객실이 늘었으면 카드의 '1박 N원~' 이 가장 싼 객실을 가리키게 한다.
    await DB.prepare(
      `UPDATE products SET price = (SELECT MIN(base_price_weekday) FROM product_stay_rooms WHERE product_id = ? AND is_active = 1)
        WHERE id = ? AND (SELECT MIN(base_price_weekday) FROM product_stay_rooms WHERE product_id = ? AND is_active = 1) < price`,
    ).bind(keeper, keeper, keeper).run().catch(() => null)
  }
  return merged
}
