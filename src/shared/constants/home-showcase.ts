/**
 * 🏠 2026-08-04 (대표 시안 승인 "좋다 이렇게 가자"): 홈 쇼케이스 SSOT —
 *   ④ 히어로 배너 · ① 카테고리 섹션 · ③ 중간 배너.
 *
 * 여기어때 메인에서 차용한 것만 골라 현재 PC 홈 위에 얹는다. 시안:
 * `docs/design/home-showcase-2026-08.md`
 *
 * ## 왜 SSOT 인가
 * 배너 종류(`banner_type`)와 섹션 소스(`source`)는 **DB 값 · 서버 쿼리 · 어드민 select ·
 * 클라이언트 렌더** 네 곳이 같은 문자열을 알아야 한다. 네 벌로 두면 반드시 갈라지고,
 * 갈라지는 순간 증상은 "어드민에서 등록했는데 홈에 안 뜬다" 하나로 뭉뚱그려진다.
 *
 * ⚠️ 워커(esbuild)에서도 로드되므로 이 파일은 **의존성 0**을 유지할 것.
 */

/**
 * 배너가 놓이는 자리. DB `banners.banner_slot` 값과 1:1.
 *
 * 🔴 **NULL(미지정) 이 정상 상태다** — 자리를 고르지 않은 배너는 홈 쇼케이스에 **안 뜬다**.
 *
 * ## 왜 이렇게 바꿨나 (2026-08-04 대표 신고 "이렇게 뜨는게 정상이야?")
 * 처음엔 `banner_type` 컬럼을 `DEFAULT 'inline'` 로 추가했다. SQLite 는 그 기본값을
 * **기존 행에도 적용**하므로, 예전에 다른 용도로 올려둔 배너가 **저절로 중간 배너 자리에 나타났다.**
 * 대표가 못박은 *"안 올리면 아예 안 보이게"* 를 정확히 어긴 것이다(라이브에서 실제로 그랬다).
 *
 * ⇒ 자리는 **사람이 고른 것만** 값이 된다. 기본값 없는 새 컬럼(`banner_slot`)이라
 *   기존 행은 NULL 로 남고, NULL 은 어디에도 안 뜬다. 되돌리는 데이터 수정이 필요 없다.
 */
export const BANNER_SLOTS = ['hero', 'strip', 'inline', 'wide'] as const
export type BannerSlot = typeof BANNER_SLOTS[number]

export const BANNER_SLOT_LABELS: Record<BannerSlot, string> = {
  hero: '히어로 (홈 최상단 · 배경 이미지/영상)',
  strip: '상단 띠 (첫 섹션 위 · 가로 카드 1장)',
  inline: '중간 배너 (3열)',
  wide: '와이드 배너 (가로 전체)',
}

/**
 * 📐 자리별 이미지 규격 — **렌더 코드와 어드민 안내가 같이 읽는 SSOT** (2026-08-23).
 *
 * ## 왜 상수로 묶었나 (대표 "이미지 화질이 깨지는 문제")
 * 어드민 화면의 권장 규격 안내가 **손으로 적힌 문장**이라, 2026-08-19 에 히어로가
 * [전면 사진 300px] → [통합형 190px · 우측 54% 미디어] 로 바뀔 때 **안내만 옛날 값으로 남았다.**
 * 실측하니 6줄 중 대부분이 사실과 달랐다:
 *   · "1600 × 500 px 권장"        → 레티나 필요 폭은 **2,074px**. 그대로 올리면 0.77배로 흐리다.
 *   · "최대 500KB 이하"            → 리사이저가 변환하므로 **원본은 커야** 선명하다. 거꾸로 된 조언.
 *   · "여러 개 등록 시 dots 전환"  → `HomeHeroBanner` 는 **첫 번째 하나만** 쓴다(캐러셀 없음).
 *   · "없으면 그라디언트 4종"      → 실제로는 홈 SSR 시드에서 **딜 사진**을 고른다.
 * 안내가 틀리면 사진을 올리는 사람이 헛수고를 한다 — 그리고 그건 코드 리뷰로는 안 걸린다.
 *
 * ⇒ 숫자를 여기 한 곳에 두고 **렌더 코드가 실제로 이 값을 쓰게** 했다. 이제 렌더를 바꾸면
 *   어드민 안내도 같이 바뀐다(문장을 고쳐 주지 않아도 된다).
 *
 * `recommendedWidth` 산출: 리사이저는 **원본보다 크게 늘리지 못한다.** 그래서 화면이 요청하는
 * 최대 폭(히어로는 DPR2 후보 = base×2)보다 원본이 작으면 그만큼 흐려진다 — 여유를 얹은 값이다.
 */
