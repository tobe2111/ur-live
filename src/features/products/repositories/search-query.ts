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

/**
 * 검색 대상 컬럼 — **매장명 포함**이 이 SSOT 의 핵심(이용권은 매장이 본질).
 *
 * 📍 2026-11-02 (대표 — *"부산 같이 지역을 검색 시에 이용권이 왜이렇게 안나오지?"*): **매장 주소**를 더했다.
 *   종전엔 주소를 아무 데서도 안 봐서, 지역 검색은 상품명·설명에 그 지명이 *우연히* 적힌 것만 잡았다.
 *   라이브 실측(활성 이용권 182개): 주소가 부산인 것 **7 → 검색에 걸린 것 1** · 해운대 3 → 0 ·
 *   서울 86 → 2 · 강남 8 → 1. 지역은 이용권 검색의 가장 흔한 축인데 그 축이 통째로 비어 있었다.
 */
export const SEARCH_COLUMNS = ['name', 'restaurant_name', 'restaurant_address', 'description', 'category'] as const

/**
 * 🗺️ 시·도 표기 차이 — 주소는 `부산 해운대구…` 처럼 **짧은 이름**으로도, `부산광역시…` 처럼 긴 이름으로도
 *   들어온다(라이브: `경북`·`경남`·`충북` 은 짧게, `제주특별자치도`·`전북특별자치도` 는 길게).
 *   부분매칭이라 `부산` 은 둘 다 잡지만, 사람이 `부산시`·`경상북도` 로 치면 어느 쪽에도 안 걸린다.
 *   ⇒ 같은 시·도의 표기들을 한 묶음으로 두고, 검색어가 그중 하나면 나머지를 같이 찾는다.
 *   ⚠️ 시·군·구(해운대구 등)는 여기 넣지 않는다 — 주소에 늘 같은 꼴로 적혀 부분매칭으로 충분하다.
 */
const REGION_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['서울', '서울시', '서울특별시'],
  ['부산', '부산시', '부산광역시'],
  ['대구', '대구시', '대구광역시'],
  ['인천', '인천시', '인천광역시'],
  ['광주', '광주광역시'],
  ['대전', '대전시', '대전광역시'],
  ['울산', '울산시', '울산광역시'],
  ['세종', '세종시', '세종특별자치시'],
  ['경기', '경기도'],
  ['강원', '강원도', '강원특별자치도'],
  ['충북', '충청북도'],
  ['충남', '충청남도'],
  ['전북', '전라북도', '전북특별자치도'],
  ['전남', '전라남도'],
  ['경북', '경상북도'],
  ['경남', '경상남도'],
  ['제주', '제주도', '제주특별자치도'],
]

/** 시·도 표기인가 (`부산`·`부산광역시`·`경상북도` …). */
export function isRegionName(token: string): boolean {
  const t = token.trim()
  return REGION_GROUPS.some(g => g.includes(t))
}

/**
 * 검색어가 시·도 표기면 같은 시·도의 **다른 표기**들을 돌려준다.
 * 긴 표기는 짧은 표기를 포함하므로(`부산광역시` ⊃ `부산`) 짧은 것 하나만 있어도 부분매칭이 다 잡는다 —
 * 그래서 **가장 짧은 표기**와, 짧은 것이 긴 것의 접두사가 아닌 표기(`경상북도` ↔ `경북`)만 더한다.
 */
export function regionVariants(token: string): string[] {
  const t = token.trim()
  const group = REGION_GROUPS.find(g => g.includes(t))
  if (!group) return []
  // 짧은 것부터 보며, 이미 고른 표기(검색어 포함)가 **안에 들어 있는** 표기는 버린다 — `%부산%` 이
  //   `부산광역시` 를 이미 잡으므로 둘 다 넣으면 LIKE 만 늘어난다.
  const kept: string[] = [t]
  for (const v of [...group].sort((a, b) => a.length - b.length)) {
    if (kept.some(k => v.includes(k))) continue
    kept.push(v)
  }
  return kept.slice(1)
}

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
  /** 점수 식(별칭 없이 표현식만). SELECT 에 놓든 ORDER BY 에 놓든 호출부 자유. */
  rank: string
  /** 🔴 `where` 안의 `?` 에 들어갈 값 — **`where` 가 SQL 텍스트에 등장하는 자리**에 맞춰 넘긴다. */
  whereParams: string[]
  /** 🔴 `rank` 안의 `?` 에 들어갈 값 — **`rank` 가 SQL 텍스트에 등장하는 자리**에 맞춰 넘긴다. */
  rankParams: string[]
}

