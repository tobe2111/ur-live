/**
 * 🔎 2026-09-03 (대표 — *"검색 기능이 제대로 이상적이지 못해. 키워드 단어만 검색해도 되어야 하는데"*)
 *   소비자 상품 검색의 **매칭·랭킹 SSOT**. SQL 문자열을 만드는 순수 함수라 단위 테스트가 가능하다.
 *
 * ## 왜 FTS 를 1급에서 내렸나 (라이브 실측)
 *
 * 라이브 `products_fts` 는 **`tokenize='porter unicode61'`** 이다(D1 `sqlite_master` 실측).
 * 코드는 2026-05-20 부터 `trigram` 으로 만들려 했지만 `CREATE VIRTUAL TABLE **IF NOT EXISTS**` 라
 * **이미 있으면 아무 일도 안 한다** — `repair-schema.routes.ts` 주석이 그 위험을 경고해 뒀는데
 * 후속 마이그레이션이 없었다. 즉 "한국어 부분매칭"은 **한 번도 라이브에 적용된 적이 없다.**
 *
 * porter unicode61 는 한국어를 공백으로만 자르고 쿼리는 접두사(`"토큰"*`) 매칭이라:
 *
 * | 검색어 | 라이브 결과 | 이유 |
 * |---|---|---|
 * | `커트` | 2건 | "남성 **커트** + 다운펌" — 독립 토큰이라 접두사 매칭 성공 |
 * | `돈가스` | **0건** | "치즈**돈가스** 2인 세트" — 토큰 *안쪽*이라 실패 |
 *
 * ⚠️ **그렇다고 trigram 으로 바꾸면 더 나빠진다**: SQLite FTS5 trigram 은 **3글자 미만 쿼리에
 * 결과를 내지 못한다.** 지금 잘 되는 `커트`·`네일`·`헤어`·`미용`(전부 2글자)이 통째로 죽는다.
 * 한국어 상용 검색어는 2글자가 압도적이라 이건 교환이 아니라 손실이다.
 *
 * 그리고 구멍이 하나 더 있었다 — **FTS 인덱스에 `restaurant_name` 이 없다**(name/description/category
 * 뿐). 이용권은 *매장*이 본질인데 **매장명으로는 검색이 안 됐다.** LIKE 경로(`findAll`)는 2026-07-20
 * 부터 매장명을 보지만, 그 경로는 **FTS 가 예외를 던질 때만** 돌아 사실상 죽어 있었다(0건 성공은 폴백 없음).
 *
 * ## 그래서 이 규모에서 이상적인 것
 *
 * 활성 상품 **2,606개**(실측)다. 이 규모에서 FTS 의 이점은 없고 함정만 있다 — 토크나이저가 한국어에
 * 안 맞고, 재생성은 위험한 DDL 이고, 컬럼 커버리지가 따로 관리돼 드리프트가 난다(실제로 났다).
 * **부분매칭 LIKE + SQL 랭킹**이면 2글자도, 단어 안쪽도, 매장명도 한 번에 해결되고 DDL 이 필요 없다.
 *
 * 🔭 **확장 한계(넘기면 다시 봐야 한다)**: `%q%` 는 인덱스를 못 타므로 활성 상품이 **수만 건**을 넘으면
 *   느려진다. 그때의 처방은 "FTS 를 되살리기"가 아니라 **trigram FTS + 2글자 LIKE 병행**이다
 *   (trigram 단독은 위의 2글자 문제 때문에 여전히 안 된다).
 */

/** LIKE 특수문자 이스케이프 — 사용자 입력의 `%` `_` `\` 가 와일드카드로 새는 것을 막는다. */
export function escapeLike(raw: string): string {
  return String(raw).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** 검색 대상 컬럼 — **매장명 포함**이 이 SSOT 의 핵심(이용권은 매장이 본질). */
export const SEARCH_COLUMNS = ['name', 'restaurant_name', 'description', 'category'] as const

const MAX_TOKENS = 5
const MAX_TOKEN_LEN = 40

/** 공백으로 자르고, 빈 토큰·과도한 길이·과도한 개수를 잘라낸다(거대 LIKE DoS 방지). */
export function tokenizeQuery(query: string): string[] {
  return String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(t => t.slice(0, MAX_TOKEN_LEN))
    .slice(0, MAX_TOKENS)
}

export interface SearchClause {
  /** `AND (...)` 형태로 이어 붙일 조건. 토큰이 없으면 빈 문자열. */
  where: string
  /** `ORDER BY` 앞에 놓을 점수 식(별칭 없이 표현식만). */
  rank: string
  /** where → rank 순서로 이어 붙인 바인드 값. */
  params: string[]
}

/**
 * 토큰 **AND** · 컬럼 **OR** 매칭 조건과 랭킹 식을 만든다.
 *
 * - 각 토큰(동의어 포함)이 네 컬럼 중 **어디든** 걸리면 그 토큰은 통과
 * - 모든 토큰이 통과해야 결과에 든다 → "홍대 돈가스" 처럼 여러 낱말이 좁혀진다
 * - 부분매칭(`%토큰%`)이라 **단어 안쪽**도 잡힌다(치즈**돈가스**)
 *
 * @param expand 동의어 확장기(호출부의 사전을 주입 — 이 모듈은 사전을 모른다)
 */
export function buildSearchClause(
  query: string,
  expand: (token: string) => string[] = () => [],
  table = '',
): SearchClause {
  const p = table ? `${table}.` : ''
  const tokens = tokenizeQuery(query)
  if (!tokens.length) return { where: '', rank: '0', params: [] }

  const whereParts: string[] = []
  const params: string[] = []

  for (const token of tokens) {
    const variants = [token, ...expand(token)]
    const ors: string[] = []
    for (const v of variants) {
      const like = `%${escapeLike(v)}%`
      for (const col of SEARCH_COLUMNS) {
        ors.push(`${p}${col} LIKE ? ESCAPE '\\'`)
        params.push(like)
      }
    }
    whereParts.push(`(${ors.join(' OR ')})`)
  }

  // 🏅 랭킹 — 전체 입력 문자열 기준. 사람은 "이름이 그 말로 시작하는 것"을 먼저 보고 싶어 한다.
  //   상품명 정확일치 > 상품명 시작 > 상품명 포함 > 매장명 포함 > 카테고리 > 그 외(설명만 걸린 것).
  const whole = tokens.join(' ')
  const esc = escapeLike(whole)
  const rank = `CASE
      WHEN ${p}name = ? THEN 1000
      WHEN ${p}name LIKE ? ESCAPE '\\' THEN 800
      WHEN ${p}name LIKE ? ESCAPE '\\' THEN 600
      WHEN ${p}restaurant_name LIKE ? ESCAPE '\\' THEN 500
      WHEN ${p}category LIKE ? ESCAPE '\\' THEN 300
      ELSE 100 END`
  params.push(whole, `${esc}%`, `%${esc}%`, `%${esc}%`, `%${esc}%`)

  return { where: whereParts.join(' AND '), rank, params }
}
