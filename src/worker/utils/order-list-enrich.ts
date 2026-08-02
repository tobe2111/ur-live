/**
 * 🧺 **셀러 주문 목록 enrich** — 주문에 상품 라인과 픽업일을 붙인다.
 *
 * `seller-orders.routes` GET /orders 에서 추출(2026-08-02). 로직은 옮겨온 그대로고,
 * 뺀 이유는 둘이다: 라우트 파일이 파일크기 래칫(1457줄)에 걸려 있었고,
 * **둘이 같은 조회 결과(`itemRows`)를 공유**해서 한 덩어리로 읽히는 편이 맞다.
 *
 * ## 🔴 머니 무접촉
 * 전부 **읽기**다. 금액·상태·정산·재고 어디도 안 건드린다. 실패해도 주문 목록 자체는 그대로 나간다
 * (조용히 삼키는 게 아니라, **목록을 못 보는 것보다 부가정보가 없는 게 낫다**는 판단이다).
 *
 * ## 📦 픽업일이 왜 필요한가
 * 의뢰서 §4 화면 C 는 *"오늘 픽업하러 올 사람이 누구고 뭘 가져가나"* 를 훑는 화면인데,
 * 이 응답에 픽업일이 없어서 셀러 화면이 **주문일**로 묶고 있었다 — 다른 질문에 답하는 화면이었다.
 * 픽업일은 `product_supply_meta.pickup_date` 에 있다(`products` 는 컬럼 예산제라 K-V 사이드테이블).
 */

type Row = Record<string, unknown>

/** 주문 행들에 `items` 와 `pickup_date` 를 **제자리에서** 붙인다. */
export async function enrichSellerOrderRows(
  DB: D1Database,
  orderRows: Row[],
): Promise<void> {
  if (orderRows.length === 0) return
  const oIds = orderRows.map((o) => Number(o.id)).filter(Number.isFinite)
  if (oIds.length === 0) return

  let itemRows: Row[] = []
  try {
    const iph = oIds.map(() => '?').join(',')
    const { results = [] } = await DB.prepare(
      `SELECT order_id, product_id, product_name, quantity, unit_price, subtotal, options, product_image
         FROM order_items WHERE order_id IN (${iph})`,
    ).bind(...oIds).all<Row>()
    itemRows = results
    const byOrder = new Map<number, Row[]>()
    for (const it of itemRows) {
      const oid = Number(it.order_id)
      if (!byOrder.has(oid)) byOrder.set(oid, [])
      byOrder.get(oid)!.push(it)
    }
    for (const o of orderRows) o.items = byOrder.get(Number(o.id)) || []
  } catch {
    return // 라인을 못 읽으면 픽업일도 못 구한다(제품 id 가 거기서 나온다)
  }

  // 📦 주문에 여러 상품이 섞이면 **가장 이른 날** — 손님이 가게에 오는 첫 날이 그 날이다.
  try {
    const pIds = [...new Set(itemRows.map((it) => Number(it.product_id)).filter(Number.isFinite))]
    if (pIds.length === 0) return
    const pph = pIds.map(() => '?').join(',')
    const { results: metaRows = [] } = await DB.prepare(
      `SELECT product_id, value FROM product_supply_meta
        WHERE key = 'pickup_date' AND value != '' AND product_id IN (${pph})`,
    ).bind(...pIds).all<{ product_id: number; value: string }>()
    if (metaRows.length === 0) return
    const dateByProduct = new Map(metaRows.map((m) => [Number(m.product_id), String(m.value)]))
    for (const o of orderRows) {
      const dates = ((o.items as Row[]) || [])
        .map((it) => dateByProduct.get(Number(it.product_id)))
        .filter((d): d is string => !!d)
        .sort()
      // 없으면 **null** — 빈 문자열로 채우면 화면이 "픽업일 있음"으로 오해한다.
      o.pickup_date = dates[0] ?? null
    }
  } catch { /* 픽업 메타 조회 실패 시 pickup_date 생략 — 주문 목록은 그대로 반환 */ }
}
