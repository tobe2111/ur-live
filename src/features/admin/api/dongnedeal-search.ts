/**
 * 🔎 동네딜 관리 목록의 **글자 필터** — 지역(region)과 검색(q).
 *
 * 🧱 왜 따로 있나: `admin-products.routes.ts` 가 파일크기 래칫에 동결돼 있어 그 안에서 못 늘린다
 *   (`scripts/file-size-baseline.json`). 그리고 여기로 나온 덕에 가드가 소스를 grep 하는 대신
 *   **함수를 불러 나온 SQL 과 바인딩을 직접 본다** — 문자열이 아니라 동작을 잰다.
 *
 * 규칙 두 가지:
 *   ① **공백은 AND** — "강남 파스타" 는 둘 다 든 것만. 하나라도(OR)로 하면 흔한 낱말 하나에
 *      목록 전체가 걸려 검색이 아니라 소음이 된다.
 *   ② 검색어는 **매장명 · 상품명 · 주소를 한꺼번에** 본다(칸을 셋으로 나누면, 손에 쥔 단서가
 *      셋 중 무엇인지 모르는 사람은 못 찾는다). 숫자만 넣으면 **상품 id** 도 함께 본다.
 *
 * ⚠️ LIKE 라 `%`·`_` 는 와일드카드로 동작한다(종전 지역 필터와 같은 성질). 값은 전부 바인딩이라
 *   주입 위험은 없고, 어드민 전용 화면이라 와일드카드는 해가 아니라 가끔 쓸모가 있다.
 */

/** 한 토큰이 훑는 열 — 늘리려면 여기만 고친다(물음표 수가 자동으로 맞는다). */
const Q_COLUMNS = ['restaurant_name', 'name', 'restaurant_address'] as const

/** 공백으로 자르고 최대 3토큰. 너무 많으면 LIKE 가 늘어나 느려지기만 한다. */
function tokens(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean).slice(0, 3)
}

export interface DongnedealTextFilters {
  /** WHERE 에 AND 로 이어 붙일 조각들. */
  sql: string[]
  /** 위 조각들과 **같은 순서**의 바인딩 값. 둘이 어긋나면 D1 이 'wrong number of bindings' 를 낸다. */
  params: (string | number)[]
}

export function dongnedealTextFilters(input: { region?: string | null; q?: string | null }): DongnedealTextFilters {
  const sql: string[] = []
  const params: (string | number)[] = []

  // 지역: 주소에만 건다(종전 동작 그대로).
  for (const tok of tokens(String(input.region || ''))) {
    sql.push('restaurant_address LIKE ?')
    params.push(`%${tok}%`)
  }

  const q = String(input.q || '').trim()
  if (q) {
    const toks = tokens(q)
    const one = `(${Q_COLUMNS.map((col) => `COALESCE(${col},'') LIKE ?`).join(' OR ')})`
    const byId = /^\d+$/.test(q)
    sql.push(byId ? `((${toks.map(() => one).join(' AND ')}) OR id = ?)` : toks.map(() => one).join(' AND '))
    for (const t of toks) for (let i = 0; i < Q_COLUMNS.length; i++) params.push(`%${t}%`)
    if (byId) params.push(Number(q))
  }

  return { sql, params }
}
