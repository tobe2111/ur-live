/**
 * 🗺️ 지역 요약 캐시 (2026-10-12, 대표 "내 판단이 필요한 3가지 모두 가장 이상적으로") — 주입 매니페스트.
 * 가드: src/tests/unit/region-digest-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/region-digest-2026-10-12.test.ts'

export default [
  {
    name: '🗺️ 지역 요약을 주입(React initialData)에까지 쓴다 — 깎은 행이 카드를 깨뜨린다',
    file: 'src/worker/index.ts',
    // 🔀 2026-10-12 재조준: #21(thin 지역 noindex)이 요약 **원본**을 따로 들고 있어야 해서
    //   `digestRaw` 변수가 생겼다. 불변식(요약이 주입으로 새지 않는다)은 한 글자도 안 바뀌었다.
    find: "const crawlerPayload = digestRaw || ssrPayload;",
    replace: "const crawlerPayload = digestRaw || ssrPayload; ssrPayload = crawlerPayload;",
    test: TEST,
    why: '요약 행은 필드를 깎았다. 주입으로 새면 홈·지역 카드가 깨지는데 빌드도 화면 테스트도 안 깨진다 — ⑥이 그 방향을 본다.',
  },
  {
    name: '🗺️ 크롤러 본문이 다시 1페이지 시드를 본다 — 경기 본문이 0자로 돌아간다',
    file: 'src/worker/index.ts',
    find: 'buildStaticSurfaceNoscript(url.pathname, crawlerPayload)',
    replace: 'buildStaticSurfaceNoscript(url.pathname, ssrPayload)',
    test: TEST,
    why: '이 한 인자가 결함의 전부였다 — 홈 1페이지 시드엔 색인 대상 11시/도 중 5곳만 들어 있다.',
  },
  {
    name: '🗺️ ItemList 가 다시 1페이지 시드를 본다',
    file: 'src/worker/index.ts',
    find: 'buildSurfaceListJsonLd(url.pathname, url.search, origin2, sm, crawlerPayload)',
    replace: 'buildSurfaceListJsonLd(url.pathname, url.search, origin2, sm, ssrPayload)',
    test: TEST,
    why: '본문과 ItemList 는 짝이다 — 한쪽만 고치면 "본문엔 있는데 구조화 데이터엔 없는" 모순이 된다.',
  },
  {
    name: '🗺️ 요약에 `slug` 가 되살아난다 — 데모 티 제거(#1712) 무효화',
    file: 'src/shared/seo/region-digest.ts',
    find: "  'image_url', 'avg_rating', 'review_count',",
    replace: "  'image_url', 'avg_rating', 'review_count', 'slug',",
    test: TEST,
    why: '공개 응답에서 지운 필드를 요약이 다시 담으면 그 작업이 조용히 무효가 된다(에러 0).',
  },
  {
    name: '🗺️ 묶음 키가 시/도만 본다 — 시군구 32개 색인 페이지가 다시 빈다',
    file: 'src/shared/seo/region-digest.ts',
    find: "const bucket = `${ref.sido}\\u0000${ref.sigungu || ''}`",
    replace: "const bucket = `${ref.sido}`",
    test: TEST,
    why: '시/도만 묶으면 서울 10건이 전부 중구가 되어 종로·마포 같은 시군구 페이지가 그대로 0건이다.',
  },
  {
    name: '🗺️ 숙소 묶음이 사라진다 — `/stays` 가 지역 상한에 밀려 빈다',
    file: 'src/shared/seo/region-digest.ts',
    find: 'if (isStay && stays < REGION_DIGEST_PER_BUCKET) {',
    replace: 'if (false) {',
    test: TEST,
    why: '숙소는 주소도 있어 지역 묶음 상한에 걸린다 — 전용 묶음이 없으면 `/stays` 항목이 줄어든다.',
  },
  {
    name: '🗺️ 교환권이 지역 묶음에 섞인다 — 매장 없는 행이 동네 목록에 뜬다',
    file: 'src/shared/seo/region-digest.ts',
    find: "if (Number(row?.deal_only) === 1) continue",
    replace: "if (false) continue",
    test: TEST,
    why: '교환권 상세는 noindex 다 — 지역 묶음 자리를 먹으면 실제 매장 딜이 그만큼 밀려난다.',
  },
  {
    name: '🗺️ 네 페이지가 전부 실패한 날 빈 요약으로 덮는다',
    file: 'src/worker/cron/cache-prewarm.ts',
    find: 'if (rows.length > 0) {',
    replace: 'if (true) {',
    test: TEST,
    why: '빈 요약을 쓰면 "있던 본문이 사라진" 상태가 2시간 유지된다 — 기존 요약을 들고 만료되는 편이 낫다.',
  },
  {
    name: '🗺️ 요약 재빌드가 동적 워밍과 같은 위상으로 — 서브리퀘스트 예산이 겹친다',
    file: 'src/worker/scheduled.ts',
    find: 'regionDigest: slotOpen({ minute: 15 })',
    replace: 'regionDigest: slotOpen({ minute: 0 })',
    test: TEST,
    why: '`:00` 은 동적 워밍 12개가 도는 회차다 — 거기에 4 fetch 를 더하면 무료 상한 50 에 더 바싹 붙는다.',
  },
  {
    name: '🗺️ cron 이 홈 시드 상수를 안 쓰고 경로를 손으로 적는다',
    file: 'src/worker/cron/cache-prewarm.ts',
    find: '`${baseUrl}${MAIN_SEED_PATH}&limit=100&page=${page}`',
    replace: "`${baseUrl}/api/group-buy/products?status=active&category=all&limit=100&page=${page}`",
    test: TEST,
    why: '두 자리에 같은 문자열을 적으면 한쪽을 고치는 날 요약이 홈과 **다른 모집단**을 담는다(에러 0).',
  },
  {
    name: '🗺️ TTL 이 재빌드 주기보다 짧아진다 — 매시 빈 구간이 생긴다',
    file: 'src/shared/seo/region-digest.ts',
    find: 'export const REGION_DIGEST_TTL_S = 7200',
    replace: 'export const REGION_DIGEST_TTL_S = 1800',
    test: TEST,
    why: '하루 24번 빌드에 30분 TTL 이면 매시 30분간 지역 페이지가 종전(본문 0자)으로 되돌아간다.',
  },
  {
    name: '🗺️ 판정이 다른 표면까지 삼킨다 — 홈·교환권이 요약으로 그려진다',
    file: 'src/shared/seo/region-digest.ts',
    find: "return pathname === '/stays' || REGION_PATH_RE.test(pathname)",
    replace: "return true",
    test: TEST,
    why: '요약은 지역·숙소용 모집단이다 — 홈이 그걸 쓰면 상위 10 노출 순서가 요약 순서로 바뀐다.',
  },
]
