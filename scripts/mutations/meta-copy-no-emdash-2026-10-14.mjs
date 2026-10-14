/**
 * 되돌려-검증 주입 — 검색결과에 뜨는 줄에서 **줄표(em-dash)를 뺀다** (2026-10-14).
 *
 * 이 처방은 두 개를 동시에 지킨다. 각각 조용히 무너지는 방향이 다르다:
 *   · **문구** 쪽이 무너지면 → 색인 365건의 스니펫에 줄표가 되살아난다(에러 0 · 화면 무변화).
 *   · **가드 범위** 쪽이 무너지면 → 그 사실을 **아무도 모른다.** 2026-10-14 까지가 그 상태였고
 *     가드는 `em-dash 0` 을 보고하고 있었다("낡은 지도" 클래스).
 *
 * 🔵 그리고 반대 방향이 더 나쁜 자리가 둘 있어 절반을 그쪽으로 심는다:
 *   · 구분자를 **통째로** 지우면 `GS25츄파춥스300` 처럼 붙어 정보가 사라진다.
 *   · 잠금 카운터를 비잠금과 **합치면** 0 고정이 무의미해진다(새 줄표 한 개가 7 사이에 숨는다).
 */
const META = 'src/worker/utils/detail-ssr-meta.ts'
const ROWS = 'src/worker/utils/crawler-noscript-rows.ts'
const STAY = 'src/shared/stay-property-type.ts'
const GUARD = 'scripts/check-anti-slop-copy.mjs'
const BASE = 'scripts/anti-slop-baseline.json'
const T = 'src/tests/unit/meta-copy-no-emdash-2026-10-14.test.ts'

export default [
  {
    name: '✂️ 줄표 — /pass 310건 설명에 되살린다(정가 분기)',
    file: META,
    // 🔁 2026-10-14 재조준: #85 가 설명에 별점·지역·정가·할인율을 더했다(문구가 길어졌을 뿐
    //   불변식은 그대로 — **줄표 0 · 두 분기 모두**). 앵커만 새 문구로 옮긴다.
    find: ': `${ratingPrefix}${regionStr}${storeName} ${priceStr}원, 유어딜에서 할인가로 바로 구매${descTail}`',
    replace: ': `${ratingPrefix}${regionStr}${storeName} — ${priceStr}원, 유어딜에서 할인가로 바로 구매${descTail}`',
    test: T,
    why: '대표가 2026-08-31 에 직접 "AI 티" 로 지적한 문자다. 색인 310건의 검색 스니펫에 그대로 뜬다.',
  },
  {
    name: '✂️ 줄표 — /pass 할인 분기에만 되살린다(두 분기 중 하나만 고치면 되살아나는 자리)',
    file: META,
    // 🔁 2026-10-14 재조준: 할인 분기가 `priceDisplay` 기반으로 바뀌었다(선언값 0 에 묶여
    //   한 번도 돌지 않던 것 수리 — #85). 지키는 것은 같다: 이 분기에도 줄표가 없어야 한다.
    find: '? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인${descTail}`',
    replace: '? `${ratingPrefix}${regionStr}${storeName} — ${priceStr}원${origStr} ${pd.discount}% 할인${descTail}`',
    test: T,
    why: '할인 중인 딜에서만 되살아나므로 정가 상품만 보면 눈에 안 띈다(2026-10-13 가게명 중복에서 같은 자리를 밟았다).',
  },
  {
    name: '✂️ 줄표 — 숙소 문구 표(색인 49건 description 꼬리)에 되살린다',
    file: STAY,
    find: "  hotel: '역과 시내에서 가까워 이동이 편합니다.",
    replace: "  hotel: '역과 시내에서 가까워 이동이 편합니다 — 룸 컨디션이 깔끔합니다.",
    test: T,
    why: '이 표는 정비 레인이 49건의 meta description 꼬리에 쓴다 — 그 파일 머리말이 "가드가 본다" 고 주장하는 바로 그 자리다.',
  },
  {
    name: '🪒 가드 범위 — 워커 문구 생성기 규칙을 뺀다(2026-10-14 이전의 무검사 상태로)',
    file: GUARD,
    find: "  '|src/worker/utils/[A-Za-z0-9-]*(ssr-meta|noscript|first-screen|ssr-body|list-jsonld)\\\\.ts$',",
    replace: '',
    test: T,
    why: '메타 description·title 을 실제로 만드는 곳이 범위에서 빠지면 줄표가 들어와도 가드는 0 을 보고한다.',
  },
  {
    name: '🪒 가드 범위 — 바닥(COPY_BUILDER_FLOOR)을 0 으로(경로가 낡아도 조용히 통과)',
    file: GUARD,
    find: 'const COPY_BUILDER_FLOOR = 8',
    replace: 'const COPY_BUILDER_FLOOR = 0',
    test: T,
    why: '디렉터리가 옮겨지면 0건이 "깨끗하다" 가 아니라 "안 봤다" 인데, 바닥이 없으면 그 둘을 구분할 수 없다.',
  },
  {
    name: '🪒 가드 범위 — EXTRA_COPY 에서 숙소 문구 표를 뺀다',
    file: GUARD,
    find: "  'src/shared/stay-property-type.ts', // 숙소 49건 meta description 의 꼬리 문구",
    replace: '',
    test: T,
    why: '그 파일 머리말이 "가드가 본다" 고 적어 두고 실제로는 안 보던 상태로 되돌아간다 — 거짓 주장이 가장 비싼 종류다.',
  },
  {
    name: '🔵 반대 — 잠금 파일을 **비잠금** 카운터로 흘린다(0 고정이 무의미해진다)',
    file: GUARD,
    find: "      if (ln.includes('—') && LOCKED_COPY.test(posix)) hits.lockedEmDash.push(`${rel}:${n}`)\n      else if (ln.includes('—') && MARKETING.test(posix)) hits.emDash.push(`${rel}:${n}`)",
    replace: "      if (ln.includes('—') && (MARKETING.test(posix) || LOCKED_COPY.test(posix))) hits.emDash.push(`${rel}:${n}`)",
    test: T,
    why: '둘을 합치면 상한이 7 이 되고, 랜딩에 새로 생긴 줄표 한 개가 그 사이에 숨는다(이 가드가 401건을 두고 배운 실패 모드).',
  },
  {
    name: '🔵 반대 — 비잠금 상한을 7 로 올린다(새 줄표를 미리 허용한다)',
    file: BASE,
    find: '"emDash": 0,',
    replace: '"emDash": 7,',
    test: T,
    why: '래칫은 스스로 헐거워지는 것을 못 막는다 — 기준을 올리면 조용히 통과한다(2026-09-29 에 값을 치르고 배운 것).',
  },
  {
    name: '🔵 반대 — 목록 행의 구분자를 **통째로** 지운다(GS25츄파춥스300 — 정보 손실)',
    file: ROWS,
    find: "return { text: `${parts.filter(Boolean).join(', ')}${price}`",
    replace: "return { text: `${parts.filter(Boolean).join('')}${price}`",
    test: T,
    why: '줄표를 없애려다 경계를 통째로 지우면 가게명과 상품명이 붙는다 — 줄표보다 나쁘다(크롤러도 사람도 못 가른다).',
  },
]