export interface BannerSlotSpec {
  /** 렌더가 리사이저에 요청하는 폭(px). 히어로는 `srcSetBase × 2`(DPR2 후보). */
  requestWidth: number
  /** 히어로 전용 — `cfSrcSet` 의 base 폭. 1x/2x/3x 후보가 여기서 파생된다. */
  srcSetBase?: number
  /** 어드민에 안내할 **원본 최소 폭**(px). 이보다 작으면 확대가 안 돼 흐리다. */
  recommendedWidth: number
  /** 어드민에 안내할 원본 높이(px) — `object-cover` 라 비율이 달라도 잘릴 뿐 깨지지는 않는다. */
  recommendedHeight: number
  /** 실제 화면에서 그려지는 크기(안내 문구에 그대로 노출 — 왜 그 원본이 필요한지 보이게). */
  renderedNote: string
  /** 자리별 주의사항. 사실만 적는다 — 여기 적힌 게 화면에 그대로 나간다. */
  notes: readonly string[]
}

export const BANNER_SLOT_SPECS: Record<BannerSlot, BannerSlotSpec> = {
  hero: {
    srcSetBase: 1024,
    requestWidth: 2048,
    recommendedWidth: 2400,
    recommendedHeight: 800,
    renderedNote: 'PC 1920 기준 1037 × 190 (우측 54% 영역) · 레티나면 그 2배인 2,074px 이 필요',
    notes: [
      '히어로는 **첫 번째 배너 하나만** 쓴다 — 여러 개 올려도 캐러셀이 되지 않는다.',
      '사진을 안 올리면 홈 목록의 딜 사진 한 장을 자동으로 쓴다(그 사진이 작으면 흐릴 수 있다).',
      '모바일(<1024px)에서는 이 사진이 보이지 않는다 — 색면 + 카피만 나간다.',
      '좌우·상하 끝은 색면으로 페이드되므로 **가장자리에 글자·로고를 두지 말 것**.',
    ],
  },
  /**
   * 🎫 2026-09-05 (대표 "인기 이용권 섹션 위에 배너가 작게" → 시안 **안 3 확정**).
   *   첫 섹션 **위** 옆으로 넘기는 스트립. 한 장이면 가로를 꽉 채우고 점을 안 그린다;
   *   두 장부터 화면의 74% 폭 + 다음 장이 살짝 보이고 아래에 점이 붙는다.
   *   ⚠️ 처음엔 안 2(왼쪽 56×56 썸네일 + 흰 카드)로 만들었다가 대표 확정으로 바꿨다 —
   *     그때의 "정사각 400×400" 안내를 되살리지 말 것(이제 배경 전면 사진이다).
   */
  strip: {
    requestWidth: 900,
    recommendedWidth: 1200,
    recommendedHeight: 420,
    renderedNote: '폰 기준 한 장 약 289 × 96 (레티나 3배 = 867px) · 두 장부터 옆으로 넘긴다',
    notes: [
      '글자가 **사진 위에 얹힌다** — 검은 그라디언트(좌 62% → 우 28%)가 자동으로 덮인다.',
      '높이가 96px 로 낮게 잘리므로 **가로로 넓은 구도**가 좋다(위아래가 많이 잘린다).',
      '사진을 안 올리면 브랜드 색면이 대신 들어간다 — 문구만으로도 켤 수 있다.',
      '**최대 5장**까지 옆으로 넘어간다. 저절로 넘어가지는 않는다(자동 재생 없음).',
    ],
  },
  /**
   * 🩸 2026-09-05: `inline`/`wide` 두 규격이 **서로 뒤바뀐 채** 있었다.
   *   `inline`(3열)에 "가로 전체 · 104px · 1600px", `wide`(가로 전체)에 "3열 그리드 · 96px · 800px".
   *   렌더는 이름을 **엇갈려**(inline 렌더가 `SPECS.wide` 를) 참조해 **사진 크기는 맞았고**,
   *   그래서 몇 달간 아무 증상이 없었다 — 대신 **어드민 안내 문구만 반대로** 나갔다.
   *   가로 전체 배너를 올리는 사람은 "800 × 400 권장"을 보고 그대로 올렸고, 실제 필요 폭은
   *   1,600px 이라 그만큼 흐려졌다. 이 상수 파일이 애초에 막으려던 사고가 이 파일 안에서 났다.
   *   ⇒ 몸통을 제자리로 돌리고 렌더도 **같은 이름**을 참조하게 했다(`home-showcase.test.ts` 가 고정).
   */
  inline: {
    requestWidth: 700,
    recommendedWidth: 800,
    recommendedHeight: 400,
    renderedNote: '3열 그리드 · 최소 높이 96px · 어두운 그라디언트가 덮인다',
    notes: ['카드가 작으므로 인물·글자보다 **면·색이 뚜렷한 사진**이 잘 보인다.'],
  },
  wide: {
    requestWidth: 1600,
    recommendedWidth: 1600,
    recommendedHeight: 540,
    renderedNote: '가로 전체 · 최소 높이 104px · 어두운 그라디언트가 덮인다',
    notes: [
      '제목·설명·버튼이 사진 위에 얹히므로 **왼쪽 절반은 단순한 사진**이 좋다.',
      '검은 그라디언트(좌 60% → 우 25%)가 자동으로 덮여 글자 가독성은 확보된다.',
    ],
  },
}

