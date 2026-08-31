/**
 * 📝 숙소 소개 문구 백필 — 이미 저장된 옛 조립 문장을 고친다
 *
 * 2026-08-31 대표: *"옛 문장들은 알아서 없어지는거야?"* → **아니오였다.**
 *
 * 옛 시드는 `${지역}의 ${유형} — ${desc}` 로 조립했고 desc 안에도 유형 이름이 들어 있어
 * "강릉의 호텔 — 접근성 좋은 호텔 — 깔끔한 룸 컨디션과 24시간 프런트." 가 됐다
 * (한 문장에 '호텔' 둘, 줄표 둘 — 대표가 "AI 티" 로 지적한 바로 그 문장).
 *
 * ⚠️ **조립을 없앤 것은 INSERT 경로뿐이었다.** 재시드의 치유 블록은 좌표·이름·가격만 손대고
 *   문구는 건드리지 않아서, 이미 저장된 줄은 영영 그대로였다 — 배포는 초록불이고 라이브 문구만
 *   안 바뀐다(에러가 없어서 안 보인다). ⇒ **문구를 바꾸는 일은 "시드 수정 + 백필"이 한 쌍이다.**
 *
 * ## 대상 판정 — 두 조건 다 필요하다
 * - `slug LIKE 'demo-stay-%'` — 빠지면 **관리자가 손으로 쓴 문구를 덮는다**
 * - `description LIKE '%—%'` — 조립문의 지문. 빠지면 멱등이 깨진다(새 desc 는 줄표를 안 쓰므로
 *   두 번 돌려도 무해하다 — 그 성질이 이 조건에서 나온다)
 */
type D1 = {
  prepare: (q: string) => {
    bind: (...a: unknown[]) => { run: () => Promise<{ meta: { changes?: number } }> }
    all: <T>() => Promise<{ results?: T[] }>
  }
}

/** 유형별 소개 문구. 호출부(`STAY_TYPES`)가 SSOT 라 그대로 받아 쓴다. */
export type StayTypeDesc = { type: string; desc: string }

/**
 * @returns 실제로 고친 행 수. **응답에 실어야 한다** — 계산만 하고 버리면 "돌았는데 0건"과
 *   "안 돌았음"을 구분할 수 없다(같은 파일의 `amenityHealed` 가 실제로 그 상태였다).
 */
export async function healStayDescriptions(DB: D1, types: readonly StayTypeDesc[]): Promise<number> {
  let healed = 0
  try {
    const stale = await DB.prepare(
      `SELECT p.id AS pid, psi.property_type AS ptype
         FROM products p JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE p.slug LIKE 'demo-stay-%' AND p.description LIKE '%—%'`
    ).all<{ pid: number; ptype: string | null }>()
      .catch(() => ({ results: [] as { pid: number; ptype: string | null }[] }))
    for (const row of (stale.results || [])) {
      const ty = types.find((t) => t.type === (row.ptype || '')) || types.find((t) => t.type === 'hotel')
      if (!ty) continue
      const r = await DB.prepare(
        `UPDATE products SET description = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(ty.desc, row.pid).run().catch(() => null)
      if (r && (r.meta.changes || 0) > 0) healed++
    }
  } catch { /* best-effort — 문구 백필 실패가 시드를 막지 않음 */ }
  return healed
}

/**
 * 🏨 시설 백필 (2026-07-21 대표 "기존 숙소도 시설 채워져?")
 *
 * 옛 시드가 시설 3개(주차/와이파이/조식)만 넣은 기존 데모를 업종별 5~6개 풍부 세트로 갱신한다.
 * **4개 미만인 것만** 대상 — 이미 풍부하면 skip 이고, 관리자 수기 편집분도 대개 4개+ 라 무접촉이다
 * (그 조건이 멱등성의 근거다).
 *
 * @returns 고친 행 수. 위 함수와 같은 이유로 **응답에 실어야 한다** — 이 값은 오래 계산만 되고
 *   버려져서, "돌았는데 0건"과 "안 돌았음"을 구분할 수 없었다(2026-08-31 에 노출).
 */
export async function healStayAmenities(DB: D1, rich: Record<string, string[]>): Promise<number> {
  let healed = 0
  try {
    const thin = await DB.prepare(
      `SELECT psi.product_id AS pid, psi.property_type AS ptype, psi.amenities AS amen
         FROM product_stay_info psi JOIN products p ON p.id = psi.product_id
        WHERE p.slug LIKE 'demo-stay-%' AND COALESCE(p.is_active,1) = 1`
    ).all<{ pid: number; ptype: string | null; amen: string | null }>()
      .catch(() => ({ results: [] as { pid: number; ptype: string | null; amen: string | null }[] }))
    for (const row of (thin.results || [])) {
      let cur: string[] = []
      try { const v = JSON.parse(row.amen || '[]'); if (Array.isArray(v)) cur = v.filter((x) => typeof x === 'string') } catch { /* bad json → 교체 */ }
      if (cur.length >= 4) continue  // 이미 풍부 — 무접촉
      const set = rich[row.ptype || ''] || rich.hotel
      const r = await DB.prepare(`UPDATE product_stay_info SET amenities = ? WHERE product_id = ?`)
        .bind(JSON.stringify(set), row.pid).run().catch(() => null)
      if (r && (r.meta.changes || 0) > 0) healed++
    }
  } catch { /* best-effort — 시설 백필 실패가 시드를 막지 않음 */ }
  return healed
}