/**
 * 토큰 **AND** · 컬럼 **OR** 매칭 조건과 랭킹 식을 만든다.
 *
 * - 각 토큰(동의어 포함)이 네 컬럼 중 **어디든** 걸리면 그 토큰은 통과
 * - 모든 토큰이 통과해야 결과에 든다 → "홍대 돈가스" 처럼 여러 낱말이 좁혀진다
 * - 부분매칭(`%토큰%`)이라 **단어 안쪽**도 잡힌다(치즈**돈가스**)
 *
 * @param expand 동의어 확장기(호출부의 사전을 주입 — 이 모듈은 사전을 모른다)
 *
 * 🩸 **바인드 값을 한 배열로 합쳐 돌려주지 않는다**(2026-09-30 라이브 결함 수리). 종전엔
 *   `params = [...where, ...rank]` 한 벌이었는데, 호출부(`ProductRepository.searchByText`)는
 *   랭킹 식을 **SELECT 에** 놓는다 — SQL 텍스트에서 `rank` 의 `?` 가 `where` 의 `?` 보다 **먼저**
 *   나온다. SQLite 는 **텍스트 등장 순서**로 바인딩하므로 두 묶음이 통째로 어긋났다.
 *   개수가 맞아 예외가 안 나고, 어긋난 값도 전부 `%…%` LIKE 패턴이라 **에러 없이 조용히 틀린 결과**가
 *   나왔다(라이브 실측: `홍대` 21건인데 `홍대 홍대` 0건 · 제안으로 띄운 상품명을 그대로 검색하면 0건).
 *   ⇒ 묶음을 **둘로 쪼개** 호출부가 자기 SQL 순서대로 넘기게 한다. 합쳐서 주면 순서를 아는 사람이
 *   아무도 없다 — 그게 이 결함의 원인이었다.
 */
export function buildSearchClause(
  query: string,
  expand: (token: string) => string[] = () => [],
  table = '',
): SearchClause {
  const p = table ? `${table}.` : ''
  const tokens = tokenizeQuery(query)
  if (!tokens.length) return { where: '', rank: '0', whereParams: [], rankParams: [] }

  const whereParts: string[] = []
  const whereParams: string[] = []

  for (const token of tokens) {
    const variants = [...new Set([token, ...regionVariants(token), ...expand(token)])]
    const ors: string[] = []
    for (const v of variants) {
      const like = `%${escapeLike(v)}%`
      // 🗺️ 시·도 이름은 주소의 **낱말 첫머리**에서만 맞춘다 — `%대구%` 는 `부산 해운대구 …` 를 잡는다
      //   (2026-11-02 시험이 실제로 잡은 오매칭). 낱말 첫머리 = 주소 맨 앞(`대구 중구 …`) 또는
      //   공백 바로 뒤(`경기 광주시 …`). 그래서 `광주` 는 광주광역시와 경기 광주시를 **둘 다** 잡는다.
      //   ⚠️ 공백 뒤 매칭은 **사람이 직접 친 낱말**에만 — `광주광역시` 로 쳤는데 거기서 펼친 `광주` 가
      //   경기 광주시까지 끌고 오면 안 된다(펼친 표기는 주소 맨 앞에서만).
      const region = isRegionName(v)
      for (const col of SEARCH_COLUMNS) {
        if (col === 'restaurant_address' && region && v === token) {
          ors.push(`(${p}${col} LIKE ? ESCAPE '\\' OR ${p}${col} LIKE ? ESCAPE '\\')`)
          whereParams.push(`${escapeLike(v)}%`, `% ${escapeLike(v)}%`)
        } else if (col === 'restaurant_address' && region) {
          ors.push(`${p}${col} LIKE ? ESCAPE '\\'`)
          whereParams.push(`${escapeLike(v)}%`)
        } else {
          ors.push(`${p}${col} LIKE ? ESCAPE '\\'`)
          whereParams.push(like)
        }
      }
    }
    whereParts.push(`(${ors.join(' OR ')})`)
  }

  // 🏅 랭킹 — 전체 입력 문자열 기준. 사람은 "이름이 그 말로 시작하는 것"을 먼저 보고 싶어 한다.
  //   상품명 정확일치 > 상품명 시작 > 상품명 포함 > 매장명 포함 > 매장 주소 포함 > 카테고리 > 그 외(설명만 걸린 것).
  const whole = tokens.join(' ')
  const esc = escapeLike(whole)
  const rank = `CASE
      WHEN ${p}name = ? THEN 1000
      WHEN ${p}name LIKE ? ESCAPE '\\' THEN 800
      WHEN ${p}name LIKE ? ESCAPE '\\' THEN 600
      WHEN ${p}restaurant_name LIKE ? ESCAPE '\\' THEN 500
      WHEN ${p}restaurant_address LIKE ? ESCAPE '\\' THEN 400
      WHEN ${p}category LIKE ? ESCAPE '\\' THEN 300
      ELSE 100 END`
  const rankParams = [whole, `${esc}%`, `%${esc}%`, `%${esc}%`, `%${esc}%`, `%${esc}%`]

  return { where: whereParts.join(' AND '), rank, whereParams, rankParams }
}