/**
 * 용량 안내 — **작게 만들라는 말이 아니다.** Cloudflare 리사이저가 자리에 맞춰 변환하므로
 * 화질은 원본 크기에서 나오고, 용량은 R2 저장과 첫 변환에만 든다.
 */
export const BANNER_MAX_UPLOAD_MB = 2

/** 어드민이 **새 배너를 만들 때**의 초기 선택. 기존 행에는 절대 소급되지 않는다(컬럼 기본값 아님). */
export const NEW_BANNER_SLOT: BannerSlot = 'inline'

export function isBannerSlot(v: unknown): v is BannerSlot {
  return typeof v === 'string' && (BANNER_SLOTS as readonly string[]).includes(v)
}

/** 자리 파싱 — 모르는 값·빈값·NULL 은 전부 **미지정(null)**. 기본 자리로 승격시키지 않는다. */
export function parseBannerSlot(v: unknown): BannerSlot | null {
  return isBannerSlot(v) ? v : null
}

/**
 * 섹션이 상품을 고르는 방식.
 *
 * - `manual`  — 어드민이 상품을 하나씩 담는다(`section_products`). **기존 동작이고 기본값이다.**
 * - 그 외      — 규칙(쿼리). 어드민이 손대지 않아도 최신 상태를 유지한다.
 *
 * ⚠️ 규칙 기반을 추가한 이유: 시안의 "지금 인기 / 오늘 마감 임박 / 주말에 떠나는 숙소"는
 *   목록이 아니라 **질의**다. 이걸 수동 큐레이션으로 만들면 어드민이 매일 손봐야 하고,
 *   안 손보는 순간 홈 최상단이 낡은 채로 방치된다(그게 이 회사 규모에서 가장 자주 나는 사고다).
 */
// 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): 'deadline' 제거. 라이브 섹션 실측(popular·category 2개)
//   에 쓰이는 곳이 없어 폴백으로 비는 섹션도 생기지 않는다.
export const SECTION_SOURCES = ['manual', 'popular', 'newest', 'category'] as const
export type SectionSource = typeof SECTION_SOURCES[number]

export const SECTION_SOURCE_LABELS: Record<SectionSource, string> = {
  manual: '직접 고름 (상품을 하나씩 담기)',
  popular: '인기순 (결제·리뷰·클릭 종합)',
  newest: '최신 등록순',
  category: '카테고리별 (아래에서 선택)',
}

export const DEFAULT_SECTION_SOURCE: SectionSource = 'manual'

export function isSectionSource(v: unknown): v is SectionSource {
  return typeof v === 'string' && (SECTION_SOURCES as readonly string[]).includes(v)
}
export function normalizeSectionSource(v: unknown): SectionSource {
  return isSectionSource(v) ? v : DEFAULT_SECTION_SOURCE
}

/** 섹션 한 줄에 보여줄 상품 수. 홈 그리드가 4열이라 기본 4. */
export const SECTION_DEFAULT_LIMIT = 4
/** 어드민이 아무리 크게 잡아도 홈 한 줄이 페이로드를 삼키지 않게. */
export const SECTION_MAX_LIMIT = 12

export function clampSectionLimit(v: unknown): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n <= 0) return SECTION_DEFAULT_LIMIT
  return Math.min(SECTION_MAX_LIMIT, n)
}
