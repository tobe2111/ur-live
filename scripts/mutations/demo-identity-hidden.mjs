/**
 * 🙈 데모인 것을 티내지 않는다 (2026-10-12, 대표 *"데모인 것을 티내지마"*) — 주입 매니페스트.
 * 가드: src/tests/unit/demo-identity-hidden-2026-10-12.test.ts
 *
 * 티는 **네 겹**이었다: 응답의 `slug`(= `demo-deal-NNN`) · `fcfs.demo` · `is_demo` · 데모만 다른 버튼 라벨.
 * 그리고 반대 방향이 더 조용하다 — 티를 지우려다 서버의 데모-후순위 정렬(대표 2026-07-04)이나
 * 상위노출 제외 판정까지 함께 지우면 데모 48건이 피드 맨 앞을 다시 점유하는데 **에러가 안 난다.**
 * 아래 주입은 양쪽을 하나씩 되돌려 가드가 정말 빨간불을 내는지 확인한다.
 */
const TEST = 'src/tests/unit/demo-identity-hidden-2026-10-12.test.ts'
const SSOT = 'src/shared/constants/demo-products.ts'
const LIST = 'src/features/group-buy/api/group-buy-public.routes.ts'
const FCFS = 'src/features/group-buy/api/fcfs.routes.ts'
const COLS = 'src/shared/db/product-columns.ts'
const BOX = 'src/pages/group-buy/DealPurchaseBox.tsx'
const BAR = 'src/pages/group-buy/DealBottomBar.tsx'
const MAP = 'src/pages/RestaurantMapPage.tsx'
const FEEDCACHE = 'src/worker/cron/group-buy-feed-cache.ts'

