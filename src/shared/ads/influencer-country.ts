/**
 * 🌏 인플루언서 **국가 필터** (2026-11-14 대표 *"유튜브 같은 경우에는 외국인들도 있을텐데 … 필터링을 할 수 있게 해줘"*).
 *
 * ## 무엇으로 가르나 — 두 근거를 같이 쓴다
 * 1. **채널이 밝힌 국가** (`country`) — 유튜브 `channels.list` 의 `snippet.country`. 크리에이터가 직접 고른 값이다.
 * 2. **채널 이름·소개글이 한국어인가** — 한글이 한 글자라도 있으면 한국어 채널로 본다(SQLite `GLOB '*[가-힣]*'`).
 *
 * ## 왜 1 만으로는 안 되나 (2026-11-14 라이브 실측, 유튜브 24,672명)
 * ```
 *   KR 표기 17,427 · 해외 표기 1,514 · 미표기 5,731(23%)
 *   미표기 5,731   → 한국어 5,367 · 외국어 364     ← 미표기의 94%는 한국 채널이다
 *   해외 표기 1,514 → 한국어   557 · 외국어 957     ← `US` 라고 적은 '보람튜브'처럼 해외 거주 한국 채널
 * ```
 * 표기만 보면 한국 채널 5,367명이 '국가 모름'으로 빠지고, 해외 거주 한국 크리에이터 557명이 외국인으로 섞인다.
 *
 * ## 선택지
 * - `KR`        한국 — KR 표기 + 미표기 한국어 채널(네이버 블로그·카페·티스토리는 전부 KR)
 * - `ko_abroad` 해외 거주 한국어 채널 — 해외 표기인데 이름·소개가 한국어
 * - `foreign`   외국 채널 — 한국어가 아닌 채널(해외 표기 또는 미표기)
 * - 국가 코드   그 국가로 표기한 채널만(`US`·`JP` …) — 한국어 여부와 무관
 *
 * ⚠️ 이 판정은 **목록을 고르는 필터**일 뿐 저장값을 바꾸지 않는다. 한글 한 글자 기준이라 한국어 키워드를 제목에
 *   넣은 외국 채널은 한국어로 잡힐 수 있다(드물다 — 실측 판단은 화면에서 사람이 한다).
 */

/** 이름·소개에 한글이 있는가 — SQL 조각(바인딩 없음). */
export const KO_TEXT_SQL = "(name GLOB '*[가-힣]*' OR COALESCE(description, '') GLOB '*[가-힣]*')"
const NO_COUNTRY_SQL = "(country IS NULL OR country = '')"
const FOREIGN_DECLARED_SQL = "(country IS NOT NULL AND country != '' AND country != 'KR')"

/** 화면 선택지 — 값은 서버가 받는 그대로. 국가 코드는 라이브에서 많은 순(2026-11-14 실측). */
export const COUNTRY_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'KR', label: '한국' },
  { value: 'ko_abroad', label: '해외 거주 한국어 채널' },
  { value: 'foreign', label: '외국 채널(한국어 아님)' },
  { value: 'US', label: '미국' }, { value: 'IN', label: '인도' }, { value: 'JP', label: '일본' },
  { value: 'GB', label: '영국' }, { value: 'CA', label: '캐나다' }, { value: 'AU', label: '호주' },
  { value: 'ID', label: '인도네시아' }, { value: 'BR', label: '브라질' }, { value: 'VN', label: '베트남' },
  { value: 'DE', label: '독일' }, { value: 'FR', label: '프랑스' }, { value: 'TW', label: '대만' },
  { value: 'HK', label: '홍콩' }, { value: 'PH', label: '필리핀' },
]

/**
 * 국가 선택값 → WHERE 조각. 모르는 값이면 `null`(= 필터 없음 — 조용히 0건이 되지 않게).
 * 국가 코드는 대문자 두 글자만 받아 바인딩으로 넘긴다(임의 입력이 SQL 에 닿지 않는다).
 */
export function influencerCountryWhere(raw: string | null | undefined): { sql: string; binds: string[] } | null {
  const v = String(raw || '').trim()
  if (!v) return null
  if (v === 'KR') return { sql: `(country = 'KR' OR (${NO_COUNTRY_SQL} AND ${KO_TEXT_SQL}))`, binds: [] }
  if (v === 'ko_abroad') return { sql: `(${FOREIGN_DECLARED_SQL} AND ${KO_TEXT_SQL})`, binds: [] }
  if (v === 'foreign') return { sql: `((${FOREIGN_DECLARED_SQL} OR ${NO_COUNTRY_SQL}) AND NOT ${KO_TEXT_SQL})`, binds: [] }
  if (/^[A-Z]{2}$/.test(v)) return { sql: 'country = ?', binds: [v] }
  return null
}