export default [
  {
    name: '🙈 지우는 함수가 slug 를 그대로 흘려보낸다',
    file: SSOT,
    find: '    const { slug: _slug, is_demo: _isDemo, ...rest } = row as T & { slug?: unknown; is_demo?: unknown }',
    replace: '    const rest = row as T & { slug?: unknown; is_demo?: unknown }',
    test: TEST,
    why: '`slug` 는 사실상 데모 전용 식별자다(실상품은 NULL) — 한 줄만 무르면 서버 HTML 에 `demo-deal-NNN` 이 48회 돌아온다.',
  },
  {
    name: '🙈 지우는 함수가 fcfs.demo 를 그대로 남긴다',
    file: SSOT,
    find: "      return { ...rest, fcfs: { ...fcfsRest, ...(demo ? { boost: false } : {}) } } as unknown as T",
    replace: "      return { ...rest, fcfs: { ...fcfsRest, demo } } as unknown as T",
    test: TEST,
    why: '`"demo": true` 가 행마다 실리면 플래그 하나로 데모 48건이 특정된다.',
  },
  {
    name: '🙈 상위노출 제외 신호가 이름만 바뀌는 게 아니라 통째로 사라진다',
    file: SSOT,
    find: "...(demo ? { boost: false } : {})",
    replace: "...({})",
    test: TEST,
    why: '티는 사라지지만 클라 boost 가 데모를 끌어올려 대표 2026-07-04 "데모 항상 후순위" 가 깨진다 — 조용한 쪽이 더 나쁘다.',
  },
  {
    name: '🙈 지우는 함수가 입력 배열을 파괴한다',
    file: SSOT,
    find: '  return rows.map((row) => {',
    replace: '  return rows.map((row) => {\n    delete (row as { slug?: unknown }).slug',
    test: TEST,
    why: '서버가 그 뒤에 slug 로 판정할 수도 있다 — 입력을 파괴하면 호출 순서에 따라 정렬이 조용히 달라진다.',
  },
  {
    name: '🙈 리스트 응답이 감싸지 않은 배열을 내보낸다 (계산만 하고 안 쓴다)',
    file: LIST,
    find: 'data: toPublicProductRows(withOnnuri)',
    replace: 'data: withOnnuri',
    test: TEST,
    why: '함수가 있는 것과 응답이 그걸 지나는 것은 다른 자리다 — 홈·지도 SSR 시드가 그 한 줄을 함께 지난다.',
  },
  {
    name: '🙈 선착순 목록 응답만 감싸는 것을 빠뜨린다',
    file: FCFS,
    find: 'data: toPublicProductRows(out)',
    replace: 'data: out',
    test: TEST,
    why: '`is_demo` alias 가 정렬용으로만 있어야 하는데 응답에 섞여 나간다 — 한 표면만 빠뜨리기 쉽다.',
  },
  {
    name: '🙈 상세 응답에 slug 가 되살아난다',
    file: COLS,
    find: "  'created_at', 'updated_at',",
    replace: "  'slug',\n  'created_at', 'updated_at',",
    test: TEST,
    why: '`/pass/2914` 서버 HTML 에 `demo-deal-307` 이 다시 박힌다 — 2026-08-08 에 라벨 분기 때문에 넣었던 그 필드다.',
  },
  {
    name: '🙈 목록 SQL 에서 slug 를 빼 서버 판정을 죽인다',
    file: LIST,
    find: '          p.restaurant_name, p.restaurant_address, p.slug,',
    replace: '          p.restaurant_name, p.restaurant_address,',
    test: TEST,
    why: '티를 지우는 가장 순진한 방법이고, 그 순간 서버의 데모-후순위 정렬과 fcfs 판정이 전부 false 가 된다.',
  },
  {
    name: '🙈 구매 박스에 데모 전용 라벨이 되살아난다',
    file: BOX,
    find: "  const ctaLabel = '구매하기'",
    replace: "  const ctaLabel = (arguments as unknown as { isDemo?: boolean }).isDemo ? '결제하기' : '구매하기'",
    test: TEST,
    why: '라벨만 보고 데모를 판별할 수 있었다 — 홈 시드 50건 중 48건이 데모다.',
  },
  {
    name: '🙈 하단 바에 데모 전용 불가 문구가 되살아난다',
    file: BAR,
    find: "  const verb = '구매하기'",
    replace: "  const verb = '구매하기'\n  const _demoLabel = '결제 불가'",
    test: TEST,
    why: '`결제 불가` ↔ `구매 불가` 가 갈리면 품절 상태만 보고도 데모를 안다.',
  },
  {
    name: '🙈 지도가 다시 데모 플래그를 읽는다',
    file: MAP,
    find: 'boost: p.fcfs.boost !== false',
    replace: 'boost: !(p.fcfs as { demo?: boolean }).demo',
    test: TEST,
    why: '중립 이름으로 바꾼 의미가 사라진다 — 클라가 그 필드를 읽으면 서버도 다시 내보내게 된다.',
  },
  {
    name: '🙈 상위노출 순위를 계산만 하고 정렬에 안 쓴다',
    file: MAP,
    find: '    return [...filtered].sort((a, b) => boostRank(b.id) - boostRank(a.id))',
    replace: '    return [...filtered]',
    test: TEST,
    why: '계산과 사용은 다른 자리다(2026-10-12 `goneStatus` 에서 같은 함정을 밟았다) — 값은 멀쩡히 남고 정책만 죽는다.',
  },
  {
    name: '🙈 서버 데모-후순위 정렬이 사라진다 (반대 방향)',
    file: LIST,
    find: 'const orderBy = `${DEMO_LAST}, ${baseOrder}`',
    replace: 'const orderBy = `${baseOrder}`',
    test: TEST,
    why: '티는 사라지는데 데모 48건이 피드 맨 앞을 점유한다 — 대표 2026-07-04 지시가 에러 없이 깨진다.',
  },
  {
    name: '🙈 materialized cron 의 데모-후순위 정렬이 사라진다',
    file: FEEDCACHE,
    find: "ORDER BY (CASE WHEN COALESCE(p.slug,'') LIKE 'demo-%' THEN 1 ELSE 0 END), p.created_at DESC",
    replace: 'ORDER BY p.created_at DESC',
    test: TEST,
    why: 'cron 저장본과 라이브 쿼리가 갈리면 캐시 hit 여부에 따라 순서가 달라진다.',
  },
  {
    name: '🙈 상세가 다시 데모를 판정한다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '  const isJoinable = ',
    replace: "  const isDemoDeal = isDemoSlug(null)\n  const isJoinable = ",
    test: TEST,
    why: '이 화면이 데모 여부를 알면 라벨 분기가 되살아나고 응답에서 slug 를 뺄 수 없게 된다.',
  },
]
