#!/usr/bin/env node
/**
 * 🧬 **가드가 실제로 실패할 수 있는지 기계가 확인한다** (되돌려-검증 자동화).
 *
 * ## 왜 (2026-08-01~02 하루에 **세 번** 났다)
 * 이 레포의 반복 사고는 "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 이다.
 * 배포는 초록불이고 아무도 모른다. 같은 날 내가 만든 가드 세 개가 전부 그랬다:
 *
 * 1. `배열을 reverse 해도 같은가` — 15개 배열의 reverse 는 인덱스 i→14−i 라 **홀짝이 보존**돼
 *    2조 분할에 영향이 0 이었다. 정렬을 통째로 지워도 초록불.
 * 2. `phase 이름이 바뀌면 조가 흔들린다` — `maintenance?…` 의 이웃이 `?` 앞에서 이미 갈려
 *    실제로는 안 일어나는 일이었다. 쿼리 제거를 무력화해도 초록불.
 * 3. `한 회차가 예산을 넘지 않는다` — 픽스처에 **일 1회 레인이 하나도 없어** `always` 가 늘
 *    빈 배열이었다. 라이브에선 예산 8 에 12개가 떠서 3개가 잘리고 있었는데도 초록불.
 *
 * 셋 다 **손으로 주입해 보고서야** 알았다. 손으로 하면 다음 세션은 안 한다.
 *
 * ## 무엇을 하는가
 * 아래 `MUTATIONS` 의 각 항목에 대해: 소스에 알려진 결함을 심고 → 지정 테스트를 돌리고 →
 * **빨간불이 안 뜨면 실패**시킨다. 그리고 원본을 복원한다.
 *
 * 두 가지를 동시에 잡는다:
 *   ① **헛도는 가드** — 결함을 심었는데 테스트가 통과 = 그 가드는 아무것도 안 지키고 있다.
 *   ② **낡은 지도** — `find` 문자열이 소스에 없음 = 코드가 옮겨갔는데 이 검증만 남았다.
 *      (이 레포가 잠금표에서 겪은 바로 그 클래스. 조용히 통과시키지 않고 **실패**로 다룬다.)
 *
 * ## ⚠️ 안전
 * 소스를 **실제로 수정**하므로 반드시 복원한다: try/finally + 프로세스 시그널 훅 + 종료 시 재확인.
 * 원본은 메모리에 담고, 어떤 경로로 끝나도 되돌린다. (그래도 중단됐다면 `git diff` 로 확인할 것.)
 *
 * ## 새 가드를 만들면 여기에 한 줄 추가하라
 * 이게 이 레포의 "깨뜨려서 확인" 규율의 **기계 버전**이다. 항목이 없는 가드는 다음 세션에
 * 조용히 헛돌 수 있다.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
/**
 * 🔍 `--only <부분문자열>` — 한 건만 돌린다(이름 부분일치).
 * 전수는 45회 vitest 라 ~1.5분이고, 주입 하나를 손보는 동안 그걸 매번 기다리면 결국 **확인을
 * 건너뛰게 된다** — 이 레포가 반복해서 당한 자리다. CI 는 인자 없이 전수로 돈다.
 */
const ONLY = (() => {
  const i = process.argv.indexOf('--only')
  return i !== -1 ? process.argv[i + 1] : null
})()

/**
 * 🧹 `--verify-clean` — **아무것도 주입하지 않고**, 작업트리에 주입 잔재가 남아 있는지만 본다(수초).
 *
 * 왜 별도 모드인가: 이 스크립트는 끝에서 복원을 확인하지만 그건 **끝까지 갔을 때** 얘기다.
 * 전수는 100건 넘는 vitest 라 오래 걸려서 중간에 끊기기 쉽고(타임아웃·Ctrl-C·`kill -9`),
 * 그러면 마지막에 주입된 파일이 **그대로 남는다**. 2026-08-03 실측: 끊긴 harness 가
 * `lane-aimd.ts`·`lane-cadence.ts`·`influencer-auto-collect.ts` 3개를 바꿔 놓은 채였고,
 * 그중 하나는 **같은 날 다른 세션이 고친 커서 버그를 되살리는** 내용이었다 — `git add -A` 로
 * 하마터면 그대로 커밋될 뻔했다.
 *
 * ⇒ **harness 를 중간에 끊었으면 커밋 전에 이걸 돌려라.** `git diff` 로 눈으로 보는 것보다 확실하다
 *   (주입 한 줄은 정상 코드와 구분이 안 간다).
 */
const VERIFY_CLEAN = process.argv.includes('--verify-clean')

/**
 * @typedef {{name:string, file:string, find:string, replace:string, test:string, why:string}} Mutation
 * `find` 는 소스에 **정확히 한 번** 나타나는 문자열이어야 한다(여러 번이면 첫 번째만 바뀌어
 * 의도한 결함이 아닐 수 있다 — 그래서 개수도 검사한다).
 */
/** @type {Mutation[]} */
const MUTATIONS = [
  {
    name: '🏠 웹문서 레인에 홀짝 시각 게이트가 붙는다(회차 절반 소멸)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "      if (env.ADS_WEBKR_LANE_DISABLED === 'true') return { skipped: 'gate_off' }",
    replace: "      if (new Date().getUTCHours() % 2 !== 1) return { skipped: 'even_hour' }",
    test: 'src/tests/unit/ads-webkr-lane.test.ts',
    why:
      '이 레인이 존재하는 이유가 "회차를 못 받아 굶는다" 다(실측 keywords:3 · deadline_hit:true). ' +
      '홀짝 게이트를 달면 하루 24회가 12회로 반토막 나는데 화면·로그 어디에도 티가 안 난다 — ' +
      '수집량이 줄 뿐이고 그건 외부 요인으로 오인되기 쉽다(이번 세션이 실제로 그 오진을 반복했다).',
  },
  {
    name: '🏠 웹문서 레인 커서가 계획분만큼 전진한다(그 자리는 영영 안 돌아온다)',
    file: 'src/features/marketing/api/webkr-collect.ts',
    find: 'const nextCursor = total > 0 ? (cursor + used.length) % total : 0',
    replace: 'const nextCursor = total > 0 ? (cursor + batchSize) % total : 0',
    test: 'src/tests/unit/ads-webkr-lane.test.ts',
    why:
      'company-collect 가 2026-08-02 에 실제로 당한 사고의 복제다 — 예산·마감으로 못 돈 키워드를 ' +
      '건너뛰면 전진폭이 창 크기와 같아져 회전 경계가 고정되고 **같은 자리가 매 바퀴 빠진다**. ' +
      '지연이 아니라 영구 사각지대이고, 집계상으로는 "그 키워드는 결과가 없었나 보다"로 읽힌다.',
  },
  {
    name: '🏠 웹문서 레인이 collect-company 커서를 같이 쓴다',
    file: 'src/features/marketing/api/webkr-collect.ts',
    find: "const STATS_KEY = 'ads_webkr_stats'",
    replace: "const STATS_KEY = 'ads_company_stats'",
    test: 'src/tests/unit/ads-webkr-lane.test.ts',
    why:
      '두 레인이 한 커서를 나눠 쓰면 서로의 진행분을 건너뛴다(각자 자기가 전진시킨 만큼만 알고 있다). ' +
      '게다가 스냅샷을 서로 덮어써 상태줄이 어느 레인 것인지 알 수 없게 된다 — 관측이 먼저 죽는다.',
  },
  {
    name: '🏠 웹문서 레인이 키워드 부기를 건건이 쓴다(예산을 부기에 태운다)',
    file: 'src/features/marketing/api/webkr-collect.ts',
    find: '    await DB.batch(stmts).catch(() => null)',
    replace: '    for (const st of stmts) await st.run().catch(() => null)',
    test: 'src/tests/unit/ads-webkr-lane.test.ts',
    why:
      '무료 플랜은 인보케이션당 서브리퀘스트 50이라 키워드 12개면 부기만 12(예산의 24%)다. ' +
      'enrich 레인이 2026-07-28 에 정확히 이걸로 굶었다 — 크롤에 쓸 예산을 도장 찍는 데 썼다.',
  },
  {
    name: '이용권 상세 제목이 다시 사진 아래로 내려간다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '<DetailTitleHeader name',
    replace: '<span data-broken name',
    test: 'src/tests/unit/groupon-detail-map.test.ts',
    why:
      '2026-08-19 대표 확정(상세 1안 "그루폰 정석"). 제목·별점·주소가 사진 위에 있어야 첫 화면이 ' +
      '"무엇을 파는지 / 얼마나 좋은지"를 말한다. 되돌아가도 화면은 멀쩡해 보여서(사진은 여전히 크다) ' +
      '리뷰로는 안 걸린다 — 그래서 기계가 지킨다.',
  },
  {
    name: '상세가 서버 raw 할인율로 되돌아간다(카드와 숫자가 갈린다)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: 'discountPct={displayDiscountPct}',
    replace: 'discountPct={detail.current_discount_pct}',
    test: 'src/tests/unit/groupon-detail-map.test.ts',
    why:
      '실측(2026-08-19, id 2846 정가 32,000→23,800): 홈 카드는 -26%, 상세는 할인 표시 없음이었다. ' +
      '가격 표시가 화면마다 다르면 UI 불일치가 아니라 **신뢰 문제**다. 되돌리면 조용히 다시 갈린다.',
  },
  {
    name: '/map 지도 위 컨트롤 오버레이가 PC 에서 되살아난다',
    file: 'src/pages/restaurant-map/MapTopBar.tsx',
    find: "'lg:hidden absolute top-0",
    replace: "'absolute top-0",
    test: 'src/tests/unit/groupon-detail-map.test.ts',
    why:
      '2026-08-19 대표 지시 — 검색·필터 칩을 왼쪽 리스트 상단으로 옮기고 지도는 지도만 보이게. ' +
      '오버레이가 되살아나면 좌측 패널과 **같은 컨트롤이 두 벌**이 되고 지도 상단이 다시 가려진다.',
  },
  {
    name: '죽은 사진을 그대로 보여 준다(카드가 빈 칸으로 남는다)',
    file: 'src/components/deal/DealCardMedia.tsx',
    find: 'const shown = dead.has(idx) ? (alive[0] ?? idx) : idx',
    replace: 'const shown = idx',
    test: 'src/tests/unit/deal-card-gallery.test.ts',
    why:
      '2026-08-19 라이브에 실제로 있었다 — 커버가 403 인데 갤러리 4장은 멀쩡한 상품(보드람치킨 id 2822). ' +
      '`cfImageOnError` 는 [리사이저 → 원본 → 숨김] 까지만 하므로 **에러도 안 나고 화면만 빈다.** ' +
      '대표가 "사진이 안 뜬다"고 말해 주기 전엔 아무도 모르는 종류라, 지워져도 조용히 되돌아간다.',
  },
  {
    name: '히어로 사진이 리사이저를 건너뛴다(첫 화면에 원본 1MB)',
    file: 'src/components/home/HomeHeroDefault.tsx',
    // 2026-08-19: 히어로가 어드민 지정 사진을 받게 되면서 변수명이 `photo.src` → `photoSrc` 로 바뀌었다.
    //   (`find` 가 소스에 없으면 이 검증은 **낡은 지도**로 판정돼 RED 가 뜬다 — 실제로 그렇게 잡혔다.)
    find: 'cfImage(photoSrc',
    replace: 'String(photoSrc',
    test: 'src/tests/unit/home-showcase.test.ts',
    why:
      '히어로는 화면 맨 위라 사진이 곧 첫인상이자 첫 바이트다. 2026-08-19 실측에서 카카오 CDN 원본이 ' +
      '**957KB** 였다 — 리사이저를 거치면 53KB 다. 원본 직결은 화면이 똑같이 보여서 리뷰로는 안 걸리고, ' +
      '느려진 것만 남는다(대표 신고 "사진 불러오는게 많이 느리네?" 가 정확히 그 증상이었다).',
  },
  {
    name: '히어로가 데모 상품 사진을 홈 얼굴로 쓴다',
    file: 'src/components/home/HomeHeroDefault.tsx',
    find: "slug.startsWith('demo-deal-')",
    replace: 'false',
    test: 'src/tests/unit/home-showcase.test.ts',
    why:
      '홈 최상단 사진은 서비스의 얼굴이다. 데모 시드가 그 자리에 올라와도 **에러가 없고 그림도 멀쩡**해서 ' +
      '아무도 모른다. 2026-08-04 에는 여기 계열의 데모 사진에 타사 워터마크 보도사진이 섞여 있었다.',
  },
  {
    name: '카드 캐러셀 화살표에서 preventDefault 를 없앤다(사진 넘기려던 클릭이 상세로 튄다)',
    file: 'src/components/deal/DealCardMedia.tsx',
    find: 'e.preventDefault()',
    replace: 'void 0',
    test: 'src/tests/unit/deal-card-gallery.test.ts',
    why:
      '카드 캐러셀은 `<Link>` **안**에 있다 — 화살표가 기본동작을 막지 않으면 사진을 넘기려는 클릭이 ' +
      '매번 상세 페이지로 튄다. 에러가 없고 화면도 멀쩡해서 **직접 눌러 보기 전엔 아무도 모르는** 종류다. ' +
      '2026-08-19 그루폰 카드 도입과 함께 들어온 안전장치라, 나중에 리팩토링하다 지워질 위험이 크다.',
  },
  {
    name: '카드가 갤러리를 전부 미리 로드한다(첫 화면 트래픽 몇 배)',
    file: 'src/components/deal/DealCardMedia.tsx',
    find: 'if (!seen.has(i)) return null',
    replace: 'if (false) return null',
    test: 'src/tests/unit/deal-card-gallery.test.ts',
    why:
      '홈 한 화면에 카드가 50개다. 캐러셀 장면을 전부 `<img>` 로 만들면 **첫 화면 이미지 요청이 4배**가 된다 — ' +
      '이 레포가 로딩 최적화 잠금으로 지켜 온 값을 한 줄로 되돌리는 셈이다. 사용자가 실제로 넘긴 장면만 ' +
      '받는다는 규칙이라, 안 지켜져도 **화면은 똑같아 보여서** 리뷰로는 안 걸린다.',
  },
  {
    name: '공구가 킬스위치를 어드민 화면에서 뺀다(돈 새는 중에 멈출 손잡이가 사라진다)',
    file: 'src/pages/AdminPlatformSettingsPage.tsx',
    find: "key: 'gb_pricing_enabled'",
    replace: "key: 'gb_pricing_REMOVED'",
    test: 'src/tests/unit/ops-gate-reachable.test.ts',
    why:
      '게이트를 만들어 놓고 **켜고 끌 화면을 안 만드는** 사고가 2026-08-03·08-12 에 세 번 났다. ' +
      '가장 나빴던 것이 `gb_pricing_enabled` — *"잘못된 공구가로 과소청구가 날 때 false 로 내려 즉시 상시가로 ' +
      '되돌린다"* 는 **긴급 킬스위치인데 당길 손잡이가 어느 화면에도 없었다**(돈이 새는 중에 멈출 방법 0). ' +
      '⚠️ 게이트가 OFF 인 것을 "안 켰다"로 읽으면 안 된다 — **"못 켰다"** 일 수 있고, 그 상태는 ' +
      '에러가 없어 아무도 모른다. 의도적으로 안 켤 게이트는 turn_on_when 에 "켜지 않는다"로 면제된다.',
  },
  {
    name: '내부 링크 가드에서 객체 리터럴 `to:` 패턴을 없앤다(칩·탭 링크가 다시 무검사)',
    file: 'scripts/check-internal-links.mjs',
    find: '\\bto:\\s*',
    replace: '\\bto_DISABLED:\\s*',
    test: 'src/tests/unit/internal-links-target-patterns.test.ts',
    why:
      '`check-internal-links` 는 "죽은 링크 0" 이라고 초록을 띄우지만 그 0 은 **정규식이 본 것 안에서의 0** 이다. ' +
      '2026-08-12 실측: JSX 속성 `to=` 만 보고 **객체 리터럴 `to: "/x"` 를 안 봤다** — 링크를 배열로 선언하고 ' +
      '`.map()` 으로 렌더하는 흔한 패턴(NotFoundPage 의 "인기 페이지 둘러보기", 각종 칩·탭 목록)이 통째로 ' +
      '사각지대였고, 패턴 한 줄을 지우면 검사 타깃이 **904 → 868** 로 준다(무검사 36건). ' +
      '⚠️ 이 패턴이 조용히 사라져도 가드는 계속 초록이라 **사람이 알아챌 신호가 전혀 없다** — 그래서 주입으로 고정한다.',
  },
  {
    name: '공정위 연도 파라미터를 `yr` 로 되돌린다(코드 11 로 다시 0건)',
    file: 'src/features/marketing/api/franchise-collect.ts',
    find: "export const FRANCHISE_YR_PARAM = 'jngBizCrtraYr'",
    replace: "export const FRANCHISE_YR_PARAM = 'yr'",
    test: 'src/tests/unit/ads-public-api-params.test.ts',
    why:
      '이 레인이 몇 달간 0건이던 진짜 원인이 **이 이름 하나**였다(포털 요청변수는 `jngBizCrtraYr`). ' +
      '2026-08-11 에 나는 자가치유가 2025·2026·2024 를 다 시도하고도 실패한 것을 보고 *"연도 가설 기각"* ' +
      '이라고 적었는데 **반만 맞았다** — 값이 아니라 **키**가 틀렸으니 어떤 값도 코드 11 이었다. ' +
      '⚠️ 이 환경은 `apis.data.go.kr` 프록시 차단이라 되돌아가도 **개발 중엔 아무 증상이 없다**(라이브에서만 0건).',
  },
  {
    name: '기업마당 주소를 옛 값으로 되돌린다(코드 12 로 다시 0건)',
    file: 'src/features/marketing/api/notice-scan.ts',
    find: "const BIZINFO_BASE = 'https://apis.data.go.kr/1421000/bizinfo'",
    replace: "const BIZINFO_BASE = 'https://apis.data.go.kr/1421000/hpsBnaSituService'",
    test: 'src/tests/unit/ads-public-api-params.test.ts',
    why:
      '옛 값은 주소·오퍼레이션이 **둘 다** 틀렸고, 게이트웨이는 그걸 코드 12 하나로만 답한다 — ' +
      '*주소 부재*와 *오퍼레이션 오타*가 구분되지 않아 몇 달간 원인을 못 좁혔다. ' +
      '대표가 공유한 포털 화면(2026-08-12)으로 확정된 값이라 **추측으로 되돌아가면 안 된다.**',
  },
  {
    name: '회차 퍼널을 UTC 로 묶는다(한국 기준 하루가 두 날로 갈린다)',
    file: 'src/features/marketing/api/influencer-collect-funnel.ts',
    find: 'export const kstDay = (ms: number): string => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10)',
    replace: 'export const kstDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)',
    test: 'src/tests/unit/ads-collect-funnel.test.ts',
    why:
      '워커 런타임은 UTC 다. UTC 로 자르면 **한국 기준 하루가 두 날에 갈려** 일별 비교가 통째로 무의미해진다 — ' +
      '이 시계열의 존재 이유가 "어제와 오늘이 왜 다른가"인데 그 축이 어긋난다. ' +
      '이 레포가 반복해 틀린 자리라(CLAUDE.md 시각 규칙 · `check-utc-date-parse`) 경계값으로 못 박았다.',
  },
  {
    name: '회차 퍼널이 이전 값을 안 이어받는다(매 회차 리셋 — 시계열이 안 쌓인다)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    funnel: appendCollectFunnel(prev?.funnel, {',
    replace: '    funnel: appendCollectFunnel(undefined, {',
    test: 'src/tests/unit/ads-collect-funnel.test.ts',
    why:
      '`prev?.funnel` 을 안 넘기면 매 회차 빈 시계열로 시작해 **하루치 한 줄만 남는다** — 화면엔 값이 보이니 ' +
      '고장으로 안 읽히고, 다음 세션은 또 "기록이 없다"로 시작한다(2026-08-11 조사가 오래 걸린 이유가 정확히 그것). ' +
      '⚠️ 첫 초안의 주입은 `...(false ? {` 로 감싸는 것이었는데 **원본 문자열이 그대로 남아** 배선 검사가 계속 초록이었다 — ' +
      '되돌려-검증도 틀릴 수 있다는 걸 또 확인했다.',
  },
  {
    name: '나라장터 업체 레인이 코드 12 밖에서도 후보 오퍼레이션을 돌린다(예산 낭비)',
    file: 'src/features/marketing/api/nara-vendor-collect.ts',
    find: "    if (i === 0 && !r.items.length && r.code === '12' && !envOp) {",
    replace: '    if (i === 0 && !r.items.length && !envOp) {',
    test: 'src/tests/unit/ads-nara-vendor.test.ts',
    why:
      '코드 12(주소 부재)는 **오퍼레이션 오타와 구분되지 않아** 후보를 한 번 더 쏘는 게 맞다. 그런데 조건을 ' +
      '넓혀 키·트래픽·파라미터 오류에도 순회하면 **같은 실패를 N배로 반복**해 인보케이션당 50뿐인 ' +
      '서브리퀘스트를 잘 도는 레인에서 빼앗는다(공정위 레인에서 실제로 겪었다). ' +
      '⚠️ 이 레인은 바로 그 코드 12 를 "주소가 폐기됐다"로 오독해 2026-08-04 에 **통째로 삭제됐던** 것이다.',
  },
  {
    name: '나라장터 업체 레인에 회차 마감선이 없다(커서 전진 0 으로 같은 페이지 무한 반복)',
    file: 'src/features/marketing/api/nara-vendor-collect.ts',
    find: "    if (Date.now() >= runDeadline) { stoppedBy = 'deadline'; break }",
    replace: '    // (제거)',
    test: 'src/tests/unit/ads-nara-vendor.test.ts',
    why:
      '커서 저장이 루프 **뒤**에 있으므로, 마감선이 없으면 인보케이션 한도에 맞아 죽을 때 저장에 도달하지 ' +
      '못하고 다음 회차가 **같은 페이지를 또 훑는다(전진 0)**. 에러가 안 뜨니 "느린가 보다"로 읽힌다 — ' +
      'commerce(08-02)·quality(08-03)가 정확히 그렇게 조용히 멈췄고, **지워진 옛 버전의 이 레인에는 ' +
      '이 마감선이 없었다**(그래서 되살리면서 넣었다).',
  },
  {
    name: '레인 주기가 cron 과 알람에서 갈린다(증설이 조용히 발효 안 된다)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "      if (new Date().getUTCHours() % 4 !== 1) return { skipped: 'off_hour' }",
    replace: "      if (new Date().getUTCHours() !== 21) return { skipped: 'off_hour' }",
    test: 'src/tests/unit/ads-lane-cadence-parity.test.ts',
    why:
      '2026-08-10 에 대표 지시로 공고 스캔을 일 1회 → 4시간마다로 올렸는데, cron 게이트만 고쳤고 그 게이트는 ' +
      '`!laneAlarmDrivesEnrich(env)` 뒤에 있다(**라이브는 알람이 몬다**). 등록부는 `!== 21` 그대로라 ' +
      '**증설이 배포는 됐는데 한 번도 발효되지 않았다**(`ads_notice_stats`: last_run 21:00 · total_runs 11). ' +
      '에러도 경보도 없다 — 이 레포의 "실패가 아니라 조용한 부재" 클래스이고, 이번엔 대표가 요청한 기능 자체가 그렇게 사라졌다.',
  },
  {
    name: '상호 판정이 앰퍼샌드까지 잡는다(진짜 상호가 제목으로 오인된다)',
    file: 'src/features/marketing/api/company-classify.ts',
    find: "  if (/&(?:gt|lt|quot);|[|｜＞>《》＜<]/.test(n)) return true",
    replace: '  if (/&[a-z]{2,6};|[|｜＞>《》＜<]/.test(n)) return true',
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '초안이 정확히 이 넓은 형태였고 **라이브에서 진짜 상호 14건을 오탐**했다 — `SM C&C 성수`(대형 ' +
      '광고대행사) · `S&K세무회계컨설팅` · `H&L 컴퍼니` · `한결 A&C`. `&amp;` 는 그냥 `&` 이고 ' +
      '앰퍼샌드는 상호에 흔하다. 여기서 오탐이 나면 **멀쩡한 업체가 이름을 사이트 이름으로 덮어쓰인다.** ' +
      '좁힌 규칙(breadcrumb 구분자)은 52→29건이 되고 그 29건은 전부 진짜 제목 파편이었다.',
  },
  {
    name: '엔티티 디코딩에서 앰퍼샌드를 먼저 푼다(이중 디코딩)',
    file: 'src/features/marketing/api/company-lead-hygiene.ts',
    find: "  return s\n    .replace(/&lt;/g, '<')",
    replace: "  return s\n    .replace(/&amp;/g, '&')\n    .replace(/&lt;/g, '<')",
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '앰퍼샌드 디코딩을 **맨 앞으로** 옮긴다. 그러면 `&amp;lt;` 가 `&lt;` → `<` 로 **이중 디코딩**돼 ' +
      '원문에 없던 글자가 생긴다(이름이 조용히 변조된다). 유닛이 그 값을 직접 고정한다.\n' +
      '🩸 초안은 *주석만 지우는* 변형이었다 — 동작이 안 바뀌니 테스트가 통과했고 하네스가 ' +
      '"이 가드는 아무것도 안 지킨다"로 잡아 냈다. **주입은 반드시 동작을 바꿔야 한다.**',
  },
  {
    name: '변화율이 tier COALESCE 를 변화로 센다(등록부 이탈률이 부풀어 좁히기가 부당해 보인다)',
    file: 'src/features/marketing/api/reclassify-verdict-delta.ts',
    // ⚠️ 2026-08-17 병합 사고 흔적 — main 통합을 **유니온**으로 풀다가 이 객체에 `find`/`replace` 가
    //   **두 벌**이 됐다(HEAD 의 `written.tier` + main 의 옛 `after.tier`). JS 는 뒤엣것이 이기므로
    //   낡은 쪽이 실제 값이 되어 CI 가 "낡은 지도"로 잡았다 — **충돌 마커도 없고 파싱도 되는** 형태라
    //   더 위험하다. 유니온 해소는 *목록*엔 안전해도 **객체 리터럴 안**에선 이렇게 조용히 깨진다.
    find: '      || (before.tier == null && written.tier != null)',
    replace: '      || before.tier !== written.tier',
    test: 'src/tests/unit/reclassify-verdict-delta.test.ts',
    why:
      'UPDATE 가 `COALESCE(tier, ?)` 라 **옛 tier 가 있으면 안 바뀐다.** 그걸 변화로 세면 tier 가 이미 ' +
      '박힌 행이 전부 "판정이 달라졌다"로 잡혀 **변화율이 부풀고**, 그러면 "등록부도 규칙에 반응한다" 는 ' +
      '거짓 결론이 나와 **랩 좁히기(38일→2일)가 부당해 보인다.** 계측은 결론을 뒤집는 숫자다.',
  },
  {
    name: '최소 간격을 다시 시각의 짝수성으로(유실 회차가 영구 손실)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: '    minIntervalHours: 2,\n    run: async (env) => {\n      if ((env as unknown as { ADS_COMMERCE_ENABLED?: string }).ADS_COMMERCE_ENABLED !== \'true\') return { skipped: \'gate_off\' }',
    replace: '    run: async (env) => {\n      if ((env as unknown as { ADS_COMMERCE_ENABLED?: string }).ADS_COMMERCE_ENABLED !== \'true\') return { skipped: \'gate_off\' }\n      if (new Date().getUTCHours() % 2 !== 0) return { skipped: \'odd_hour\' }',
    test: 'src/tests/unit/lane-min-interval.test.ts',
    why:
      '알람은 가끔 안 깨어난다. 짝수성 판정이면 부트의 재무장이 **홀수시에 착지해 그냥 skip** 되고 ' +
      '그 회차(~990건)가 영영 사라진다 — 자가치유가 돌았는데 아무것도 못 건진다. 실측(5일·짝수시 12칸): ' +
      '각 칸이 3~5일만 채워져 **무작위로 1/4 유실**, commerce 기준 하루 ~2,300건. 경과 시간 판정이면 ' +
      '다음 시간이 이어받는다(그때는 2시간이 지났으므로).',
  },
  {
    name: 'skip 회차에도 lastRunAt 을 찍는다(간격이 영원히 안 차 레인이 멎는다)',
    file: 'src/worker-ads/lane-alarm.ts',
    // 🔄 2026-08-18: 조건에 `(!entry || entry.ok)` 가 붙어 앵커를 갱신했다(실패 회차도 슬롯을 안 먹는다).
    //   이 주입이 지키는 것은 그대로 **"skip 은 안 찍는다"** 이므로 `due` 를 지우는 형태를 유지한다.
    find: '    if (runs < cap && due && (!entry || entry.ok || !retryable)) put.lastRunAt = t0',
    replace: '    put.lastRunAt = t0',
    test: 'src/tests/unit/lane-min-interval.test.ts',
    why:
      'skip 에도 시각을 찍으면 매 회차 기준점이 갱신돼 **경과가 영원히 N시간에 못 닿는다** — 간격 게이트가 ' +
      '스스로를 잠가 그 레인이 통째로 멎는다. 에러도 경보도 없이 조용히 0 이 되는 클래스라 특히 위험하다.',
  },
  {
    name: '에폭 은퇴를 승격 차단에 넣는다(자가치유가 막혀 30일 영구 배제)',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '  `NOT ((${AUTO_RETIRE_WHERE.f30}) OR (${AUTO_RETIRE_WHERE.barren}) OR (${AUTO_RETIRE_WHERE.yield}))`',
    replace: '  `NOT ((${AUTO_RETIRE_WHERE.f30}) OR (${AUTO_RETIRE_WHERE.barren}) OR (${AUTO_RETIRE_WHERE.yield}) OR (${AUTO_RETIRE_WHERE.epoch}))`',
    test: 'src/tests/unit/influencer-keyword-epoch.test.ts',
    why:
      '평생 카운터 셋은 재승격 시 조건이 그대로 참이라 차단이 필요하지만, **에폭은 승격 시 리셋**되므로 ' +
      'livelock 이 성립하지 않는다. 여기 넣으면 한 번 마른 키워드가 증거 유통기한(30일)까지 **영구 배제**된다 — ' +
      '대표가 2026-08-09 에 명시로 거부한 바로 그것이다. 겉보기엔 "더 안전해 보이는" 변경이라 더 위험하다.',
  },
  {
    name: '승격이 에폭을 리셋하지 않는다(재승격자가 즉시 재은퇴 — livelock)',
    file: 'src/features/marketing/api/influencer-keyword-promote.ts',
    find: "SET active = 1, activated_at = datetime('now'), epoch_runs = 0, epoch_saved = 0 WHERE id = ?",
    replace: "SET active = 1, activated_at = datetime('now') WHERE id = ?",
    test: 'src/tests/unit/influencer-keyword-epoch.test.ts',
    why:
      '에폭을 안 지우면 재승격자는 **은퇴시킨 그 에폭 그대로** 살아나 다음 회차에 즉시 다시 은퇴된다. ' +
      '한 번도 안 돌고 승격 슬롯만 태우는 순환 — 2026-08-09 에 평생 카운터로 겪은 livelock 과 같은 모양이다. ' +
      '리셋이 곧 "재도전은 백지에서" 이고, 그게 이 은퇴를 자가치유로 만드는 유일한 장치다.',
  },
  {
    name: '에폭 은퇴가 retired_at 을 안 찍는다(쿨다운이 무력 — churn 복귀)',
    file: 'src/features/marketing/api/influencer-keyword-store.ts',
    find: "UPDATE ad_discovery_keywords SET active = 0, retired_at = datetime('now') WHERE id IN",
    replace: 'UPDATE ad_discovery_keywords SET active = 0 WHERE id IN',
    test: 'src/tests/unit/influencer-keyword-epoch.test.ts',
    why:
      '`retired_at` 이 NULL 이면 쿨다운 조건이 항상 참이라 **갓 은퇴한 키워드가 다음 회차에 바로 재승격**된다. ' +
      '`hits DESC` 정렬이 옛 활성 키워드를 대기 큐 앞에 세우므로, 그 키워드는 8회 시험을 무한 반복하며 ' +
      '슬롯을 태운다 — 대기 11,720개가 밖에 있는 채로.',
  },
  {
    name: '🌱 신규 키워드 우선 자리를 뺀다(새 키워드가 72일을 기다린다)',
    file: 'src/features/marketing/api/company-keyword-pick.ts',
    find: '  const freshLimit = Math.max(0, Math.min(batchSize, FRESH_KEYWORD_SLOTS))',
    replace: '  const freshLimit = 0',
    test: 'src/tests/unit/company-fresh-keyword-slots.test.ts',
    why:
      '실측: 활성 4,555 중 **미실행 3,279** · 커서 시간당 1.9칸 → 끝까지 72일. tier 우선 정렬만으로는 ' +
      '부족하다(새 키워드는 같은 tier 안에서 id 가 뒤라 맨 끝에 선다). 대표가 요청한 체험단 9개가 ' +
      '전부 그 줄 끝에 `last_run_at IS NULL` 로 있었다.',
  },
  {
    name: '우선 픽을 정렬(ORDER BY)로 구현한다(OFFSET 창에 건너뜀·중복)',
    file: 'src/features/marketing/api/company-keyword-pick.ts',
    find: "  const seen = new Set(kws.map(k => k.id))",
    replace: '  const seen = new Set()',
    test: 'src/tests/unit/company-fresh-keyword-slots.test.ts',
    why:
      '`last_run_at IS NULL` 을 ORDER BY 에 넣으면 키워드가 돌 때마다 순서가 바뀌어 OFFSET 창에 ' +
      '건너뜀·중복이 생긴다(이 블록의 원래 주석이 경고하는 바로 그것). 그래서 **앞에 끼워 넣고** ' +
      'id 중복만 제거한다 — dedup 이 빠지면 같은 키워드를 한 회차에 두 번 호출한다.',
  },
  {
    name: '🗄️ 감시가 이사 전 DB를 본다(바인딩 후 감시가 가장 먼저 눈이 먼다)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: 'maybeAlertInflow(env, adsLeadsDb(env as never) as never)',
    replace: 'maybeAlertInflow(env, env.DB)',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '`ad_influencer_leads`·`ad_company_leads` 는 `ADS_DB` 로 이사한다. `env.DB` 를 넘기면 대표가 ' +
      '바인딩을 붙이는 순간 "테이블이 없다"로 조용히 깨지고, 하필 **감시가 가장 먼저** 눈이 먼다 — ' +
      '그러면 다음 하락도 아무도 모른다.',
  },
  {
    name: '🩺 소진 레인을 실패로 싣는다(매일 "완료"를 경보로 보낸다)',
    file: 'src/features/marketing/api/lane-health-report.ts',
    find: '    .filter(h => h.runs > 0 && h.fails / h.runs >= REPORT_FAIL_RATIO)',
    replace: '    .filter(h => h.runs > 0 && (h.barren || h.fails / h.runs >= REPORT_FAIL_RATIO))',
    test: 'src/tests/unit/lane-health-report.test.ts',
    why:
      '소진(성공하는데 수확 0)은 손해가 아니라 **완료**다 — 매일 경보로 보내면 채널이 곧 무시당하고, ' +
      '그러면 정작 실패가 났을 때도 안 보인다. 소진은 `isBarren` 감속이 조용히 처리한다.',
  },
  {
    name: '레인 상태를 경보 없이도 붙인다(정상인 날에도 소음)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: "        if (bad.length) lines.push('', '**레인 상태**', ...bad)",
    replace: "        lines.push('', '**레인 상태**', ...bad)",
    test: 'src/tests/unit/lane-health-report.test.ts',
    why:
      '실패한 레인이 없으면 한 줄도 안 늘어나야 한다. 빈 헤더만 매번 붙으면 경보가 길어지고, ' +
      '길어진 경보는 안 읽힌다 — 오경보와 같은 클래스의 실패다.',
  },
  {
    name: '📈 보강이 실패 중인 레인도 올린다(실패가 3배가 된다)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '      const accept = runs > 0 && laneCanAbsorb(hist)',
    replace: '      const accept = runs > 0',
    test: 'src/tests/unit/lane-boost.test.ts',
    why:
      '보강은 외부 API 를 더 두드리는 일이다. 이미 실패 중인 레인을 3배로 돌리면 얻는 것 없이 ' +
      '실패만 3배가 되고, 상대 쪽에서 보면 장애 중에 요청이 3배로 늘어난다.',
  },
  {
    name: '보강에 기한이 없다(켜진 채 잊혀 영구 증설이 된다)',
    file: 'src/worker-ads/lane-boost.ts',
    find: '  if (Number(b.until) <= now) return 0',
    replace: '  // 기한 무시',
    test: 'src/tests/unit/lane-boost.test.ts',
    why:
      '기한이 없으면 감시가 멎어도 보강이 남는다 — 사람이 모르는 채 외부 호출이 3배로 유지된다. ' +
      '이 레포가 반복해 온 "켜 놓고 잊는" 클래스이고, 유효기간이 그 클래스를 구조적으로 막는다.',
  },
  {
    name: '회복해도 보강을 안 걷는다(한 번 오르면 영구)',
    file: 'src/worker-ads/lane-boost-apply.ts',
    find: 'runs=${runs > 1 ? runs : 0}',
    replace: 'runs=${runs}',
    test: 'src/tests/unit/lane-boost.test.ts',
    why:
      '올리기만 하고 안 내리면 제어 루프가 아니라 일회성 증설이다. 회복 시 0 을 보내는 것이 ' +
      '이 호출의 절반이다(조이기·감속과 같은 대칭).',
  },
  {
    name: '🔒 인플루언서 collect 를 보강 대상에 넣는다(대표 확인 사항을 자동화가 넘본다)',
    file: 'src/worker-ads/lane-boost.ts',
    find: "  company: ['collect-company'],",
    replace: "  company: ['collect-company'], influencer: ['collect'],",
    test: 'src/tests/unit/lane-boost.test.ts',
    why:
      '그 레인의 `runsPerHour: 1` 은 **직접 크롤 차단 리스크** 때문에 정해진 값이고, CLAUDE.md 가 ' +
      '"올리려면 대표 확인" 이라고 명시했다. 공식 API 쿼터 문제인 collect-company 와 성격이 다르다 — ' +
      '자동 루프가 넘볼 자리가 아니다.',
  },
  {
    name: '🩸 재시도 상한을 failStreak(예외 전용)으로 센다 — 정작 필요할 때 안 걸린다',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'failStreakFromHistory(runHistory) <= RETRY_MAX_FAIL_STREAK',
    replace: 'nextFail <= RETRY_MAX_FAIL_STREAK',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      '2026-08-19 라이브: commerce 가 4회 연속 실패한 직후인데 `fail_streak: 0` 이었다 — 그 카운터는 ' +
      '**예외를 던진 회차만** 세는데 실제 장애는 예외 없이 `diag.error` 로만 온다. ' +
      'failStreak 에 상한을 걸면 그 상한이 **정작 필요한 경우에 한 번도 안 걸린다.**',
  },
  {
    name: '🌵 마른 레인 감속을 뺀다(0건에 CPU·서브리퀘스트를 계속 쓴다)',
    file: 'src/worker-ads/lane-adaptive-interval.ts',
    find: '  if (isBarren(history)) return base * BARREN_INTERVAL_MULT',
    replace: '  if (false) return base * BARREN_INTERVAL_MULT',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      '실측: storeinfo 가 1,700/일 → 0 으로 소진됐는데도 2시간마다 계속 돈다. 얻는 건 0인데 ' +
      '희소 자원(서브리퀘스트·CPU)을 써서 **실제로 캐는 레인의 예산을 갉는다.**',
  },
  {
    name: '실패를 마름으로 센다(장애 때 주기를 늘려 회복을 늦춘다)',
    file: 'src/worker-ads/lane-adaptive-interval.ts',
    find: '  const ran = history.filter(r => r && r.ok && typeof r.n === \'number\')',
    replace: "  const ran = history.filter(r => r && typeof r.n === 'number')",
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      '실패(고장)와 소진은 처방이 정반대다 — 고장은 재시도, 소진은 감속. 섞으면 외부 API 가 잠깐 ' +
      '죽었을 때 주기를 3배로 늘려 **복구를 스스로 늦춘다.**',
  },
  {
    name: '🎯 발송 가능 축을 감시에서 뺀다(총량만 보면 지표가 안 보인다)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: "    axes.push({ key: 'sendable_influencer', label: '발송가능(인플루언서)', v: sendable.sendable_influencer || null })",
    replace: '',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      'CLAUDE.md 가 못 박은 유일한 성공 지표는 "제안 보낼 수 있는 리드 수"다. 총량은 늘어도 ' +
      '수율 낮은 축만 늘면 발송 가능 리드는 제자리다(실측: youtube 38.3% vs commerce 13.2%).',
  },
  {
    name: '누계 감소를 하락으로 센다(반송 억제 청소 때마다 경보)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: '    out.push({ d: days[i], n: Math.max(0, cur - prev) })',
    replace: '    out.push({ d: days[i], n: cur - prev })',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '반송 억제(`ad_email_suppress`)로 이메일이 비워지면 누계가 줄 수 있다. 그건 "발굴이 멈췄다"가 ' +
      '아니라 "정리했다"이고, 하락으로 세면 청소할 때마다 경보가 떠 채널이 무시당한다.',
  },
  {
    name: '⚡ 벌크 전진이 첫 분류 행까지 건너뛴다(영영 미분류로 남는다)',
    file: 'src/features/marketing/api/reclassify-registry-fastpath.ts',
    find: "  + ` AND category IS NOT NULL AND COALESCE(classified_v, 0) < ? AND id > ?`",
    replace: "  + ` AND COALESCE(classified_v, 0) < ? AND id > ?`",
    test: 'src/tests/unit/reclassify-registry-fastpath.test.ts',
    why:
      '`classify_confidence = \'registry\'` 와 `category IS NOT NULL` 이 이 최적화의 안전핀이다 — ' +
      '건너뛰는 것이 *재판정*이지 *첫 판정*이 아님을 보장한다. 빠지면 한 번도 분류 안 된 행에 ' +
      '도장만 찍혀 영영 분류되지 않는다(에러 없는 부재).',
  },
  {
    name: '표본이 바뀌어도 벌크를 강행한다(규칙 변경이 등록부에 안 닿는다)',
    file: 'src/features/marketing/api/reclassify-registry-fastpath.ts',
    find: "  if (regChanged > 0) return { allow: false, reason: `등록부 판정이 바뀌는 중(${regChanged}/${regSeen}) — 전수 재판정 유지` }",
    replace: '  // 표본 무시',
    test: 'src/tests/unit/reclassify-registry-fastpath.test.ts',
    why:
      '"등록부는 안 바뀐다"를 상수로 믿으면, 앞으로 규칙이 등록부를 흔드는 순간 그 변경이 조용히 ' +
      '반영되지 않는다. 매 회차 표본이 그 판단 근거를 새로 만드는 것이 이 설계의 핵심이다.',
  },
  {
    name: '벌크 UPDATE 실패에도 커서를 옮긴다(그 구간이 영영 미분류)',
    file: 'src/features/marketing/api/reclassify-registry-fastpath.ts',
    find: '  if (done) { return { cursor: Number(span.m), reason: `${d.reason} · ${span.n}행` } }',
    replace: '  { return { cursor: Number(span.m), reason: `${d.reason} · ${span.n}행` } }',
    test: 'src/tests/unit/reclassify-registry-fastpath.test.ts',
    why:
      '커서만 넘어가고 도장은 안 찍히면 그 5,000행은 다음 랩(며칠 뒤)까지 미분류로 남는다. ' +
      '실패를 성공처럼 취급하는 것이 이 레포가 반복해 온 사고 모양이다.',
  },
  {
    name: '🐕 유입 감시에서 B2B 축을 뺀다(−70% 가 또 6일간 안 잡힌다)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: "  { key: 'company', label: '업체(B2B)', table: 'ad_company_leads',",
    replace: "  { key: 'company_disabled', label: '업체(B2B)', table: 'ad_influencer_leads',",
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '기존 경보는 인플루언서 전용이었고, 정작 −70% 로 무너진 건 B2B 였다(13,409 → 4,223, 6일간 무음). ' +
      'B2B 축이 빠지면 이 모듈의 존재 이유가 사라진다.',
  },
  {
    name: '날짜 구멍을 0 으로 안 채운다(완전 정지가 "정상"으로 읽힌다)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: '    out.push({ d, n: by.get(d) ?? 0 })',
    replace: '    if (by.has(d)) out.push({ d, n: by.get(d) ?? 0 })',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '수집이 0이면 GROUP BY 결과에 그 날짜가 **아예 안 나온다**. 구멍을 안 채우면 최근 3일이 ' +
      '예전 잘 되던 날들로 채워져 완전 정지가 "정상"이 된다 — 에러 없이 조용히 틀리는 그 클래스다.',
  },
  {
    name: '오늘(진행 중인 날)을 판정에 넣는다(매일 아침 오경보)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: '  for (let i = span; i >= 1; i--) {',
    replace: '  for (let i = span; i >= 0; i--) {',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '진행 중인 날은 항상 낮다. 넣으면 매일 아침 "하락" 경보가 뜨고, 그 채널은 곧 무시당한다 — ' +
      '오경보는 감시의 고장이지 부작용이 아니다.',
  },
  {
    name: '먼 기준선을 뺀다(완만한 하락이 창 비교를 빠져나간다)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: '  const baseline = Math.max(near ?? 0, far ?? 0) || null',
    replace: '  const baseline = near',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '천천히 내려가면 **기준선도 같이 내려간다** — 어제와 비교하면 어제도 나쁘다. 실측 인플루언서 ' +
      '하락이 직전 7일 기준으로는 76%(무경보)였다. 먼 기준선이 그 사각지대를 닫는다.',
  },
  {
    name: '기준선을 평균으로 바꾼다(17배 스파이크 하나가 이후를 전부 하락으로 만든다)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: '  const s = [...xs].sort((a, b) => a - b)',
    replace: '  return xs.reduce((a, b) => a + b, 0) / xs.length; const s = [...xs].sort((a, b) => a - b)',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '이 시스템의 일별 진폭은 17배다(07-21 12,533 vs 07-30 1건). 평균 기준선이면 스파이크 하나가 ' +
      '기준선을 들어 올려 그 뒤 정상 구간이 전부 "하락"으로 보인다.',
  },
  {
    name: '무너진 동안 매일 경보를 보낸다(채널이 곧 무시당한다)',
    file: 'src/features/marketing/api/inflow-watchdog.ts',
    find: '        if (!escalated) continue',
    replace: '        if (false) continue',
    test: 'src/tests/unit/inflow-watchdog.test.ts',
    why:
      '같은 사실을 매일 반복해 보내면 사람은 그 채널을 끈다. 그러면 **다음에 진짜로 다른 것이 ' +
      '무너졌을 때도** 안 보인다 — 감시가 스스로를 무력화하는 경로다.',
  },
  {
    name: '실패 재시도에 상한이 없다(영구 장애 소스를 하루 24번 두드린다)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '    const retryable = failStreakFromHistory(runHistory) <= RETRY_MAX_FAIL_STREAK',
    replace: '    const retryable = true',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      '`nextWakeAt` 은 회차를 쓴 뒤엔 다음 정시로 잡으므로 failStreak 백오프가 이 경로엔 안 걸린다. ' +
      '상한이 없으면 죽은 소스를 영원히 하루 24번 두드린다 — 서브리퀘스트는 이 시스템의 희소 자원이다.',
  },
  {
    name: '🔁 주기 자가조율을 고정 상수로 되돌린다(잘 돌아도 확대가 없다)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'adaptiveIntervalHours(lane.minIntervalHours ?? 0, prevHistory)',
    replace: 'lane.minIntervalHours ?? 0',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      'B2B 수집은 회차당 수확(~990)이 CPU 가드에 막혀 못 올리고, 남은 손잡이는 주기뿐이다. ' +
      '고정 상수로 되돌리면 소스가 98% 신규를 주고 있어도 하루 12회에 영원히 갇힌다.',
  },
  {
    name: '실패한 회차가 슬롯을 먹는다(다음 간격까지 통째로 버려진다)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'if (runs < cap && due && (!entry || entry.ok || !retryable)) put.lastRunAt = t0',
    replace: 'if (runs < cap && due) put.lastRunAt = t0',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      '2026-08-18 00:00 회차가 외부 API 네트워크 오류로 0건이었는데 스탬프가 찍혀 01:00 이 통째로 ' +
      '유휴가 됐고 02:00 에야 982건을 받았다. 실패한 회차에 자리를 내주면 그 슬롯(≈1,000건)은 영영 못 찾는다.',
  },
  {
    name: '조인 간격을 ceil 대신 floor 로 계산한다(외부 호출이 3배까지 튄다)',
    file: 'src/worker-ads/lane-adaptive-interval.ts',
    find: 'Math.max(MIN_INTERVAL_HOURS, Math.ceil(base / 2))',
    replace: 'Math.max(MIN_INTERVAL_HOURS, Math.floor(base / 2))',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      'base 3 이 floor 로 1 이 되면 하루 8회 → 24회로 **3배**다. 공공 API 일일 한도를 모르는 상태에서 ' +
      '두 배는 감수하기로 한 위험이고 세 배는 아니다. 지금 모든 레인이 base 2 라 겉으론 같아 보이는 것이 함정이다.',
  },
  {
    name: '신규율 게이트를 뺀다(마른 소스를 두 배로 두드린다)',
    file: 'src/worker-ads/lane-adaptive-interval.ts',
    find: '  if (nov == null || nov < TIGHTEN_MIN_NOVELTY) return base',
    replace: '  if (false) return base',
    test: 'src/tests/unit/lane-adaptive-interval.test.ts',
    why:
      '소진된 레인(storeinfo 실측: found 50 · saved 0)은 오류가 없어 무사고로 보인다. 신규율 게이트가 ' +
      '없으면 그런 레인까지 조여져 **중복만 두 배**로 긁는다 — 얻는 것 없이 외부 호출만 늘어난다.',
  },
  {
    name: '🚰 대기 큐 배수를 뺀다(자리가 열려도 이번 회차 태그만 들어간다)',
    file: 'src/features/marketing/api/influencer-keyword-promote.ts',
    find: "      ORDER BY hits DESC LIMIT ?`)\n      .bind(AUTO_PROMOTE_HITS, Math.min(QUEUE_SCAN_MAX, left * QUEUE_OVERFETCH))",
    replace: "      ORDER BY hits DESC LIMIT 0`)\n      .bind(AUTO_PROMOTE_HITS, Math.min(QUEUE_SCAN_MAX, left * QUEUE_OVERFETCH))",
    test: 'src/tests/unit/ads-promote-queue-drain.test.ts',
    why:
      '이걸 빼면 승격 후보가 다시 `keyword IN (이번 회차 해시태그)` 로 묶인다 — 대기 11,720개는 ' +
      '같은 태그가 우연히 재채굴될 때만 뽑히는 **큐 아닌 큐**로 돌아간다. 2026-08-18 실측에서 ' +
      '39.8건/회차짜리 협찬·체험단 후보 34개가 그 상태로 놀고 있었다(기존 활성 평균 16.4).',
  },
  {
    name: '빈 회차에 조기 반환한다(자리가 비어 있어도 큐를 안 본다)',
    file: 'src/features/marketing/api/influencer-keyword-promote.ts',
    find: '  if (topTags.length) await DB.batch(topTags.map',
    replace: '  if (!topTags.length) return { promoted }\n  if (topTags.length) await DB.batch(topTags.map',
    test: 'src/tests/unit/ads-promote-queue-drain.test.ts',
    why:
      '대기 큐 배수는 **이번 회차가 무엇을 채굴했는지와 무관해야** 한다. 조기 반환이 있으면 ' +
      '태그를 못 캔 회차엔 자리가 남아도 아무도 안 들어간다 — 그게 "큐"가 아니게 되는 지점이다.',
  },
  {
    name: '🎞️ 회차 이력을 안 남긴다(유실↔실패를 다시 못 가른다)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: "          put.bind(`${LANE_RUNS_KEY}:${this.lane}`, serializeRunHistory(runHistory)),",
    replace: '',
    test: 'src/tests/unit/lane-run-history.test.ts',
    why:
      '2026-08-17 에 매장/업체 수집의 빈 칸을 "알람 유실"로 단정했다가, 다음 날 실측에서 ' +
      '**레인은 돌았고 외부 API 가 네트워크 오류**였음이 드러났다. 마지막 1건만 남기면 나머지 칸이 ' +
      '유실인지 실패인지 구조적으로 알 수 없다 — 이 줄이 그 구분을 만든다.',
  },
  {
    name: 'skip 회차도 이력에 쌓는다(12칸이 skip 으로 차서 돈 회차가 밀려난다)',
    file: 'src/worker-ads/lane-run-history.ts',
    find: "  if (!error && s && typeof s.skipped === 'string') return null",
    replace: '  // skip 도 남긴다',
    test: 'src/tests/unit/lane-run-history.test.ts',
    why:
      '간격 게이트에 걸린 회차는 매시간 발생한다. 그것까지 남기면 12칸이 skip 으로 가득 차서 ' +
      '정작 보려던 "실제로 돈 회차"가 밀려난다 — 이력이 스스로를 지운다.',
  },
  {
    name: 'diag.error 만 있는 실패를 성공으로 센다(조용한 0건이 정상으로 보인다)',
    file: 'src/worker-ads/lane-run-history.ts',
    find: '  const e = error || softErr',
    replace: '  const e = error',
    test: 'src/tests/unit/lane-run-history.test.ts',
    why:
      '라이브 실측의 실패는 예외가 아니었다 — 34.9초 정상 종료 + found 0 + `diag.error` 였다. ' +
      '예외만 실패로 세면 그 회차는 "성공인데 0건"으로 남아, 다시 원인을 못 찾는다.',
  },
  {
    name: '스탬프를 다시 잘라 쓴다(라이브에서 JSON 이 실제로 깨졌던 그 코드)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '          }, stats ? JSON.parse(JSON.stringify(stats)) : null)),',
    replace: '            stats: stats ? JSON.parse(JSON.stringify(stats)) : null,\n          }).slice(0, 2000)),',
    test: 'src/tests/unit/lane-run-history.test.ts',
    why:
      '2026-08-18 실측: `collect`·`scan-notices` 스탬프가 **정확히 2000자**로 잘려 파싱 불가였다. ' +
      '`collect` 는 인플루언서 발굴 본체라 그 값을 읽는 쪽이 전부 조용히 실패하고 있었다. ' +
      '자르는 대신 가장 큰 조각(stats)을 통째로 빼야 한다.',
  },
  {
    name: '🩸 변화율이 기록값 대신 classifyLead 날것을 본다(라이브에서 실제로 난 오계상)',
    file: 'src/features/marketing/api/company-discovery.ts',
    find: "      lead_type: registry && c.lead_type === 'unknown' && !suspect ? 'partner' : c.lead_type,",
    replace: '      lead_type: c.lead_type,',
    test: 'src/tests/unit/reclassify-verdict-delta.test.ts',
    why:
      '**2026-08-17 라이브에서 실제로 난 사고다.** 호출부는 `classifyLead` 결과를 그대로 안 쓴다 — ' +
      '등록부는 `unknown → partner` 로 매핑해서 쓴다. 그 매핑을 빼고 날것으로 비교하면 등록부 행 ' +
      '대부분(원래 partner · 기록값도 partner)이 **"바뀜"으로 오계상**돼 실측이 `reg 8,333/8,500 = 98%` ' +
      '라는 거짓값을 냈다. 그 숫자로 판단했으면 **랩 좁히기(38일→2일)를 근거 없이 포기**했을 것이다.\n' +
      '⚠️ 이 주입은 동작도 바꾼다(등록부에 unknown 이 기록된다) — 계측 버그가 곧 데이터 버그였다는 뜻.',
  },
  {
    name: '오염된 옛 세대 누계를 그대로 이어받는다(비율이 두 세대의 혼합이 된다)',
    file: 'src/features/marketing/api/reclassify-verdict-delta.ts',
    find: '  const p = Number(raw.v) === VERDICT_DELTA_VERSION ? raw : {}',
    replace: '  const p = raw',
    test: 'src/tests/unit/reclassify-verdict-delta.test.ts',
    why:
      '비교 규칙이 바뀌면 옛 값과 새 값은 **다른 것을 센 숫자**다. 더하면 어느 쪽도 아닌 비율이 되고, ' +
      'v1 이 쌓은 8,333/8,500(98%) 위에 새 값이 얹히면 **한참 동안 거짓 결론이 유지된다** — 새 표본이 ' +
      '옛 누계를 넘어서야 겨우 씻긴다.',
  },
  {
    name: '변화율 분모에 첫 분류를 넣는다(새 행이 전부 "바뀜"으로 잡힌다)',
    file: 'src/features/marketing/api/reclassify-verdict-delta.ts',
    find: '  if (!(Number(classifiedV) > 0)) { d.first++; return }',
    replace: '  if (false) { d.first++; return }',
    test: 'src/tests/unit/reclassify-verdict-delta.test.ts',
    why:
      '처음 분류되는 행은 이전 판정이 없어 **무조건 "달라졌다"** 로 잡힌다. 그걸 분모에 넣으면 ' +
      '변화율이 유입량에 끌려다녀 **규칙 변화와 무관한 숫자**가 된다 — 재려던 것을 못 재게 된다.',
  },
  {
    name: '변화율을 회차마다 덮어쓴다(표본이 250건에 갇혀 누적이 무의미)',
    file: 'src/features/marketing/api/reclassify-verdict-delta.ts',
    find: '    delta: mergeDelta(prevDelta, s.delta),',
    replace: '    delta: s.delta,',
    test: 'src/tests/unit/reclassify-verdict-delta.test.ts',
    why:
      '회차당 250행이라 **한 회차 표본으로는 96%/4% 를 가를 수 없다.** 덮어쓰면 계측이 도는 것처럼 ' +
      '보이면서(값이 매시간 갱신된다) 실제로는 마지막 250건만 남는다 — 조용히 틀린 근거로 ' +
      '38일짜리 구조를 바꾸게 된다.',
  },
  {
    name: '위생 스윕이 매칭 0 인 창을 완료로 읽는다(뒤쪽 결함이 영영 남는다)',
    file: 'src/features/marketing/api/company-hygiene-sweep.ts',
    find: '  const done = hi >= maxId',
    replace: '  const done = rows.length === 0',
    test: 'src/tests/unit/company-hygiene-sweep.test.ts',
    why:
      '결함은 30만 행 중 900건이라 **대부분의 창이 매칭 0** 이다. 그걸 완료로 읽으면 스윕이 첫 창에서 ' +
      '끝나고 도장을 찍어 **다시는 안 돈다** — 에러도 카운터 변화도 없이 조용히 끝난다. ' +
      '완주 판정은 매칭 건수가 아니라 **테이블 끝(MAX(id))** 이어야 한다.',
  },
  {
    name: '위생 스윕 실패가 재분류 본업을 막는다',
    file: 'src/features/marketing/api/reclassify-lane.ts',
    find: '  const hygiene = await sweepCompanyHygiene(adsLeadsDb(env)).catch(() => null)',
    replace: '  const hygiene = await sweepCompanyHygiene(adsLeadsDb(env))',
    test: 'src/tests/unit/company-hygiene-sweep.test.ts',
    why:
      '부가 작업이 본업을 죽이면 안 된다. 스윕이 던지면 **재분류 레인 전체가 그 회차를 통째로 잃고**, ' +
      '이 레인은 시간당 1회뿐이라 손실이 곧 하루치다.',
  },
  {
    name: '국번 술어가 정상 번호까지 잡는다(멀쩡한 행을 매 회차 헛돌린다)',
    file: 'src/features/marketing/api/company-hygiene-sweep.ts',
    find: "    OR (phone LIKE '01%'  AND phone NOT LIKE '01_-%')",
    replace: "    OR (phone LIKE '01%')",
    test: 'src/tests/unit/company-hygiene-sweep.test.ts',
    why:
      '술어는 *좁히개* 라 위양성이 무해해 보이지만, 010 전체가 잡히면 **회차 예산이 멀쩡한 행으로 채워져** ' +
      '진짜 결함이 뒤로 밀린다(스윕이 사실상 랩으로 되돌아간다). 실제 SQLite 로 정상 모양을 고정한다.',
  },
  {
    name: 'webkr 이름 확인을 다시 신뢰도로 거른다(evidence 158건이 영영 확인 밖)',
    file: 'src/features/marketing/api/enrich-name-heal.ts',
    find: '        AND COALESCE(name_verified, 0) = 0',
    replace: "        AND classify_confidence IN ('none', 'keyword')",
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '`evidence` 는 *"이름에 업종어가 있다"* 는 뜻이지 *"진짜 상호다"* 가 아니다 — 페이지 제목에도 ' +
      '업종어는 흔하다(`골목상권 분포`·`현장교육 > 현장교육조회`). 실측 778건 중 **158건**이 그 필터 ' +
      '때문에 영영 확인 대상 밖이었다. webkr 은 이름 출처가 **검색결과 제목**이라 신뢰도로 거를 근거가 ' +
      '처음부터 없다 — 전수 1회가 맞고, `name_verified` 도장이 그 1회를 보장한다.',
  },
  {
    name: '크롤이 한도·시간에 잘려도 확인 도장을 찍는다(그 행이 영영 미확인으로 굳는다)',
    file: 'src/features/marketing/api/enrich-name-heal.ts',
    find: "    if (c.reason !== 'subreq_limit' && c.reason !== 'deadline') verified.push(t.id)",
    replace: '    verified.push(t.id)',
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '한도·시간 초과는 **사이트의 문제가 아니라 우리 사정**이다. 그때 도장을 찍으면 전수 1회의 ' +
      '"1회"를 **빈손으로 써 버려** 그 행은 영영 이름이 안 고쳐진다. 에러도 안 나고 카운터도 안 움직여 ' +
      '조용하다 — 이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스.',
  },
  {
    name: 'webkr 상호 개명을 다시 suspectCompanyName 뒤에 가둔다',
    file: 'src/features/marketing/api/enrich-lane.ts',
    find: "        if (norm(c.siteName) !== norm(t.company_name || '')) {",
    replace: '        if (false) {',
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '`suspectCompanyName` 은 **"업체명이 아닌 것"을 열거**하는 방식이라 `고객지원`·`군포 중고차 장기렌트` 를 ' +
      '하나도 못 잡는다(실측 webkr 1,772건 중 플래그 330건뿐). 그 게이트 뒤에 개명을 가두면 대표가 신고한 ' +
      '**이름↔연락처 불일치가 그대로 남는다.** 사이트가 스스로 밝힌 이름이 검색결과 제목보다 항상 권위 있다.',
  },
  {
    name: '플랫폼 자기 페이지에서 긁은 연락처를 그대로 둔다(남의 번호가 리드에 붙는다)',
    file: 'src/features/marketing/api/company-lead-hygiene.ts',
    find: "  if (r.contact_source === 'homepage' && (r.phone || r.email) && isPlatformRootUrl(r.website)) {",
    replace: '  if (false) {',
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '실측: `이루더스` 에 당근마켓 대표번호(1877-9737), `블라인드` 에 teamblind 번호가 붙어 있었다. ' +
      '대표가 그 번호로 제휴 제안을 보내면 **엉뚱한 회사에 연락**하게 된다. ' +
      '⚠️ 경로 있는 사용자 페이지(`blog.naver.com/{handle}`)는 그 업체 채널이라 건드리면 안 된다 — ' +
      '그 경계는 `isPlatformRootUrl` 이 지키고 유닛이 양쪽을 고정한다.',
  },
  {
    name: '전화번호를 국번 무시하고 자리수로만 끊는다(하이픈이 엉뚱한 자리에)',
    file: 'src/features/marketing/api/contact-enrich.ts',
    find: "  const head = d.startsWith('02') ? 2 : d.startsWith('050') ? 4 : 3",
    replace: '  const head = 3',
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '2026-08-12 대표 신고. 이전 포맷 `(\\d{2,4})(\\d{3,4})(\\d{4})$` 는 `{2,4}` 가 탐욕적이라 앞 4자리를 ' +
      '먼저 먹어 `010-4233-5119` 를 **`0104-233-5119`** 로 찍었다. 라이브 `ad_company_leads` 8,850건 중 ' +
      '**873건**(10%)이 그 상태였다. 숫자는 맞고 하이픈만 틀려서 **에러가 안 나고**, 대표가 화면을 보고 ' +
      '신고할 때까지 아무도 몰랐다 — 이 레포의 "실패가 아니라 조용한 오염" 클래스.',
  },
  {
    name: '기존 행 전화 소급 교정이 계산만 하고 UPDATE 를 안 만든다',
    file: 'src/features/marketing/api/company-lead-hygiene.ts',
    find: "    if (fixed && fixed !== r.phone) out.push(prep('UPDATE ad_company_leads SET phone = ? WHERE id = ?').bind(fixed, r.id))",
    replace: '    void fixed',
    test: 'src/tests/unit/kr-phone-format.test.ts',
    why:
      '포맷 함수만 고치면 **앞으로 들어올 번호**만 맞고 **이미 저장된 873건은 영원히 틀린 채** 남는다. ' +
      '이 레포에서 반복된 "고쳤는데 소급이 없어 라이브는 그대로" 클래스라, 배선 자체를 가드로 고정한다.',
  },
  {
    name: '손실 분포 누적이 이전 값을 참조로 물고 온다(어제 값이 조용히 바뀐다)',
    file: 'src/features/marketing/api/enrich-telemetry.ts',
    find: '    const acc: Record<string, number> = { ...(rollup?.day === day ? rollup.crawl_reason || {} : {}) }',
    replace: '    const acc: Record<string, number> = (rollup?.day === day ? rollup.crawl_reason || {} : {})',
    test: 'src/tests/unit/enrich-rollup.test.ts',
    why:
      '누적 레코드는 65행에서 **얕은 복사**되므로 객체 필드를 그대로 물고 온다 — 여기서 더하면 ' +
      '**호출부가 들고 있는 이전 누적본까지 함께 바뀐다.** 같은 파일의 `deaths` 가 정확히 이 함정에 ' +
      '빠진 전례가 있어 그때도 유닛으로 못 박았다. 오염되면 멱등 검사와 하루 경계가 동시에 거짓말을 하고, ' +
      '그 위에서 "수율을 어디서 올릴까"를 판단하게 된다.',
  },
  {
    name: '일 1회 레인을 다시 cron 으로 되돌린다(혼잡한 시각의 꼬리가 되어 굶는다)',
    file: 'src/worker-ads/cron-public-data.ts',
    find: "  if (!laneAlarmDrivesEnrich(env) && e.ADS_FRANCHISE_ENABLED === 'true') {",
    replace: "  if (e.ADS_FRANCHISE_ENABLED === 'true') {",
    test: 'src/tests/unit/ads-lane-cadence-parity.test.ts',
    why:
      '`dailyAt` 은 `isDeferrable=false`(=`always`) 라 **회차 예산이 못 막는다.** 부모가 그 시각 레인을 다 띄우다 ' +
      'CPU 로 죽으면 `waitUntil` 이 안 비워져 뒤쪽 자식은 **시작조차 못 한다**. 실측(`ads_tick_history` 08-11): ' +
      'h=17·h=22 만 `ran=8 p:1` 이었고 침묵한 레인도 정확히 그 둘(sweep-mx·collect-franchise)이었다. ' +
      '매시간 레인은 다음 정각이 있지만 **일 1회 레인은 그날이 끝**이고 에러가 없어 경보도 안 울린다 — ' +
      '실제로 공정위 파라미터 수정이 그래서 이틀간 한 번도 실행되지 못했다.',
  },
  {
    name: '알람이 모는 레인을 cron 도 무조건 킥한다(같은 큐를 두 번 집는다)',
    file: 'src/worker-ads/index.ts',
    find: "  if (!laneAlarmOn && (env as unknown as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED === 'true') {",
    replace: "  if ((env as unknown as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED === 'true') {",
    test: 'src/tests/unit/ads-lane-cadence-parity.test.ts',
    why:
      '알람과 cron 이 같이 돌면 **같은 큐를 두 번 집는다** — 이 큐의 SELECT 는 선점이 아니라 정렬+LIMIT 이라 ' +
      '중복이 조용하고 예산만 탄다(`lane-alarm-boot.ts` 헤더). 게다가 그 중복이 부모 CPU 를 두 배로 태워 ' +
      '꼬리 레인을 자른다. ⚠️ 이 판정은 **바로 감싸는 `if`** 를 봐야 한다 — 첫 초안은 "위 8줄 안에 가드가 ' +
      '있으면 통과" 였는데, 바로 위 블록의 가드를 자기 것으로 착각해 `enrich-prospects` 를 통과시켰다.',
  },
  {
    name: '도메인 예산 재분배가 총량을 늘린다(부모가 CPU 로 죽는다)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '    if (spare > 0) { out[d] -= spare; slack += spare }',
    replace: '    if (spare > 0) { slack += spare }',
    test: 'src/tests/unit/ads-dispatch-slack.test.ts',
    why:
      '총량은 CPU 한도가 정한다 — `FREE_LANES_PER_TICK` docblock 의 실측대로 8 로 두면 **절반이 죽었다**' +
      '(자식 CPU 가 호출자 몫이라 동시 레인 수 × 각자 시간으로 쌓인다). 재분배는 **같은 총량 안에서 자리를 ' +
      '옮기는 것**이지 늘리는 게 아니다. 이 한 줄이 빠지면 잉여를 빼지 않고 나눠 주기만 해서 Σ 가 커지고, ' +
      '그 실측을 무시하고 부모를 죽이던 자리로 되돌아간다.',
  },
  {
    name: '침묵 요약이 임계를 반올림한다(150분을 "3시간"이라 말한다)',
    file: 'src/worker-ads/silence-digest.ts',
    find: '(임계 ${fmtDur(l.gap_min)})',
    replace: '(임계 ${Math.round(l.gap_min / 60)}시간)',
    test: 'src/tests/unit/ads-silence-digest-accuracy.test.ts',
    why:
      '대표 신고 2026-08-11 *"디스코드 알람이 부정확한가봐"*. 실제 임계 **150분**이 `Math.round(2.5)` = ' +
      '**3시간** 으로 찍혀, 메시지가 *"3.0시간째 침묵 (임계 3시간)"* — **넘지도 않은 것처럼** 읽혔다. ' +
      '숫자가 맞아도 **경보가 자기 근거를 틀리게 말하면 틀린 경보**이고, 그러면 다음부터 안 읽힌다.',
  },
  {
    name: '침묵 요약이 한 번만 표본을 뜬다(자기와 같은 회차를 못 본다)',
    file: 'src/worker-ads/silence-digest.ts',
    find: '      silent = confirmSilent(first, pickSilentLanes(await listCronHeartbeats(DB)))',
    replace: '      silent = first',
    test: 'src/tests/unit/ads-silence-digest-accuracy.test.ts',
    why:
      '이 요약은 `gates.dailyAt(23)` 로 **레인들과 같은 정각 회차**에 도는데, 하트비트는 묶어서 나중에 ' +
      '쓴다(`beat-batch.ts` — 대기 3초 + 레인 실행시간, 실측 최장 26초). 그래서 스냅샷 시점엔 **그 회차 ' +
      '실행분이 아직 기록에 없다.** 2026-08-11 실측: 23:00:26Z 요약이 `collect-maker` 를 "3.0시간째 침묵" ' +
      '이라 했는데 그 레인의 마지막 실행은 **23:00Z(같은 회차)** 였다 — 멈춘 적이 없다. ' +
      '⇒ 순간값 한 번으로 지속 상태를 단정하지 않는다. 두 표본의 **교집합**만 신고한다.',
  },
  {
    name: '삭제된 레인을 나이로만 판정한다(16일간 "진짜 침묵"으로 보인다)',
    file: 'src/worker/utils/cron-beat-retirement.ts',
    find: "  if (knownBaseNames?.size && raw.startsWith('ads:') && !knownBaseNames.has(beatBaseName(raw)) && age > RETIRED_MIN_AGE_MIN) return 'retired'",
    replace: '  // (제거)',
    test: 'src/tests/unit/cron-heartbeat-verdict.test.ts',
    why:
      '은퇴 임계가 자기 주기의 **8배**라, 48시간 주기 레인은 코드에서 삭제돼도 **16일 동안 "진짜 침묵"** 으로 ' +
      '보인다. 2026-08-10 에 그 때문에 오진했다: `collect-nara-vendor` 는 `collect-nara-contract` 로 대체되며 ' +
      '**코드에서 사라진** 레인인데 "114시간째 멈춤"으로 보고돼, 대표에게 **필요 없는 API 화면 캡처를 요청**했다. ' +
      '나이는 은퇴를 늦게 말하지만 **"디스패처가 안 부른다"는 사실은 즉시 알 수 있다**(orphanLaneBeats 와 같은 신호).',
  },
  // 🗑️ **삭제(2026-08-14)** — `이름 치유가 keyword 행을 빼놓는다`.
  //   그 주입은 `classify_confidence IN ('none','keyword')` 를 `= 'none'` 으로 되돌리는 것이었는데,
  //   같은 날 **신뢰도 필터 자체를 폐기**했다(`evidence` 는 "이름에 업종어가 있다"는 뜻이지
  //   "진짜 상호다"가 아니라서 — webkr 은 이름 출처가 검색결과 제목이다). 대상 문자열이 사라져
  //   하네스가 **"낡은 지도"** 로 잡아 냈다 — 정확히 그러라고 만든 검사다.
  //   ⚠️ 지키던 불변식은 사라진 게 아니라 **더 넓은 것으로 대체**됐다: 위쪽
  //   `webkr 이름 확인을 다시 신뢰도로 거른다` 가 *어떤* 신뢰도 필터든 되돌아오면 빨간불을 낸다.
  {
    name: '공정위 연도를 코드에 박는다(내년에 같은 자리에서 또 죽는다)',
    file: 'src/features/marketing/api/franchise-collect.ts',
    find: '  const y = new Date(nowMs).getUTCFullYear()',
    replace: '  const y = 2026',
    test: 'src/tests/unit/franchise-op-fallback.test.ts',
    why:
      '이 레인은 **오퍼레이션 이름 하나로 21회**를 버렸다. 봉투 오독을 고치자 같은 클래스의 두 번째 함정이 ' +
      '드러났다 — 코드 12(주소 없음)가 사라지고 **코드 11(필수 파라미터 누락)** 이 나왔다(`yr` 미전송). ' +
      '연도를 박으면 **해가 바뀌는 순간 조용히 0건**이 되고, 이 환경은 `apis.data.go.kr` 이 프록시 차단이라 ' +
      '개발 중에 못 찔러 본다 → 또 몇 주를 버린다. 그래서 실측으로 스스로 정하게 둔다.',
  },
  {
    name: '공정위 연도 순회를 모든 오류에서 돈다(같은 실패를 N배로)',
    file: 'src/features/marketing/api/franchise-collect.ts',
    find: '    if (i === 0 && !count && (!msg || /ESSENTIAL_PARAMETER_ERROR|필수.*파라미터/i.test(msg))) {',
    replace: '    if (i === 0 && !count) {',
    test: 'src/tests/unit/franchise-op-fallback.test.ts',
    why:
      '키 오류·트래픽 초과에 연도 후보를 돌리면 **같은 실패를 N배로 반복**해 서브리퀘스트만 태운다. ' +
      '무료 플랜은 인보케이션당 50~60 이라 그 낭비가 다른 레인의 예열 실패로 번진다(2026-07-29 실측 클래스). ' +
      '🔧 **2026-08-12 앵커 갱신**: 게이트를 *"코드 11 **또는** 오류 없이 0건"* 으로 의도적으로 넓히면서 ' +
      '이 `find` 가 낡은 지도가 됐고 **CI 가 그걸 잡았다**(harness 의 두 번째 목적이 정확히 이것). ' +
      '지키는 뜻은 그대로다 — 넓힌 것은 "성공 응답인데 0건"까지이고, **키·트래픽 오류는 여전히 순회하지 않는다.** ' +
      '⚠️ 이 사고의 교훈: 가드가 붙은 코드를 고쳤으면 `--only` 로 **그 파일의 기존 주입까지** 돌려 볼 것 ' +
      '(내 새 항목만 돌리고 푸시했다가 CI 에서 걸렸다).',
  },
  {
    name: '규칙 버전이 올라가도 우선순위 커서를 리셋 안 함(우선순위가 1회용이 된다)',
    file: 'src/features/marketing/api/reclassify-priority.ts',
    find: '      if (rulesVersion != null && Number(p.v) !== rulesVersion) return { tier: 0, cursor: 0 }',
    replace: '      // (제거)',
    test: 'src/tests/unit/ads-reclassify-priority.test.ts',
    why:
      '2026-08-11 라이브에서 **실제로 물렸다.** 판정 때 webkr 잔량이 981 에서 한 건도 안 줄어 있었는데 ' +
      '레인은 정상이었다(ok=true, 47분 전) — `phase=prio:local` 이었다. **커서가 webkr 을 지나쳐 다음 ' +
      '티어로 넘어간 뒤에 버전이 올라갔고**, 그 981건은 다시 대상이 됐지만 커서가 지나간 자리라 ' +
      '**한 바퀴(38일) 전엔 안 본다.** 버전 bump 의 의미는 "전부 다시 봐라" 이고, 그러면 우선순위 큐도 ' +
      '앞줄부터 다시 서야 한다 — 안 그러면 우선순위가 **"첫 배포 때 한 번만" 듣는 장치**가 된다.',
  },
  {
    name: '우선순위 상태에 규칙 버전을 안 적음(커서가 영영 전진 못 함)',
    file: 'src/features/marketing/api/reclassify-priority.ts',
    find: 'JSON.stringify({ tier, cursor, v: rulesVersion })',
    replace: 'JSON.stringify({ tier, cursor })',
    test: 'src/tests/unit/ads-reclassify-priority.test.ts',
    why:
      '위 리셋 판정의 짝이다. 버전을 안 적으면 읽을 때 `undefined !== 현행` 이 **항상 참**이라 매 회차 ' +
      'tier 0·cursor 0 으로 되돌아간다 → 앞 250건만 무한 반복하고 뒤는 영영 안 본다. ' +
      '리셋과 기록은 **한 쌍으로만 의미가 있다** — 한쪽만 있으면 반대 방향으로 고장난다.',
  },
  {
    name: '재검사 우선순위에 등록부 소스가 들어간다(우선순위가 무의미해진다)',
    file: 'src/features/marketing/api/reclassify-priority.ts',
    find: "export const RECLASSIFY_PRIORITY_TIERS: readonly (readonly string[])[] = [['webkr'], ['local']]",
    replace: "export const RECLASSIFY_PRIORITY_TIERS: readonly (readonly string[])[] = [['webkr'], ['local'], ['commerce']]",
    test: 'src/tests/unit/ads-reclassify-priority.test.ts',
    why:
      '등록부 소스는 **풀의 96%** 다. 앞줄에 넣으면 우선순위가 통째로 등록부로 채워져 원래의 38일 크롤과 ' +
      '같아진다 — 우선순위의 값은 "작고 틀리기 쉬운 것"에 있다. 실측: 회차당 250행·시간당 1회라 23만 건 ' +
      '한 바퀴가 38일이고, 오염된 webkr 1,092건은 전부 커서(id 55,380) 뒤에 있었다(69,053~471,880).',
  },
  {
    name: '우선순위가 전체 크롤을 대체한다(등록부 행이 영영 재검사 안 됨)',
    file: 'src/features/marketing/api/company-discovery.ts',
    find: '  const prioDone = !prio',
    replace: '  const prioDone = false',
    test: 'src/tests/unit/ads-reclassify-priority.test.ts',
    why:
      '우선순위는 크롤을 **대체하는 게 아니라 앞에 끼워 넣는 것**이다. 폴백이 끊기면 등록부 20만 건이 ' +
      '규칙 변경에도 영영 재검사되지 않는다 — 에러 없이 조용히. 이 레포가 반복해 만난 "실패가 아니라 부재" 클래스.',
  },
  {
    name: '우선순위 회차가 전체 크롤 커서를 민다(그만큼 조용히 건너뛴다)',
    file: 'src/features/marketing/api/company-discovery.ts',
    find: "  if (prioDone) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(RECLASSIFY_CURSOR, String(nextCursor)).run().catch(() => null)",
    replace: "  if (true) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(RECLASSIFY_CURSOR, String(nextCursor)).run().catch(() => null)",
    test: 'src/tests/unit/ads-reclassify-priority.test.ts',
    why:
      '커서를 섞으면 우선순위 회차가 전체 크롤 커서를 **그만큼 앞으로 밀어**, 건너뛴 등록부 행이 이번 랩에서 ' +
      '영영 재검사되지 않는다. 그리고 그 누락은 로그에도 안 남는다 — 커서는 그냥 전진했을 뿐이다.',
  },
  {
    name: '랩 완료 시 우선순위 상태를 리셋 안 함(우선순위가 1회용이 된다)',
    file: 'src/features/marketing/api/company-discovery.ts',
    find: '    await writePrioState(DB, 0, 0, CLASSIFY_RULES_VERSION)',
    replace: '    // (제거)',
    test: 'src/tests/unit/ads-reclassify-priority.test.ts',
    why:
      '티어가 끝에 고정되면 **다음 랩부터는 우선순위가 없다.** 규칙은 앞으로도 계속 바뀌므로 우선순위가 ' +
      '1회용이면 이번만 고치고 다음 규칙 변경 때 다시 38일을 기다리게 된다.',
  },
  {
    name: '하트비트 목록이 유령 판정을 안 싣는다(화면과 경보가 갈라진다)',
    file: 'src/worker/utils/cron-heartbeat.ts',
    find: '    for (const r of rows) r.verdict = classifyBeat({ name: r.name, age_minutes: r.age_minutes, max_gap_min: r.max_gap_min }, freshBases, knownBases)',
    replace: '    // (제거)',
    test: 'src/tests/unit/cron-heartbeat-verdict.test.ts',
    why:
      '게이트·경보는 `classifyBeat` 로 유령(개명·승계된 옛 이름)을 걸러 조용한데 **사람이 보는 목록만** ' +
      '안 걸렀다 — 화면 12건 vs 실제 알림 2건. 그 격차는 소음이 아니라 **오진**을 만들었다: 2026-08-08 에 ' +
      '두 세션이 이 목록을 읽고 "유어애즈 레인 4개가 침묵 중"이라고 보고했지만 진짜로 멈춘 것은 ' +
      '`collect-nara-vendor` 하나였다. 유령이 진짜를 덮는 것이 이 레포가 반복해 만난 경보 무력화의 형태다.',
  },
  {
    name: '어드민 화면이 유령을 빨갛게 칠한다(서버만 고치면 화면은 그대로다)',
    // 2026-08-09: 카드 UI 가 600줄 래칫으로 HeartbeatCards.tsx 로 추출 — 표적도 따라간다.
    file: 'src/pages/admin-system-monitoring/HeartbeatCards.tsx',
    find: '                  {realStale && <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold">멈춤 의심</span>}',
    replace: '                  {h.stale && <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold">멈춤 의심</span>}',
    test: 'src/tests/unit/cron-heartbeat-verdict.test.ts',
    why:
      '**여기까지 안 오면 고친 게 아니다.** 서버가 판정을 실어 주고 집계에서 빼도, 화면이 행마다 ' +
      '`h.stale` 을 빨갛게 칠하면 **사람이 보는 것은 그대로 12건**이다. 실제로 이 세션이 서버만 고쳐 놓고 ' +
      '끝났다고 할 뻔했고, 대표가 "이제 영구적이냐"고 물어 다시 확인하다 발견했다 — 같은 커밋에서 ' +
      '"계산해 놓고 안 쓰면 소용없다"고 적어 놓고 자기가 그 함정에 걸린 것이라, 이 배선은 기계가 지킨다.',
  },
  {
    name: '어드민 침묵 목록이 유령까지 센다',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: "  const stale = items.filter(i => (i.age_minutes ?? 0) > 60 * 24 && (i.verdict ?? 'judge') === 'judge').map(i => i.name)",
    replace: '  const stale = items.filter(i => (i.age_minutes ?? 0) > 60 * 24).map(i => i.name)',
    test: 'src/tests/unit/cron-heartbeat-verdict.test.ts',
    why:
      '판정을 계산해 놓고 **쓰지 않으면** 화면은 그대로다 — "가드는 있는데 그 자리에 안 붙어 있다" 클래스. ' +
      '이 한 줄이 되돌아가면 유령 11건이 다시 침묵으로 집계되고, 다음 세션이 또 같은 오진을 한다.',
  },
  {
    name: '업종어뿐인 이름을 근거로 인정한다(검색어가 상호가 되어 영구히 굳는다)',
    file: 'src/features/marketing/api/company-classify.ts',
    find: '    if (nameIsGeneric) continue                     // 이름이 업종어뿐 — 그건 상호가 아니라 설명이다',
    replace: '    // (제거)',
    test: 'src/tests/unit/company-classify-webkr-noise.test.ts',
    why:
      '2026-08-10 대표 신고 "파트너들 이름이 왜이래" 의 가장 나쁜 행이 `마케팅 대행` 이었다 — 검색어가 그대로 ' +
      '상호가 됐는데 하필 BIZ_RULES 의 `마케팅\\s*대행` 에 **이름으로** 맞아 `대행사 tier1 · evidence` 가 됐다. ' +
      '`evidence` 는 이름 치유의 **제외 조건**이라 그 이름이 **영구히 굳는다**(가장 나쁜 조합). ' +
      '진짜 상호에는 업종어 말고 자기만의 토큰이 있다(`남부`종합광고기획) — 남는 게 없으면 설명이지 이름이 아니다.',
  },
  {
    name: '업종어 판정을 등록부 상호에까지 적용한다(원부가 준 값을 의심)',
    file: 'src/features/marketing/api/company-classify.ts',
    find: '  const nameIsGeneric = bodyUntrusted && isGenericPhrase(name)',
    replace: '  const nameIsGeneric = isGenericPhrase(name)',
    test: 'src/tests/unit/company-classify-webkr-noise.test.ts',
    why:
      '⚠️ **넓히는 방향의 결함.** 등록부 상호는 정부가 신고받은 값이라 우리가 의심할 대상이 아니다 — ' +
      '`commerce` 는 제안 가능 리드의 95.7% 라 그 근거 등급을 내리면 명단의 심장을 깎는다. ' +
      '🩸 이 주입은 처음에 **초록으로 통과했다**: 테스트가 `ok` 를 봤는데 이 규칙은 행을 버리지 않고 ' +
      '**근거 등급만** 내리기 때문이다. 재는 값을 `confidence` 로 바꿔서야 빨강이 됐다.',
  },
  {
    name: '잘린 제목 파편이 상호가 된다(webkr — 공공기관이 대행사 tier1 로)',
    file: 'src/features/marketing/api/company-classify.ts',
    find: "  if (DESC_IS_PAGE_BODY.has(input.source || '') && unbalancedBracket(name)) return reject('TRUNCATED_TITLE')",
    replace: '  // (제거)',
    test: 'src/tests/unit/company-classify-webkr-noise.test.ts',
    why:
      '제목을 구분자로 자르다 괄호 안에서 끊기면(`[광주 - 동구] …` → `[광주`) 그 파편이 상호가 되고, ' +
      '이름에 `진흥원` 이 안 남아 **기관 어휘 검사를 통과한다**. 대표가 잡은 전남중소기업일자리경제진흥원이 ' +
      '정확히 그 경로로 `대행사 tier1`(콜드 접촉 풀 최상단)에 앉아 있었다. 리드가 하나 섞이는 문제가 아니라 ' +
      '**"제안 보낼 수 있는 리드 수"라는 유일한 성공 지표가 거짓으로 부풀어 있는** 문제다.',
  },
  {
    name: '잘린-제목 규칙을 전 소스에 적용한다(등록부 실업체 56건 삭제)',
    file: 'src/features/marketing/api/company-classify.ts',
    find: "  if (DESC_IS_PAGE_BODY.has(input.source || '') && unbalancedBracket(name)) return reject('TRUNCATED_TITLE')",
    replace: "  if (unbalancedBracket(name)) return reject('TRUNCATED_TITLE')",
    test: 'src/tests/unit/company-classify-webkr-noise.test.ts',
    why:
      '⚠️ **넓히는 방향의 결함** — 좁히는 것만 결함이 아니다. 라이브에서 괄호 불균형을 전 소스로 재면 ' +
      '`주)다산케인엔케이통상` 류 **정부 등록부 실업체 56건**이 잡힌다(등록부가 앞 `(` 를 흘린 표기지 우리가 ' +
      '자른 파편이 아니다). 그리고 `commerce` 는 **제안 가능 리드의 95.7%** 다 — 이 한 줄이 넓어지면 명단의 ' +
      '심장을 깎는다. 실제로 이 규칙을 설계할 때 전 소스 적용이 첫 안이었고, 라이브 측정이 막았다.',
  },
  {
    name: 'or.kr(비영리 전용 도메인)을 기관으로 안 본다',
    file: 'src/features/marketing/api/company-classify.ts',
    find: '      orgByHost = NONPROFIT_HOST.test(host)',
    replace: '      orgByHost = false',
    test: 'src/tests/unit/company-classify-webkr-noise.test.ts',
    why:
      '`or.kr` 은 등록 요건상 비영리기관만 받는다 — 이름을 안 봐도 확정인 신호다. 이게 필요한 이유는 ' +
      '**이름이 늘 믿을 수 있는 게 아니기 때문**: 상공회의소가 `「2025년 제1회 부산진구` 라는 잘린 제목으로 ' +
      '들어와 파트너로 앉아 있었다. 이름 어휘 검사는 이름이 남아 있을 때만 통하고, **호스트는 잘리지 않는다.** ' +
      '소스 주석은 예전부터 "or.kr 은 org 로 분류만" 이라고 약속했는데 **그 코드가 없었다**(의도만 있던 자리).',
  },
  {
    name: '페이지 본문을 업종 근거로 인정한다(webkr)',
    file: 'src/features/marketing/api/company-classify.ts',
    find: '    if (bodyUntrusted && !r.re.test(name)) continue',
    replace: '    // (제거)',
    test: 'src/tests/unit/company-classify-webkr-noise.test.ts',
    why:
      'webkr 의 `description` 은 검색결과 **페이지 본문**이다. 진흥원이 지원사업 보도자료에 "온라인 마케팅 ' +
      '활성화" 라고 쓰면 대행사 규칙에 걸려 기관이 파트너가 된다. 더 나쁜 건 그렇게 붙은 `evidence` 가 ' +
      '**이름 치유(Phase 3)의 제외 조건**이라 잘린 이름까지 영구히 굳는다는 것 — 조용히 틀린 채 남는다. ' +
      '⚠️ `local`(지도)의 description 은 지도 API 업종 문자열이라 진짜 근거이고, 5,932건이 거기 걸려 있다.',
  },
  {
    name: '공정위 응답 오류코드를 header 에서만 읽는다(실패가 성공처럼 보인다)',
    file: 'src/features/marketing/api/franchise-collect.ts',
    find: '  const codeSrc = (resp.header ?? resp ?? data) as Record<string, unknown>',
    replace: '  const codeSrc = (resp.header ?? {}) as Record<string, unknown>',
    test: 'src/tests/unit/franchise-op-fallback.test.ts',
    why:
      '이 API 응답은 **평평하다**(Swagger `getBrandinfo_response { resultCode, …, items }`) — `header` 래퍼가 ' +
      '없다. header 에서만 읽으면 `rc`/`rm` 이 빈 문자열이 되고 실패 판정이 **무조건 통과**해서 라이브에 ' +
      '`found 0 · error 없음` 만 남는다(실측 3회 반복). 에러가 없는 게 아니라 **에러를 읽는 자리가 비어 ' +
      '있는 것**이라 화면상 정상으로 보인다 — 이 레포가 반복해 만난 "조용한 실패" 클래스의 교과서적 형태.',
  },
  {
    name: '정체 불명 리드가 발송 대상(partner)으로 남음',
    file: 'src/features/marketing/api/company-save.ts',
    find: "const t = c.lead_type === 'unknown' && !suspect ? 'partner' : c.lead_type",
    replace: "const t = c.lead_type === 'unknown' ? 'partner' : c.lead_type",
    test: 'src/tests/unit/ads-suspect-name-lead-type.test.ts',
    why:
      '대표 신고("나라장터 담당자가 섞였다")를 실측했더니 회사명이 `[광주` — "[광주] …" 공고 제목을 ' +
      '파싱하다 남은 **파편**이었다(id 401793). 이름이 없으니 기관 어휘 규칙이 잡을 수가 없고, ' +
      '`suspectCompanyName` 은 confidence 만 낮추고 lead_type 은 partner 로 뒀다. 게다가 ' +
      "`unknown ? 'partner'` 승격이 저장·재분류 두 곳에 있어 분류기가 '모르겠다'고 해도 발송 대상이 됐다. " +
      '이 DB 의 유일한 성공 지표가 "제안 보낼 수 있는 리드 수"라, 보낼 수 없는 리드가 섞이면 그 수가 거짓이 된다.',
  },
  {
    name: '가맹 레인이 틀린 오퍼레이션 이름에서 못 빠져나온다',
    file: 'src/features/marketing/api/franchise-collect.ts',
    find: "    if (i === 0 && !count && msg && /NO_OPENAPI_SERVICE_ERROR/i.test(msg)) {",
    replace: '    if (false) {',
    test: 'src/tests/unit/franchise-op-fallback.test.ts',
    why:
      '이 레인은 오퍼레이션 이름 하나(`getBrandList` → 실제 `getBrandinfo`)가 틀려 **22회 연속 0건**이었다. ' +
      '승인·활용기간·키 전부 정상이라 화면상 아무 문제가 없어 보였고, 소스 주석은 "웹 확인"이라 단언하고 ' +
      '있었다 — 이 환경은 `apis.data.go.kr` 이 프록시 차단이라 **개발 중에 검증할 수가 없기 때문**이다. ' +
      '자가회복이 빠지면 다음에 이름이 또 바뀔 때 같은 몇 주가 반복되고, **실패가 조용해서 아무도 모른다.**',
  },
  {
    name: '추출 규칙 지문이 정규식 변경을 놓친다(재추출이 영원히 안 돈다)',
    file: 'src/features/marketing/api/influencer-discovery.ts',
    find: 'const NOT_EMAIL_SUFFIX = /\\.(png|jpg|jpeg|gif|webp|svg|mp4|webm)$/i',
    replace: 'const NOT_EMAIL_SUFFIX = /\\.(pngX|jpg|jpeg|gif|webp|svg|mp4|webm)$/i',
    test: 'src/tests/unit/reextract-rules-fingerprint.test.ts',
    why:
      '`REEXTRACT_RULES_VERSION` 은 시간 폴백이 없어, 안 올리면 개선된 추출기가 기존 36,880행에 ' +
      '**영원히** 안 닿는다. 그 판정을 이 지문이 대신하므로 지문이 규칙 변경을 놓치면 가드가 통째로 ' +
      '무의미해진다. ⚠️ 실제로 놓쳤었다 — 첫 판은 `_RE` 로 끝나는 **이름**만 골라 이 상수를 빠뜨렸고 ' +
      '정규식을 바꿔도 초록이었다. 이름이 아니라 **값의 모양**으로 고르게 고친 뒤 빨강을 확인했다.',
  },
  {
    name: 'B2B 수집 페이지가 다시 마운트마다 917KB 를 받는다',
    file: 'src/pages/admin/AdminPartnerPoolPage.tsx',
    find: 'useEffect(() => { loadMeta(); loadStats() }, [loadMeta, loadStats])',
    replace: 'useEffect(() => { loadMeta(); loadStats(); loadKeywords() }, [loadMeta, loadStats, loadKeywords])',
    test: 'src/tests/unit/partner-pool-lazy-keywords.test.ts',
    why:
      '키워드 패널은 `showOps` 안이고 **기본이 접힘**인데 그 917KB(4,546개)를 마운트마다 받고 있었다 — ' +
      '한 번도 화면에 그려지지 않은 채로. 렌더 쪽은 이미 최적화돼 있어(상위 80 미리보기·useMemo) ' +
      '"이 패널은 최적화됨"으로 읽혔고, **비용이 렌더가 아니라 전송에 있다는 걸 아무도 안 쟀다.** ' +
      '되돌려도 화면은 똑같이 동작한다 — 느려질 뿐이라 사람 눈으로는 못 잡는다.',
  },
  {
    name: '`rules-version-ok` 탈출구가 다시 죽는다(매치가 숫자에서 끊김)',
    file: 'scripts/check-rules-version-bump.mjs',
    // ⚠️ 백슬래시가 많은 구간이라 **역슬래시 없는 꼬리**만 집는다(이스케이프 두 겹으로 첫 시도가 빗나갔다).
    find: ".*$`, 'm').exec(src)",
    replace: "`, 'm').exec(src)",
    test: 'src/tests/unit/rules-version-exemption.test.ts',
    why:
      '가드가 안내하는 유일한 예외 통로가 **문서에만 있고 코드에는 없던** 상태로 돌아간다 — 매치가 ' +
      '숫자에서 끝나면 같은 줄의 주석이 `cur.line` 에 안 들어와 예외가 절대 안 걸린다. ' +
      '막다른 길에 몰린 세션은 그러면 **더 나쁜 선택**(불필요한 bump 로 3.6만 행 재처리, 혹은 가드 끄기)을 ' +
      '한다. 되돌려도 에러가 없고, 예외를 쓰려는 사람만 조용히 막힌다.',
  },
  {
    name: '차단당한 회차가 백로그를 그대로 스탬프한다(학습 오염)',
    file: 'src/features/marketing/api/influencer-performance.ts',
    find: "      if (naverCrawlBlocked()) { diag.blocked = (diag.blocked || 0) + 1; return }",
    replace: '      // (차단 가드 제거)',
    test: 'src/tests/unit/naver-crawl-block.test.ts',
    why:
      '연락처는 오픈API 가 아니라 공개 페이지 크롤(`m.blog`·`rss.blog`)로 캔다 — 쿼터도 승인도 없고, ' +
      '실측 하루 8천 요청이다. 막히면 본문이 0인데 이 가드가 없으면 **스탬프가 찍힌다**: ' +
      '`perf_checked_at` 이 `nb_measured`(연락처 수율의 분모)를 부풀려 `suppressLowRotationYield` 가 ' +
      '멀쩡한 키워드를 "나쁘다"고 학습하고, 억제된 키워드는 증거가 갱신되지 않아 **차단이 풀려도 ' +
      '안 돌아온다.** 게다가 그동안 백로그가 한 바퀴 통째로 소모된다. 되돌려도 에러는 안 난다.',
  },
  {
    name: '타임아웃까지 차단으로 세어 멀쩡한 레인을 멈춘다',
    file: 'src/features/marketing/api/naver-crawl-block.ts',
    find: '  if (isBlockStatus(status)) { streak += 1; blocked += 1; return }\n  if (typeof status === \'number\') { streak = 0; ok += 1 }',
    replace: '  streak += 1; blocked += 1',
    test: 'src/tests/unit/naver-crawl-block.test.ts',
    why:
      '*"느리다"는 "막혔다"가 아니다* — 2026-07-29 `shouldNoindexMissingEntity` 에서 타임아웃을 ' +
      '"없음"으로 읽으면 멀쩡한 상품이 색인에서 빠진다고 배운 것과 같은 규칙이다. 예외·404 까지 세면 ' +
      '삭제된 블로그 세 개에 측정 레인이 통째로 멈추고, 성공이 연속을 못 끊어 **한 번 막히면 영영 멈춘다.**',
  },
  {
    name: '네이버 일일 목표 게이트를 호출부가 무시한다(반환값 버림)',
    file: 'src/features/marketing/api/fetch-with-err.ts',
    find: "  if (!noteNaverCall(url)) return { res: null, err: 'NaverQuota: 일일 목표(90%) 소진' }",
    replace: '  noteNaverCall(url)',
    test: 'src/tests/unit/api-daily-target.test.ts',
    why:
      '게이트는 계측 함수의 **반환값**으로만 작동한다 — 예전처럼 값을 버리고 부르면 상수와 장전은 ' +
      '그대로 남은 채 아무도 안 막힌다(이 레포가 반복해 만난 "검사가 실패할 수 없다" 클래스). ' +
      '유료 전환으로 서브리퀘스트가 ×15 되면 그대로 쿼터를 넘겨 429 를 받고, 실패 호출도 쿼터를 ' +
      '먹으므로 **회차 후반 작업이 통째로 버려진다.**',
  },
  {
    name: '네이버 게이트를 아무도 장전하지 않는다(항상 무제한)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '  armNaverDailyAllowance(parseNaverUsed(settings[NAVER_USED_KEY], kstDayKey(Date.now())))',
    replace: '  void armNaverDailyAllowance',
    test: 'src/tests/unit/api-daily-target.test.ts',
    why:
      '허용량 기본값은 **무제한(`null`)** 이다 — 무장을 잊은 레인이 조용히 멈추는 것보다 낫기 때문이다. ' +
      '그 설계의 대가로, 장전 한 줄이 사라지면 게이트가 **에러 없이 전면 무효**가 된다. ' +
      '상수도 테스트도 그대로 초록이라 사람 눈으로는 못 잡는다.',
  },
  {
    name: '유튜브 검색 예산을 100 으로 되돌린다(측정 몫 0)',
    // 2026-08-11: 쿼터 정책이 `influencer-yt-quota.ts` 로 분리(600줄 래칫) — 표적도 따라간다.
    //   원 모듈은 재수출만 하므로 여기서 바꿔야 실제 상수가 변이된다.
    file: 'src/features/marketing/api/influencer-yt-quota.ts',
    find: 'export const YT_SEARCH_BUDGET_DEFAULT = 90',
    replace: 'export const YT_SEARCH_BUDGET_DEFAULT = 100',
    test: 'src/tests/unit/api-daily-target.test.ts',
    why:
      'search.list 1회 = 100 units 라 검색 100회면 하루 쿼터 10,000 이 검색으로 전부 나간다 → ' +
      '성과측정(각 1 unit)이 **하루 종일 403**(2026-07-27 실사고). 90 은 임의값이 아니라 ' +
      '`쿼터 × 90% ÷ 단가` 이고, 남는 1,000 units 가 측정 몫이다.',
  },
  {
    name: 'CPU 자기교정 — 감지 호출이 사라짐(학습이 조용히 멈춘다)',
    file: 'src/worker-ads/beat-batch.ts',
    find: '    await learnCpuQuanta(env, list).catch(() => undefined)',
    replace: '    void list',
    test: 'src/tests/unit/ads-cpu-quantum.test.ts',
    why:
      'CPU 로 죽은 레인은 자기 하트비트를 못 쓰므로 **항상 부모가** 기록한다 — 그 기록이 지나는 ' +
      '이 한 곳이 유일한 감지 지점이다. 빠지면 자동수리가 통째로 멈추는데 **에러도 경고도 없다** ' +
      '(레인은 여전히 죽고, 아무도 줄여 주지 않을 뿐이다).',
  },
  {
    name: 'CPU 자기교정 — 레인 이름에서 `ads:` 접두어가 빠짐',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: "export const RECLASSIFY_LANE = 'ads:reclassify-company?passes=5'",
    replace: "export const RECLASSIFY_LANE = 'reclassify-company?passes=5'",
    test: 'src/tests/unit/ads-cpu-quantum.test.ts',
    why:
      '학습 표의 키는 하트비트 이름(`adsBeat` 이 `ads:` 를 붙인다)이다. 접두어가 어긋나면 표를 못 찾아 ' +
      '**학습값이 있어도 상한이 안 줄어든다** — 조회는 성공하고 값만 기본값이라 에러가 없다. ' +
      '이 레포가 반복해 만난 "이름 한 칸 어긋나서 조용히 no-op" 클래스.',
  },
  {
    name: 'CPU 자기교정 — 학습표가 레인 조회에서 빠짐(적히기만 하고 아무도 안 읽는다)',
    file: 'src/features/marketing/api/cpu-quantum.ts',
    find: 'const want = lane ? [...keys, CPU_QUANTA_KEY] : [...keys]',
    replace: 'const want = [...keys]',
    test: 'src/tests/unit/ads-cpu-quantum.test.ts',
    why:
      '이 한 줄이 감지와 소비를 잇는다. 빠지면 CPU 사망은 계속 표에 적히는데 **어떤 레인도 그 값을 ' +
      '안 읽어** 작업량이 그대로다 — 조회는 성공하고 `q` 만 늘 1 이라 에러도 경고도 없다. ' +
      '자동수리가 도는 것처럼 보이면서 실제로는 아무 일도 안 일어나는, 정확히 그 상태가 된다.',
  },
  {
    name: 'commerce anyEmail 빠른 길이 태그 감싼 이메일을 놓침',
    file: 'src/features/marketing/api/commerce-notify-collect.ts',
    find: "    if (!raw.includes('@')) continue",
    replace: "    if (raw.includes('<')) continue",
    test: 'src/tests/unit/ads-commerce-record-cpu.test.ts',
    why:
      '최적화는 "빠른 길"을 **추가**하는 것이라 조용히 결과를 바꿀 수 있다 — 그리고 이 함수가 바꾸는 결과는 ' +
      '**리드의 이메일 유무**, 즉 이 DB 의 유일한 성공 지표다. 그래서 속도가 아니라 **옛 구현과의 동치성**을 ' +
      "고정한다(참조 구현을 테스트에 박아 대조). 이 주입은 '@' 대신 '<' 로 끊어 태그 감싼 이메일을 놓치게 만든다.",
  },
  {
    name: 'CPU 위험 판정이 벽시계(ms)로 되돌아감',
    file: 'src/worker/utils/cron-heartbeat.ts',
    find: 'cpu_risk: cpuRiskFromDeaths(deaths.get(name)?.n, deaths.get(name)?.at, now),',
    replace: 'cpu_risk: cpuRisk(ms),',
    test: 'src/tests/unit/cron-cpu-death-risk.test.ts',
    why:
      '워커에서 Date.now() 는 I/O 에서만 흐르므로 ms 는 CPU 와 무관하다. 라이브에서 실제로 **반대로** 찍혔다: ' +
      'd1-backup 146,975ms 는 멀쩡한데 danger, collect-commerce 는 13,921ms 에 죽었는데 null. ' +
      '이 지표를 읽고 "문턱에 붙은 레인 6개" 라는 잘못된 목록이 만들어졌다 — 되돌아가면 그 오진이 반복된다.',
  },
  {
    name: 'commerce 레코드 상한(=진짜 CPU 가드)이 죽던 값으로 되돌아감',
    file: 'src/features/marketing/api/commerce-notify-collect.ts',
    find: 'const MAX_RECORDS_PER_RUN = 700',
    replace: 'const MAX_RECORDS_PER_RUN = 1_500',
    test: 'src/tests/unit/ads-commerce-deadline-calibration.test.ts',
    why:
      '한 회차가 태우는 CPU 의 **천장**이다. 워커가 CPU 시간을 안 주므로 남은 여유를 볼 수 없고, ' +
      '죽는 지점은 레인이 아니라 **그 회차의 성질**이다(08-09 실측: storeinfo 가 13,833ms 에 죽고 ' +
      '20,668ms 에 살았다 — 코드 변경 0). 맞출 대상이 없으니 할 수 있는 건 우리 몫을 작게 두는 것뿐이고, ' +
      '그래서 이 값은 **올리는 것만 막는 천장**이다. 주석에만 적어 두면 다음 세션이 "느리니까" 되돌린다.',
  },
  {
    name: 'CPU 자기교정 — collect-hira 가 배수를 무시한다',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: 'const maxPages = maxPagesArg ?? applyQuantum(envPlanValue(undefined, 3, 12, env), cfg.q, 1)',
    replace: 'const maxPages = maxPagesArg ?? envPlanValue(undefined, 3, 12, env)',
    test: 'src/tests/unit/ads-cpu-quantum.test.ts',
    why:
      '페이지 수가 이 레인의 작업량 노브다(한 장이 곧 파싱량). 배수가 안 걸리면 학습이 돌아도 ' +
      '이 레인만 예전 크기로 계속 돌아 **또 CPU 로 죽는다** — 2026-08-04 실측 6,409ms 사망 레인이라 ' +
      '조절기의 첫 시험대이기도 하다. 되돌아가도 초록불이라 사람이 못 잡는다.',
  },
  {
    name: '침묵 경보가 은퇴 분류를 다시 건너뛴다(유령이 사람에게 간다)',
    file: 'src/worker/cron/cron-stale-watch.ts',
    find: "    && classifyBeat({ name: b.name, age_minutes: b.age_minutes, max_gap_min: b.max_gap_min }, fresh) === 'judge')",
    replace: '    )',
    test: 'src/tests/unit/cron-stale-watch-retirement.test.ts',
    why:
      '2026-08-04 에 만든 은퇴 분류가 `/api/_healthcheck/cron` 게이트에만 붙고 **이 경로엔 안 붙어** ' +
      '디스코드·`cron_failures`·어드민 벨이 유령을 계속 신고했다(08-05 실측 `stale:*` 16건 중 대부분). ' +
      '⚠️ 나쁜 이유는 소음이 아니라 **진짜를 덮는 것**이다 — 그 목록 안에 3일 멈춘 레인이 묻혀 있었다. ' +
      '되돌아가도 경보는 계속 울리므로(오히려 더 울린다) **사람이 이상을 못 느낀다.**',
  },
  {
    name: 'CPU 자기교정 — 라이브에서 죽는 레인이 배수를 다시 무시한다',
    file: 'src/features/marketing/api/commerce-notify-collect.ts',
    find: "readLaneSettings(DB, [STATS_KEY], 'ads:collect-commerce')",
    replace: "readLaneSettings(DB, [STATS_KEY], 'collect-commerce')",
    test: 'src/tests/unit/ads-cpu-quantum.test.ts',
    why:
      '2026-08-05 라이브에서 이 레인은 24시간에 3회 CPU 한도로 죽었고 학습표에 q=0.5 가 **실제로 적혔다**. ' +
      '그런데 배포 직후에는 읽는 곳이 없어 아무 일도 안 일어났다 — 조절기가 도는데 효과가 0 인, ' +
      '이 레포가 반복해 만난 조용한 no-op 이다. `ads:` 한 칸만 어긋나도 조회는 성공하고 값만 기본값이라 ' +
      '**에러도 경고도 없이** 그 상태로 되돌아간다.',
  },
  {
    name: '침묵 기준이 회전을 다시 잊는다(계산만 하고 안 띄움)',
    file: 'src/worker-ads/lane-runner.ts',
    find: 'runLanes(runWithGap, {',
    replace: 'runLanes(sel.run, {',
    test: 'src/tests/unit/ads-rotation-gap.test.ts',
    why:
      '회전 임계를 계산해 놓고 원본을 그대로 띄우면 **아무것도 안 바뀐다** — 코드는 멀쩡해 보이고 ' +
      '타입도 통과하는데 하트비트엔 옛 기준이 실린다. 그러면 정상 동작 중인 매시간 레인이 ' +
      '다시 매번 경보가 되고(2026-08-05 실측 5건), 그 소음이 진짜 침묵 하나를 덮는다.',
  },
  {
    name: '회전 계산이 `always` 레인을 빼지 않는다(기준이 과하게 느슨해짐)',
    file: 'src/worker-ads/lane-cadence.ts',
    find: 'const running = Math.max(0, (d?.run?.length ?? 0) - Math.max(0, Math.floor(Number(d?.always) || 0)))',
    replace: 'const running = d?.run?.length ?? 0',
    test: 'src/tests/unit/ads-rotation-gap.test.ts',
    why:
      '`always` 레인(지정 시각에만 열리는 게이트)은 예산과 무관하게 항상 돈다 — 경쟁자가 아니다. ' +
      '안 빼면 회전이 부풀고(company 4→7) 임계가 필요 이상으로 커져 **진짜 멈춘 레인도 오래 안 울린다.** ' +
      '완화가 과해지는 방향이라 경보가 조용히 무력해지고, 조용해진 것과 정상인 것이 구분되지 않는다.',
  },
  {
    name: '카카오 스윕이 다시 tier 순만 보고 뒷줄을 굶긴다',
    // ⚠️ 2026-08-05: SQL 이 `kakao-sweep-query.ts` 로 이사했다(자주 틀리는 자리라 분리).
    file: 'src/features/marketing/api/kakao-sweep-query.ts',
    find: "              (kakao_checked_at IS NOT NULL) ASC,\n              (email IS NOT NULL AND email <> '') ASC,\n",
    replace: '',
    test: 'src/tests/unit/kakao-sweep-order.test.ts',
    why:
      '라이브 실측: 적격 148,297 중 tier4 가 129,049 라, 그 뒤의 storeinfo 15,518건은 하루 360조회로 ' +
      '**358일** 뒤에나 차례가 온다. 게다가 30일 쿨다운이 만료된 앞줄이 계속 재적격돼 커서 없는 이 ' +
      '설계에서는 앞줄만 반복된다 — 실제로 storeinfo 17,979건의 카카오 조회 이력이 **0건**이었다. ' +
      '이 키가 빠지면 그 상태로 조용히 돌아가고, **스윕은 계속 성공으로 보인다**(앞줄은 잘 처리되므로).',
  },
  {
    name: '소스별 인터리브가 사라져 큰 소스가 작은 소스를 굶긴다',
    file: 'src/features/marketing/api/kakao-sweep-query.ts',
    find: 'ROW_NUMBER() OVER (PARTITION BY source ORDER BY',
    replace: 'ROW_NUMBER() OVER (ORDER BY',
    test: 'src/tests/unit/kakao-sweep-order.test.ts',
    why:
      '미조회 우선(위 항목)만으로는 안 닿았다 — 미조회끼리는 tier 가 줄을 세워 대기열이 ' +
      '`t3 storeinfo 2,742 → t4 commerce 111,256(벽) → t5 storeinfo 15,518` 이 된다(309일). ' +
      '파티션이 빠지면 **소스 하나가 예산을 통째로 가져가고**, 굶는 쪽은 조회 이력이 0이라 ' +
      '"그 소스는 수율이 낮다"로 오독된다(실제로 그렇게 오판해 storeinfo 를 잘라낼 뻔했다).',
  },
  {
    name: 'CPU 상한 — 파트너 수집 회차에 벽시계 마감선이 없다',
    file: 'src/features/marketing/api/company-collect.ts',
    find: ' || Date.now() - startedAt > runDeadlineMs) break',
    replace: ') break',
    test: 'src/tests/unit/ads-cpu-work-cap-callsites.test.ts',
    why:
      '이 레인은 예산(요청 수)만 볼 뿐 회차가 얼마나 오래 도는지는 안 봤다. 실측 `ms=27,410` 으로 ' +
      '**사망 기준선 26,000 을 넘긴 회차가 "성공"으로 기록**됐다 — 화면 어디에도 경고가 없다. ' +
      '마감선이 빠지면 그 상태로 돌아가고, 되돌아가도 **성공으로 보이므로 사람이 못 잡는다.**',
  },
  {
    name: 'CPU 상한 — 카카오 스윕이 예산 밖 행까지 다시 읽는다',
    file: 'src/features/marketing/api/company-collect.ts',
    // ⚠️ 2026-08-05: SQL 이 `kakao-sweep-query.ts` 로 나가면서 인라인 타입이 `KakaoSweepRow` 가 됐다.
    find: '    .bind(rowCap).all<KakaoSweepRow>',
    replace: '    .bind(cap).all<KakaoSweepRow>',
    test: 'src/tests/unit/ads-cpu-work-cap-callsites.test.ts',
    why:
      '예산 천장이 무료 캡(기본 60)이라 시도 가능한 행은 ~50개인데 `LIMIT 600` 으로 읽고 있었다. ' +
      '나머지 550행은 역직렬화만 되고 루프 `break` 에 버려지는데, 그 계산이 무료 플랜 CPU 를 태운다 ' +
      '(실측 6,640ms 에 CPU 한도 사망 — 벽시계 마감 12s 는 닿지도 못했다). **행은 그대로 처리되고 ' +
      '에러도 안 난다** — 되돌아가도 화면에는 아무 변화가 없어 사람이 못 잡는다.',
  },
  {
    name: 'CPU 상한 — 재분류가 시간만 보고 행 총량을 안 본다',
    // 🗺️ 2026-08-05 앵커 이사 — 본문이 `reclassify-lane.ts` 로 추출됐다(알람 이관: cron·알람 두 경로 공용).
    file: 'src/features/marketing/api/reclassify-lane.ts',
    find: 'passes < 5 && !last.done && rows < maxRows && Date.now() - t0 < deadlineMs',
    replace: 'passes < 5 && !last.done && Date.now() - t0 < deadlineMs',
    test: 'src/tests/unit/ads-cpu-work-cap-callsites.test.ts',
    why:
      '08-03 에 이 자리에 붙인 처방이 벽시계 마감선이었는데, 08-04 에 `ms=1316` 으로 **자기 마감선 ' +
      '1,800ms 에 닿기도 전에** CPU 한도로 죽었다. 외부 호출이 없는 DB-only 정규식 루프는 벽시계가 ' +
      '안 흐르는데 CPU 만 탄다 — 시간 조건만 남기면 08-04 상태 그대로다.',
  },
  {
    name: '키워드 목적함수가 다시 "몇 명 모았나"로 되돌아감',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: ' - yieldPenalty(k) - contactPenalty(k.yt_leads, k.yt_contacts)',
    replace: ' - yieldPenalty(k)',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '대표 지시로 목적함수를 **연락처 확보율**로 바꿨다. 이 한 항이 빠지면 점수식은 다시 `saved` 만 ' +
      '보고, 라이브 실측처럼 **연락처 0%인 키워드가 우수로 평가된다**(금천 네일 리드 118 · 이메일 0 · ' +
      '감점 0). 리드 수는 오히려 늘어나므로 **대시보드로는 개선처럼 보인다** — 그게 이 회귀의 위험이다.',
  },
  {
    name: '키워드 성과 재계산이 빠져 감점이 영원히 0',
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    find: '; out.kwyield = await recomputeKeywordContactYield(DB).catch(() => null) }',
    replace: ' }',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '감점은 `yt_leads`/`yt_contacts` 가 채워져 있어야 작동한다. 재계산 호출이 사라지면 두 값이 ' +
      '영원히 0 이고 `contactPenalty` 는 **증거 부족으로 항상 0 을 돌려준다** — 코드는 그대로인데 ' +
      '목적함수만 조용히 옛것으로 되돌아간다. 에러도 경고도 없다(이 레포가 "헛도는 가드"라 부르는 형태).',
  },
  {
    name: '나라장터 계약 — 마스킹된 전화를 진짜 연락처로 센다',
    file: 'src/features/marketing/api/nara-contract-collect.ts',
    find: "  return raw.includes('*') ? '' : raw",
    replace: '  return raw',
    test: 'src/tests/unit/nara-contract-collect.test.ts',
    why:
      '이 원부는 수주사 전화를 `***********` 로 가려서 준다(실측). 그대로 저장하면 **"연락처 있음"** 으로 ' +
      '집계돼 액션풀(active=1)에 들어간다 — 유어애즈의 유일한 지표가 *"제안 보낼 수 있는 리드 수"* 인데 ' +
      '그 숫자가 거짓이 된다. 전화하면 그제서야 안다. 200 도 받고 저장도 되니 **에러가 어디에도 안 뜬다.**',
  },
  {
    name: '나라장터 계약 — 상권 필터가 풀려 26k 계약이 통째로 유입',
    file: 'src/features/marketing/api/nara-contract-collect.ts',
    find: '  if (!DISTRICT_CONTRACT_RE.test(cntrctNm)) return []',
    replace: '  if (!cntrctNm) return []',
    test: 'src/tests/unit/nara-contract-collect.test.ts',
    why:
      '원부 26,445건 중 상권 계약은 소수이고 나머지는 대학·병원 물품 구매다. 필터가 풀리면 ' +
      '**수집이 성공한 것처럼 보이면서**(저장 수가 오히려 폭증한다) 상권 리드가 잡음에 덮인다. ' +
      '수치가 커지는 방향의 고장이라 대시보드로는 절대 못 알아챈다.',
  },
  {
    name: '나라장터 계약 — 굳은 파라미터 판정이 코드 수정을 이긴다',
    file: 'src/features/marketing/api/nara-contract-collect.ts',
    find: '  if (Number(v || 0) !== NARA_PARAM_STATE_VERSION) return null',
    replace: '  void v',
    test: 'src/tests/unit/nara-contract-collect.test.ts',
    why:
      '레인이 측정한 파라미터 모드를 D1 에 굳히는데, 버전 잠금이 빠지면 **코드 기본값을 고쳐 배포해도 ' +
      'DB 의 옛 판정이 이겨 라이브가 안 변한다.** 인허가 레인에서 정확히 이 사고를 겪었고 ' +
      '(`LICENSE_STATE_VERSION` 이 그 수습이다) 원인을 찾는 데 하루가 갔다 — 배포는 초록불이었다.',
  },
  {
    name: '데모 추첨 자가치유가 발화 안 하는 cron 슬롯에 배선됨',
    file: 'src/worker/scheduled.ts',
    find: "    ctx.waitUntil(safeCron('demo-fcfs-renew', () => renewDemoFcfs(env)));",
    replace: "    if (cron === '0 * * * *') { ctx.waitUntil(safeCron('demo-fcfs-renew', () => renewDemoFcfs(env))); }",
    test: 'src/tests/unit/cron-slot-registered.test.ts',
    why:
      '숙박 데모 72개가 **추첨 배지 없이** 89,000원짜리 진짜 숙박권으로 보이고 있어 자가치유 백필을 ' +
      '`demo-fcfs-renew` 에 넣고 배포했는데 라이브가 그대로였다. 그 cron 이 `0 * * * *` 블록 안에 있고 ' +
      '그 표현식은 wrangler.toml crons 에 **없다**(3단계 보류) — 즉 한 번도 발화한 적이 없다(하트비트 ' +
      '실측: 시간당 32건이 전부 ads:* 별도 워커, 메인 워커 0건). **에러가 없어** 배포는 초록불이고 ' +
      '리뷰에도 안 걸린다. 짝인 check-cron-heartbeat 는 "safeCron 으로 감쌌는가"만 보므로 못 잡는다.',
  },
  {
    name: '서비스 지도가 낡아 공구 서비스 일을 유어딜 일로 오인',
    file: 'docs/design/urdeal-platform-model.md',
    find: '| **🏪 공구 서비스** (운영자 SaaS)',
    replace: '| ~~삭제된 행~~',
    test: 'src/tests/unit/service-map-currency.test.ts',
    why:
      '지도가 오래 3-서비스였고 도매몰을 여전히 "B2B 도매"로만 적어, 그 사이 도매몰 코드를 용도 변경해 ' +
      '만들어진 **공구 서비스**(운영자 SaaS)가 지도에 없었다. 2026-08-03 세션이 그 서비스의 오픈 차단 ' +
      '항목(미수령 고지·브랜딩·실결제)을 **"유어딜 일"로 대표에게 보고**했다 — 서로 다른 서비스의 할 일이 ' +
      '한 목록에 섞였고 대표가 바로잡았다. 지도는 세션이 "이건 어느 서비스인가"를 판단하는 유일한 근거다.',
  },
  {
    name: '결제수단을 카테고리로 정해 이용권이 카드 결제에서 빠짐',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: 'const { flow } = resolveProductFlow(detail)',
    replace: "const flow = isVoucherCategory(detail.category) ? 'voucher_deal' : 'group_buy_toss'",
    test: 'src/tests/unit/payment-flow-naming.test.ts',
    why:
      '결제수단 SSOT 는 `getProductFlow`(deal_only=1 → 딜 / group_buy_status=active → 카드)이고 ' +
      '**카테고리는 판정 기준이 아니다**. `meal_voucher` 인 김밥천국 할인권은 카드 결제다. ' +
      '2026-08-03 에 세션이 낡은 주석을 믿고 "이용권은 카드로 못 산다"고 대표에게 보고했고, ' +
      '그 결과 존재하는 테스트 상품을 두고 새로 만들라고 안내할 뻔했다. 카테고리로 판정하면 ' +
      '이용권 전체가 카드 결제에서 빠진다.',
  },
  {
    name: '데모 판정이 좁은 접두사로 되돌아가 새 데모 종류가 소비자에게 판매 상품으로 보임',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: "const DEMO_LAST = `(CASE WHEN ${demoSlugSql('p')} THEN 1 ELSE 0 END)`",
    replace: `const DEMO_LAST = "(CASE WHEN COALESCE(p.slug,'') LIKE 'demo-deal-%' THEN 1 ELSE 0 END)"`,
    test: 'src/tests/unit/demo-raffle-coverage.test.ts',
    why:
      '2026-08-03 실측: `demo-deal-` 접두사가 6군데에 하드코딩돼 있었고, 나중에 생긴 `demo-stay-*` 72개가 ' +
      '어디에도 안 걸렸다. 추첨 설정이 0이라 배지 렌더 `{fcfs && <FcfsBadge/>}` 가 아무것도 안 그렸고 ' +
      '소비자 눈엔 **89,000원짜리 진짜 숙박권**으로 보였다. 후순위 정렬에도 안 걸려 **피드 첫 50건을 전부 점유** ' +
      '(같은 시점 실상품은 3개뿐). 에러가 없어 몇 주간 아무도 몰랐다 — 대표가 화면을 보고 물어서 드러났다.',
  },
  {
    name: '심평원 수집이 마감선 없이 25초짜리 페이지를 3장 연다(67초, 최다)',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/ads-lane-deadlines-final.test.ts',
    why:
      '페이지 한 장이 `AbortSignal.timeout(25000)` 까지 버티고 무료 maxPages=3 ⇒ 최악 75초(+재시도 8초). ' +
      '실측 67초로 유어애즈 최다였다. 부모 cron 이 그걸 못 버티고 죽으면 매달린 자식이 전부 끌려간다. ' +
      '⚠️ per-fetch 25초는 다른 세션의 재시도 실험 변수라 건드리지 않는다 — 이 마감선은 페이지 수만 묶는다.',
  },
  {
    name: '야간 재스캔의 하위작업이 고정 순서라 마지막(naver)이 영구 미실행',
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    find: 'for (const idx of rotatedOrder(from, jobs.length))',
    replace: 'for (const idx of jobs.map((_, i) => i))',
    test: 'src/tests/unit/ads-lane-deadlines-final.test.ts',
    why:
      '하위작업 셋을 순차 실행하는데 마감선을 넣으면서 순서를 고정하면, 앞의 둘이 시간을 다 쓸 때 ' +
      '`naver` 는 매 회차 잘린다. **하루 1회 레인이라 그건 곧 영구 미실행이다.** ' +
      '`sweep-mx` 블록에서 겪은 것과 같은 구조적 기아 — 마감선과 회전은 짝이다.',
  },
  {
    name: '꼬리가 워커 금지 조합(동적 alias import)으로 되돌아감',
    file: 'src/worker-ads/tail-bound.ts',
    find: "const waited = resolvePlan(env as never) === 'paid' ? TAIL_WAIT_MS_PAID : TAIL_WAIT_MS",
    replace: "const { envPlanValue } = await import('@/features/marketing/api/collect-budget')\n  const waited = envPlanValue(undefined, TAIL_WAIT_MS, TAIL_WAIT_MS_PAID, env as never)",
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      'CLAUDE.md 가 금지하는 조합이다(워커에서 dynamic import + `@/` alias). 이 꼬리에서 던지면 ' +
      '**기록이 통째로 안 남아** 고치려던 고장과 증상이 같아진다 — 원인 규명이 한 바퀴 더 돈다. ' +
      '같은 폴더 `resolvePlan` 을 정적 상대 import 로 쓴다(`tick-history-write.ts` 와 동일).',
  },
  {
    name: '앞 단계가 던지면 요약·스탬프가 통째로 생략됨',
    file: 'src/worker-ads/tail-bound.ts',
    find: '  try {\n    await writeTickSummary(o.DB as never, o.at, o.hourUTC, judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats, o.env as never)\n  } catch { /* 스탬프까지는 남긴다 */ }',
    replace: '  await writeTickSummary(o.DB as never, o.at, o.hourUTC, judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats, o.env as never)',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '이 꼬리의 존재 이유가 **기록이 남는 것**이다. 대기·flush·요약 중 하나가 던져서 뒤가 생략되면 ' +
      '고장 그대로다(실제로 배포 첫 회차에 기록이 또 안 남았고, 원인 후보가 바로 이 취약성이었다).',
  },
  {
    name: '꼬리 상한이 25s 로 되돌아감(부모가 못 버티는 값)',
    file: 'src/worker-ads/tail-bound.ts',
    find: 'export const TAIL_WAIT_MS = 10_000',
    replace: 'export const TAIL_WAIT_MS = 25_000',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '25s 로는 밤사이 10회차 중 3회 꼬리가 안 돌았고 `cap` 이 4→2 로 되물러났다(2026-08-04 실측). ' +
      '상한이 있으면 최대 그만큼만 기다리므로, 그래도 못 남긴다는 건 **부모가 25s 조차 못 버틴다**는 뜻이다. ' +
      '값을 다시 올리려면 라이브 근거(이력 구멍 감소 실측)가 먼저 있어야 한다.',
  },
  {
    name: '회차 꼬리가 다시 무한정 기다림(학습기 갱신 자리가 통째로 사라짐)',
    file: 'src/worker-ads/tail-bound.ts',
    find: 'await Promise.race([Promise.all(tracked), deadline])',
    replace: 'await Promise.all(tracked)',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '`cap` 을 갱신하는 자리는 회차 꼬리 하나뿐인데, 띄운 레인이 전부 끝나기를 기다리면 부모가 못 버틸 때 ' +
      '요약도 학습도 **통째로 실행되지 않는다**. 실측: 이력이 09:00 KST 에서 5시간 정지했는데 디스패치 기록은 ' +
      '매 회차 정상이고 cron_failures 는 0이었다(예외 없이 잘려 실패로도 안 남는다). 그래서 학습기가 바닥 2 에 고착됐다.',
  },
  {
    name: '못 기다린 레인을 판정에 넘김 — 회차가 늘 해로움이 되는 부호 반대 고착',
    file: 'src/worker-ads/tail-bound.ts',
    find: 'judgedLaneNames(o.ranNames, r.settled)',
    replace: 'o.ranNames',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '`tickHarmed` 는 `fail + miss` 로 판정하고 `miss` 는 *띄웠는데 하트비트가 없는* 레인이다. ' +
      '상한을 넣고도 아직 도는 레인을 그대로 넘기면 전부 miss 로 잡혀 **모든 회차가 항상 해로움**이 된다 — ' +
      '고치려던 것과 **부호만 반대인 같은 고착**이다. 끝난 레인만 판정 대상이어야 한다.',
  },
  {
    name: '개명된 하트비트가 다시 게이트를 물어 영구 503 (사이트 다운 감지가 가려짐)',
    file: 'src/worker/utils/cron-beat-retirement.ts',
    find: "  if (raw.includes('?') && freshBaseNames.has(beatBaseName(raw))) return 'superseded'",
    replace: '  // (superseded 판정 제거)',
    test: 'src/tests/unit/cron-beat-retirement.test.ts',
    why:
      '하트비트 행은 레인보다 오래 산다. 개명·DO알람 인수된 이름은 아무도 갱신하지 않아 **영원히 stale** 이고, ' +
      '그러면 `/api/_healthcheck/cron` 이 영구 503 이 된다. 실측 피해가 크다: uptime 프로브가 그 503 을 ' +
      '"사이트 다운"과 같은 바구니로 세어, 장애 이슈 #845 가 6일째 열린 채 코멘트 84개가 쌓이는 동안 ' +
      '**진짜 다운을 감지할 수 없었다**. 이 주입은 그 회귀를 재현한다.',
  },
  {
    name: '기아 방지 슬롯 배선이 빠짐 — 미실행 키워드가 다시 무한 연기',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '  const rescue = pickStarvationRescue(kws, new Set(interleaved.map(p => p.id)))\n  const finalPicks = rescue ? [rescue, ...interleaved.slice(0, Math.max(0, totalPick - 1))] : interleaved',
    replace: '  const finalPicks = interleaved',
    test: 'src/tests/unit/ads-rotation-health.test.ts',
    why:
      '함수(`pickStarvationRescue`)가 있어도 **배선이 빠지면 아무 일도 안 한다** — 이 레포의 "코드에 있다 ≠ ' +
      '살아 있다" 클래스. 라이브 실측: 자동확장 키워드 24개가 생성 14.9일째 실행 0회(커서 거리 275 ≈ 10일 더). ' +
      'starved 경보가 실전에서 처음 잡은 사고의 수리 지점이라, 배선 소실 = 그 사고의 무음 재발이다.',
  },
  {
    name: '순환 경보가 다시 "해제될 수 없는" 임계로 회귀',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: 'export const ROTATION_STARVE_CYCLES = 3',
    replace: 'export const ROTATION_STARVE_CYCLES = 2',
    test: 'src/tests/unit/ads-rotation-health.test.ts',
    why:
      '이 경보의 병은 "안 울리는 것"이 아니라 **꺼질 수 없는 것**이었다(임계 2일 < 한 바퀴 6.5일 → 완벽해도 80% 가 걸림). ' +
      '배수를 실측 최악(2.21바퀴)보다 낮추면 정상 상태가 다시 경보가 된다 — 매일 울리는 경보는 곧 안 읽히는 경보다. ' +
      '이 주입은 그 회귀를 재현한다.',
  },
  {
    name: '매시간 레인이 gap 없이 등록돼 침묵 판정에서 통째로 빠짐',
    // 🔁 2026-08-03: 조립이 `lane-cadence.laneCadenceFields` 로 추출되면서 이 줄이 이사했다
    //   (같은 필드가 미루기 판정에도 쓰여 매시간 레인을 통째로 `always` 로 만들던 것을 끊으면서).
    //   불변식은 그대로다 — **기본값 없이 undefined 를 그대로 넘기면** 그 레인이 침묵 판정에서 빠진다.
    file: 'src/worker-ads/lane-cadence.ts',
    find: '  const gapMin = opts?.gap ?? hourlyGapMinutes()',
    replace: '  const gapMin = opts?.gap as number',
    test: 'src/tests/unit/ads-lane-gap-judgeable.test.ts',
    why:
      '자식 하트비트(`writeSelfBeat`)는 설계상 cron 식을 안 싣고 부모가 넘긴 `gap` 만 믿는데, ' +
      '자식 쓰기가 **나중**이라 부모가 실어 둔 `cron` 을 덮는다. 둘 다 없으면 `getCronHealth` 가 ' +
      '그 레인을 `missing` 으로 빼고 stale 검사를 **안 한다** — 게다가 `missing` 은 `ok` 를 안 깬다. ' +
      '⇒ 그 레인은 조용히 멈춰도 dead-man\'s switch 가 초록이다. 실측: `ads:sweep-kakao-chain`(매시간 17초)이 ' +
      '정확히 그 상태였고, "안 도는 것"과 "판정 대상이 아닌 것"이 화면에서 똑같이 생겼다.',
  },
  {
    name: '요금제 유료값을 만들어 놓고 선택부를 안 붙임(파일 경계를 넘는 배선)',
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    find: 'envPlanValue(undefined, RESCAN_DEADLINE_MS, RESCAN_DEADLINE_MS_PAID, env)',
    replace: 'RESCAN_DEADLINE_MS',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why:
      '상수를 만드는 것과 **그 상수가 선택되는 것**은 다른 일이다 — 후자가 빠지면 유료로 바꿔도 ' +
      '그 축은 안 오르고 **에러는 안 난다**. 이 항목은 특히 **선언과 선택이 다른 파일**인 경우를 고정한다: ' +
      '600줄 캡 때문에 회전 정책을 모듈로 뺀 순간 파일-지역 판정이 오탐을 냈고, 그 교정판의 첫 시도는 ' +
      '`import` 줄에 남은 이름 때문에 **주입에도 초록**이 떴다(텍스트 존재는 구조의 증거가 아니다).',
  },
  {
    name: '회전 커서를 읽어 놓고 항상 0번부터 시작(회전이 죽음)',
    file: 'src/features/marketing/api/rescan-rotation.ts',
    find: 'const start = normalizeOrder(String(from), len)',
    replace: 'const start = 0',
    test: 'src/tests/unit/ads-lane-deadlines-final.test.ts',
    why:
      '배선(호출)은 남아 있는데 산술만 죽으면 **텍스트 검사는 통과**한다 — 위 항목이 못 보는 자리다. ' +
      '그래서 회전은 문자열이 아니라 **동작**으로도 검증한다(회차당 1개만 돌아도 3회차에 셋 다 선두를 받는가).',  },
  {
    name: '주간 D1 백업이 인덱스/트리거/뷰를 안 담아 복구본에서 멱등 UNIQUE 가 사라짐',
    file: 'src/worker/cron/d1-backup.ts',
    find: 'if (objects.length > 0) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/d1-backup-restorable.test.ts',
    why:
      '덤프가 `type=\'table\'` 만 뽑던 시절의 동작이다. 프로덕션 실측 인덱스 610(UNIQUE 46) · 트리거 7 · 뷰 1 이 ' +
      '전부 백업에서 빠지고, 복구하면 `INSERT OR IGNORE + partial UNIQUE` 로 지키던 멱등(머니 룰 #3)이 없어져 ' +
      '**같은 ref 로 두 번 적립이 통과**한다(2026-08-03 축소판 복구 리허설에서 재현). 백업은 ok=true 로 성공하고 ' +
      '복구 검증 쿼리도 행 수만 세므로 **어디서도 빨간불이 안 뜬다** — 그래서 테스트로 박았다.',
  },
  {
    name: 'FTS5 그림자 테이블을 덤프에 실어 BLOB 손상 + 매주 무결성 경고',
    file: 'src/worker/cron/d1-backup.ts',
    find: '.filter((n) => !isInternalTable(n) && !isFtsShadowTable(n, virtualTables))',
    replace: '',
    test: 'src/tests/unit/d1-backup-restorable.test.ts',
    why:
      '`products_fts` 는 외부콘텐츠(content=products) FTS 라 그림자 테이블은 색인 내부구조다. ' +
      '`_data`/`_docsize` 는 BLOB 이라 문자열로 뭉개지고, `_idx`/`_config` 와 D1 내부 `_cf_KV` 는 ' +
      'WITHOUT ROWID 라 `SELECT rowid` 가 실패해 dump 실패 테이블로 남는다. 복구 후 `rebuild` 한 번이면 ' +
      '색인은 원본에서 정확히 재생성되므로 깨진 그림자를 실어 나를 이유가 없다.',
  },
  {
    name: "dead-man's switch 의 의도된 503 을 5xx 로 세어 채널을 영구 점유",
    file: 'src/worker/middleware/error-rate-monitor.ts',
    find: "if (status === 503 && new URL(c.req.url).pathname === '/api/_healthcheck/cron') return;",
    replace: '',
    test: 'src/tests/unit/five-xx-observability.test.ts',
    why:
      '경로 계측을 붙이자 24시간 유일한 5xx 가 `/api/_healthcheck/cron` 이었다 — 고장이 아니라 ' +
      '**cron 침묵을 알리는 설계상 503** 이고, 외부 프로브가 10분마다 두드린다. 그걸 세면 5xx 채널이 ' +
      '영구 점유돼 **진짜 5xx 가 와도 구분이 안 된다**(같은 PR 이 고친 거짓 경보와 같은 클래스). ' +
      '침묵 자체는 uptime.yml + 자가진단이 각자 채널로 이미 보고하므로 여기서 빼도 잃는 정보가 없다.',
  },
  {
    name: '5xx 경보가 1건을 "스파이크"라 불러 매일 거짓 ⚠️ 를 냄',
    file: 'src/worker/cron/daily-self-diagnostic.ts',
    find: 'if (Number(row?.worst || 0) >= 10) issues.push',
    replace: 'if (true) issues.push',
    test: 'src/tests/unit/five-xx-observability.test.ts',
    why:
      '실측상 모든 창이 `count=1`(시간당 1건)인데 화면엔 ⚠️ 로 떴다. 스파이크 임계는 10/분이므로 ' +
      '그건 스파이크가 아니다 — 거짓 경보이고, **진짜 스파이크가 왔을 때 구분이 안 된다.** ' +
      '임계 미만은 정보로 남기고 🔴 는 실제로 넘었을 때만 올린다.',
  },
  {
    name: '5xx 경보에 무엇이 실패했는지가 없어 조치 불가',
    file: 'src/worker/middleware/error-rate-monitor.ts',
    find: "VALUES (?, '5xx_path', ?, 1)",
    replace: "VALUES (?, 'x', ?, 1)",
    test: 'src/tests/unit/five-xx-observability.test.ts',
    why:
      '이 표엔 숫자만 있었다(`key=global`). "5xx 가 있었다"는 알아도 **어디서** 났는지 알 수 없어 ' +
      '경보를 받고도 손에 쥔 것이 없었다. `key` 에 경로를 넣어 같은 표·같은 인덱스로 분포를 얻는다 ' +
      '(스파이크 판정은 global 합계 그대로 — 경로가 갈려도 잡힌다).',
  },
  {
    name: '카카오 전화 스윕이 마감선 없이 회차를 늘림(31초, 침묵 1위)',
    file: 'src/features/marketing/api/company-collect.ts',
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/ads-lane-deadlines.test.ts',
    why:
      '예산(`budget.left`)은 **요청 수**만 세고 응답이 얼마나 걸리는지는 안 본다. 예산이 남아 있는 한 ' +
      '느린 카카오 조회가 계속 쌓여 부모 cron 의 CPU 를 태우고, 부모가 죽으면 매달린 자식이 전부 끌려간다.',
  },
  {
    name: 'MX 스윕이 블록 고정 순서라 두 번째 블록이 영구히 굶음',
    file: 'src/features/marketing/api/email-mx-sweep.ts',
    find: 'if (firstIsCompany) { await runCompany(); await runProspects() }',
    replace: 'await runCompany(); await runProspects()',
    test: 'src/tests/unit/ads-lane-deadlines.test.ts',
    why:
      '마감선은 일을 줄이는 게 아니라 **미루는** 것이다. 블록 ①→② 순서가 고정이면 ①에서 마감선에 ' +
      '걸릴 때 ②(매장 후보)는 **매 회차 한 번도 안 돌아** `cursorS` 가 영원히 멈춘다. ' +
      '마감선을 넣으면서 이 회전을 빼면 **없던 기아를 새로 만드는 것**이다.',  },
  {
    name: '공고 스캐너가 마감선 없이 회차를 늘려 부모 CPU 를 태움',
    file: 'src/features/marketing/api/notice-scan.ts',
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/notice-scan-deadline.test.ts',
    why:
      '이 레인은 실측 31초(cpu_risk=danger)였는데 예산 20 에 실제 호출은 6번뿐이라 **예산이 한 번도 안 걸린다**. ' +
      '비용은 요청 수가 아니라 시간인데 시간을 재는 것이 없었다 — 공공 API 하나가 15초까지 버티니 최악 90초다. ' +
      '부모 cron 이 그걸 못 버텨 자식을 끌고 죽는다(`dispatch-budget.ts` 가 기록한 그 구조).',
  },
  {
    name: '마감선만 넣고 회전을 빼 뒤쪽 키워드가 영원히 굶음',
    file: 'src/features/marketing/api/notice-scan.ts',
    find: 'const kw = KEYWORDS[(kwFrom + i) % KEYWORDS.length]',
    replace: 'const kw = KEYWORDS[i]',
    test: 'src/tests/unit/notice-scan-deadline.test.ts',
    why:
      '마감선은 일을 줄이는 게 아니라 **미루는** 것이다. 시작점을 고정하면 매 회차 같은 앞쪽만 돌고 ' +
      '뒤쪽 키워드는 **한 번도** 조회되지 않는다 — 레인 단위에서 이미 겪은 구조적 기아를 키워드 단위에서 ' +
      '반복하는 셈이다. 마감선과 회전 커서는 반드시 같이 간다.',
  },
  {
    name: '주간 백업이 products·sellers 를 조용히 빼먹음(커서 한 칸이 컬럼 한도 초과)',
    file: 'src/worker/cron/d1-backup.ts',
    find: 'SELECT * FROM ${table} WHERE ${pk} > ?',
    replace: 'SELECT rowid, * FROM ${table} WHERE ${pk} > ?',
    test: 'src/tests/unit/d1-backup-wide-tables.test.ts',
    why:
      'D1 결과 컬럼 한도는 100 인데 `products`·`sellers` 는 **이미 정확히 100컬럼**이다. ' +
      '페이징용 `rowid` 한 칸을 더하면 101 이 되어 `too many columns in result set` 으로 ' +
      '**그 두 테이블만** dump 에서 통째로 빠진다. 2026-08-03 첫 회차가 그렇게 나갔다 — ' +
      '파일은 19MB 로 멀쩡해 보였고 알림도 "완료"였다. 그 백업으로 복구하면 상품도 셀러도 없다.',
  },
  {
    name: '백업 실패를 catch 가 삼켜 하트비트에 ok:true 로 남음',
    file: 'src/worker/cron/d1-backup.ts',
    find: 'throw err instanceof Error ? err : new Error(msg);',
    replace: 'return { success: false, error: msg };',
    test: 'src/tests/unit/d1-backup-wide-tables.test.ts',
    why:
      '`safeCron` 은 **예외가 나야** ok:false 를 남기고 cron_failures 에 기록한다. 그냥 반환하면 ' +
      '실패한 백업이 하트비트에서 성공처럼 보인다 — 재해복구에서 이건 가장 나쁜 거짓말이다. ' +
      '같은 파일의 `BACKUP_BUCKET` 미바인딩이 2026-06-12 에 throw 로 바뀐 것과 같은 이유.',
  },
  {
    name: '이용권 정산이 없는 컬럼(products.commission_rate)을 읽어 회차 전체가 죽음',
    file: 'src/worker/cron/auto-settlement.ts',
    find: 'COALESCE(s.commission_rate, ?)',
    replace: 'COALESCE(p.commission_rate, ?)',
    test: 'src/tests/unit/auto-settlement-rail-a.test.ts',
    why:
      '`products` 에 `commission_rate` 는 **존재한 적이 없다**(프로덕션 pragma 0 · baseline 97컬럼에도 없음). ' +
      '그래서 이 SELECT 는 매일 03:00 KST 에 `no such column` 으로 던지고 정산 회차가 통째로 죽었다. ' +
      '셀러별 수수료의 SSOT 는 `sellers.commission_rate` 다. SELECT 절은 `check-sql-column-exists` 의 ' +
      '**명시된 사각지대**(JOIN/alias 복잡도로 skip)라 정적 가드가 못 봤다 — 그래서 테스트로 박았다.',
  },
  {
    name: '정산 cron 이 Rail A 를 스스로 프로비저닝해 이중지급을 깨움',
    file: 'src/worker/cron/auto-settlement.ts',
    find: 'if (!(await railAProvisioned(DB))) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/auto-settlement-rail-a.test.ts',
    why:
      'Rail A(`restaurant_settlements`)는 프로덕션에 **테이블조차 없다** — 한 행도 만든 적이 없다. ' +
      '실제 지급은 Rail B(원장→payouts)가 한다. 여기서 게이트를 없애면 과거 사용분 전체가 Rail A 에 ' +
      '한꺼번에 적재되고, 두 레일은 서로의 멱등 마커를 안 보므로 **같은 매출을 두 번 지급**한다. ' +
      '`settlement-reconciliation.md` §Severe 3 이 머니 경로로 파킹해 둔 자리다.',
  },
  {
    name: '컬럼 가드의 SELECT 패스가 보간 쿼리를 통째로 건너뛰어 헛돎',
    file: 'scripts/check-sql-column-exists.mjs',
    find: "      let prev\n      do { prev = stmt; stmt = stmt.replace(/\\$\\{[^{}]*\\}/g, ' ') } while (stmt !== prev)",
    replace: '      continue',
    test: 'src/tests/unit/auto-settlement-rail-a.test.ts',
    why:
      '첫 구현이 `${}` 보간을 보면 statement 를 건너뛰었는데, **이 사건의 원본 쿼리**' +
      '(`auto-settlement` 의 `${ledgerSkipClause}`)가 정확히 그 형태라 주입 검증에서 초록이 떴다. ' +
      '보간 조각만 지우고 나머지 리터럴은 검사해야 한다 — 안 그러면 SELECT 패스를 붙여 놓고도 ' +
      '정작 그것 때문에 만들어진 결함을 못 본다.',
  },
  {
    name: '일일 진단이 캐리어에 없는 Pages 전용 키로 매일 거짓 🔴 를 냄',
    file: 'src/worker/cron/daily-self-diagnostic.ts',
    find: 'const carrierKeys = [...new Set(',
    replace: "const carrierKeys = ['JWT_SECRET', ...new Set(",
    test: 'src/tests/unit/diagnostic-carrier-scope.test.ts',
    why:
      '`JWT_SECRET`·`REFRESH_TOKEN_SECRET`·`KAKAO_REST_API_KEY` 는 **Pages** 에 있고 cron 캐리어엔 ' +
      '없는 게 정상인데, 진단이 자기 env 에서 찾아 매일 🔴 3건을 냈다(라이브 `/api/version` 은 셋 다 present). ' +
      '거짓 경보 옆에 진짜가 섞이면 구분이 안 된다 — 늑대소년은 알림을 켜는 순간이 아니라 이미 시작돼 있었다.',
  },
  {
    name: '매장 보강이 크롤 불가 URL 에 슬롯을 낭비함',
    file: 'src/features/marketing/api/prospect-enrich.ts',
    find: '${COOL} AND ${platformNot}',
    replace: '${COOL}',
    test: 'src/tests/unit/prospect-enrich-platform-url.test.ts',
    why:
      '이 레인은 회차당 **8건**만 처리하는데(deadline) 실측상 그중 **4건이 차단 호스트**(인스타·블로그·카페)였다. ' +
      '소상공인의 홈페이지가 대부분 그것이라 이메일이 구조적으로 없는데 LIMIT 슬롯과 예산은 똑같이 먹는다 — ' +
      '진짜 사이트가 영영 안 뽑힌다. 파트너 레인이 07-28 에 같은 실측으로 이미 받은 처방이다.',
  },
  {
    name: '무수확 판정이 풀 포화를 고장으로 오인(오경보)',
    file: 'src/features/marketing/api/lane-yield-health.ts',
    find: 'if (totalSaved > 0 && found === 0 && err)',
    replace: 'if (totalSaved > 0 && err)',
    test: 'src/tests/unit/lane-yield-health.test.ts',
    why:
      '발굴은 되는데 저장이 0 인 것은 **정상**이다(풀 포화 = 전부 중복). `found` 조건을 빼면 그 회차가 ' +
      '매번 고장으로 신고돼 경보가 신뢰를 잃는다. ⚠️ 이 항목의 첫 픽스처엔 `diag.error` 가 없어 ' +
      '**주입해도 초록불이었다** — "가드가 막는다는 그 경우"가 픽스처에 실재해야 한다는 것을 직접 증명했다.',
  },
  {
    name: '후보 경로 프로브가 임의 호스트를 허용(SSRF)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    // 2026-08-02: 호스트가 단수 상수 → **열거 목록**이 되어 지도를 갱신했다.
    // 2026-08-03: 표준데이터 게이트웨이(`api.data.go.kr`)를 넓히며 또 갱신 — 두 번 다
    //   ⚠️ **갱신을 알려 준 게 이 검사 자신이다**("낡은 지도" 모드가 실제로 일하고 있다는 증거).
    find: "export const PROBE_ALLOWED_HOSTS = ['apis.data.go.kr', 'www.localdata.go.kr', 'api.data.go.kr'] as const",
    replace: "export const PROBE_ALLOWED_HOSTS = ['apis.data.go.kr', 'www.localdata.go.kr', 'api.data.go.kr', 'evil.example.com'] as const",
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '어드민 인증이 있어도 임의 URL 을 받으면 서버측 요청 위조다 — 내부 메타데이터 주소(169.254.169.254)까지 ' +
      '우리 워커 이름으로 찌를 수 있게 된다. 호스트는 **열거된 정부 도메인으로 고정**한다(리터럴 목록 + `.go.kr` 경계 이중).',
  },
  {
    name: '프로브 URL 이 레인 상수와 갈라짐(거짓말하는 프로브)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: 'B551182/hospInfoServicev2/getHospBasisList',
    replace: 'B551182/hospInfoServiceXX/getHospBasisList',
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '프로브가 레인과 **다른 주소**를 찌르면 "프로브는 초록인데 레인은 죽는다"가 되어 진단이 오히려 오도한다. ' +
      '진단 도구의 유일한 가치는 레인과 같은 것을 본다는 것이다.',
  },
  {
    name: '프로브가 레인과 **다른 오퍼레이션**을 찌름(서비스명만 같음)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    // ⚠️ 2026-08-05: 프로브가 문자열 대신 **레인 상수를 import** 하게 바뀌었다(두 벌이면 갈라지므로).
    //   그래서 주입도 "상수를 쓰지 말고 옛 문자열을 도로 박는다" 형태여야 같은 사고를 재현한다.
    find: '`${FRANCHISE_BASE}/${FRANCHISE_OP}?serviceKey=',
    replace: '`https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandReleaseInfo?serviceKey=',
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '2026-08-02 라이브에서 실제로 일어난 일이다. 기존 대조는 **서비스명**(FftcBrandRlsInfo2_Service)만 봐서 ' +
      '오퍼레이션이 다른 것을 통과시켰고, 레인은 HTTP 404 · 프로브는 400 NO_OPENAPI_SERVICE_ERROR 로 **다른 답**을 ' +
      '받았다. 그 400 을 근거로 "서비스가 폐기됐다"고 결론 낼 뻔했다 — 진단 도구가 오진의 재료가 되는 최악의 모양이다.',
  },
  {
    name: '전진 0 가드가 헛돎(신규를 통과시킴)',
    file: 'scripts/check-cursor-after-loop.mjs',
    find: 'if (TIME_BOUND.test(body)) continue               // 시간 상한이 있다 — 통과',
    replace: 'if (true) continue',
    test: 'src/tests/unit/ads-cursor-after-loop-guard.test.ts',
    why:
      '이 가드가 막는 실패는 **에러가 안 보인다** — 하트비트는 "느린가 보다"로 읽히고 저장 0 의 이유가 ' +
      '커서 미전진이라는 건 코드를 열어야 안다. 판정을 무력화하면 신규 레인이 그대로 통과해 ' +
      '**세 번째 전진 0** 이 조용히 생긴다(이미 commerce·quality 두 번 났다).',
  },
  {
    name: '전화 매칭이 대표번호를 통과시킴(남의 매장에 본사 이메일)',
    file: 'src/features/marketing/api/registry-phone-match.ts',
    find: '  if (!d || isSharedLine(d)) return null',
    replace: '  if (!d) return null',
    test: 'src/tests/unit/registry-phone-match.test.ts',
    why:
      '1588·1544·080 같은 대표번호는 **한 번호에 매장이 수백 개**다. 그대로 이으면 전혀 다른 매장에 ' +
      '본사 이메일이 붙고, 잘못 붙은 주소로 보낸 메일은 **반송·스팸신고**가 되어 도메인 평판을 깎는다 — ' +
      '그건 되돌리기 어렵다. 이 필터가 이 기능의 안전장치 절반이다.',
  },
  {
    name: '전화 매칭이 모호한 다중 매칭을 통과시킴',
    file: 'src/features/marketing/api/registry-phone-match.ts',
    find: "  if (emails.length > 1) return { skip: 'ambiguous_phone' }",
    replace: '  // (removed)',
    test: 'src/tests/unit/registry-phone-match.test.ts',
    why:
      '같은 번호에 서로 다른 이메일이 둘 이상이면 **어느 쪽인지 모른다**. 아무거나 고르면 절반은 틀린다 — ' +
      '연락처 품질은 양보다 정확도가 먼저다(틀린 주소 하나가 도메인 전체를 깎는다).',
  },
  {
    name: '두 사업 명단이 보류(연락처 없음)까지 셈',
    file: 'src/features/marketing/api/company-breakdown.ts',
    find: 'WHERE merged_into IS NULL AND active = 1',
    replace: 'WHERE merged_into IS NULL',
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '화면 맨 위의 두 숫자는 **"지금 제안을 보낼 수 있는 수"** 다. 보류(active=0 = 연락처 없어 제외된 행)를 ' +
      '섞으면 17만 총계와 다를 바 없어지고, 대표가 그 숫자를 믿고 명단을 뽑으면 **보낼 수 없는 행이 섞여 나온다.**',
  },
  {
    name: '페이백 명단을 전화로도 셈(이메일 발송인데)',
    file: 'src/features/marketing/api/company-breakdown.ts',
    find: "SUM(CASE WHEN category = '온라인판매' AND email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS payback_ready",
    replace: "SUM(CASE WHEN category = '온라인판매' AND phone IS NOT NULL THEN 1 ELSE 0 END) AS payback_ready",
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '두 사업은 **도달 채널이 다르다** — 페이백은 이메일 발송이라 전화만 있는 행은 명단이 아니고, ' +
      '대행사는 전화도 채널이다. 이 구분이 무너지면 숫자는 커지는데 실제로 보낼 수 있는 건 줄어든다.',
  },
  {
    name: '루트별 수율이 총계로 뭉개짐(어디에 예산 쓸지 못 봄)',
    file: 'src/features/marketing/api/store-prospects.ts',
    find: "SUM(CASE WHEN (phone IS NOT NULL AND phone != '') OR (email IS NOT NULL AND email != '') THEN 1 ELSE 0 END) AS with_any",
    replace: 'COUNT(*) AS with_any',
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '총계만 보면 "5만 건 모았다"로 읽힌다. 실측은 `neis_academy` 49,315건에 **이메일 7건**이고 ' +
      '대표 우선업종은 **0건**이라는 전혀 다른 이야기를 한다 — 둘 다 총계로는 안 보인다. ' +
      '⚠️ 이 항목의 첫 시험은 파일 전체에서 컬럼명을 찾아 **주입해도 초록불이었다**(같은 이름이 다른 쿼리에도 있다). ' +
      '"가드가 막는다는 그 자리"로 범위를 좁혀야 실제로 깨진다.',
  },
  {
    name: '내보내기가 화면 필터를 무시(손에 안 잡히는 지표)',
    file: 'src/features/marketing/api/partner-pool.routes.ts',
    find: 'listCompanyLeads(adsLeadsDb(c.env), { ...filter, limit: EXPORT_MAX })',
    replace: 'listCompanyLeads(adsLeadsDb(c.env), { limit: EXPORT_MAX })',
    // 2026-08-03: 파싱이 `pool-export.ts` 로 이동했지만 **넘기는 지점**은 여전히 여기다(지도 유효).
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '이 DB 의 성공 지표는 총 인원이 아니라 **"제안 보낼 수 있는 리드 수"** 다. 화면은 그 정의로 세는데 ' +
      '내보내기가 안 따르면 지표가 **화면에만 있고 손에는 안 잡힌다** — 실측상 파트너 풀은 이메일 보유가 12%뿐이라 ' +
      '무필터 5,000행에 실제 발송 가능분은 ~600건이고 보류(active=0)까지 섞인다.',
  },
  {
    name: '내보내기 조립이 목록과 두 벌로 갈라짐',
    file: 'src/pages/admin/AdminStoreProspectsPage.tsx',
    find: 'store-prospects/export?${buildQuery().toString()}',
    replace: 'store-prospects/export',
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '매장 풀은 **95%가 학원**이다(인허가 레인 사망으로 음식점·카페·미용·숙박 0). 화면 필터가 파일까지 ' +
      '안 이어지면 대표 우선업종은 **내보내기로 도달 자체가 불가능**하다 — 서버만 고치고 화면을 안 고치면 ' +
      '정확히 그 상태로 되돌아간다.',
  },
  {
    name: '품질 패스가 시간 상한을 잃음(전진 0 복귀)',
    file: 'src/features/marketing/api/influencer-quality.ts',
    find: "    if (Date.now() - t0 >= deadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/ads-quality-deadline.test.ts',
    why:
      '상한이 **행 수(8,000)뿐**이라 한 인보케이션이 16페이지를 통째로 채점하다 CPU 한도로 죽었다(`ms=3649`). ' +
      '🩸 재분류보다 나쁘다 — **커서 저장이 루프 뒤**라 죽으면 그 줄에 도달하지 못하고 다음 회차가 같은 지점을 ' +
      '또 훑고 또 죽는다 ⇒ **영원히 전진 0**(통신판매에서 확정된 그 실패 모양).',
  },
  {
    name: '품질 패스 마감선 중단이 done=true 로 커서를 리셋',
    file: 'src/features/marketing/api/influencer-quality.ts',
    find: "if (Date.now() - t0 >= deadlineMs) { stoppedBy = 'deadline'; break }",
    replace: 'if (Date.now() - t0 >= deadlineMs) { done = true; break }',
    test: 'src/tests/unit/ads-quality-deadline.test.ts',
    why:
      '`done` 은 "한 바퀴 다 돌았다" 는 뜻이고 커서를 **0 으로 리셋**한다. 시간 때문에 멈춘 것을 완주로 표시하면 ' +
      '매 회차가 처음부터 다시 돌아 **풀 뒷부분은 영영 채점되지 않는다** — 조용히, 에러 없이.',
  },
  {
    name: '재분류 패스 루프가 마감선을 잃음(매시간 CPU 사망 복귀)',
    // 🗺️ 2026-08-05 앵커 이사 — 본문이 `reclassify-lane.ts` 로 추출됐다(위 CPU 상한 항목과 동일).
    file: 'src/features/marketing/api/reclassify-lane.ts',
    // 🗺️ 2026-08-04 앵커 갱신 — 같은 줄에 **행 총량 조건이 추가**됐다(`rows < maxRows`). 옛 앵커를
    //   그대로 두면 주입 대상을 못 찾아 이 불변식이 조용히 사라진다(가드가 실제로 그렇게 잡았다).
    //   지우는 건 여전히 **시간 조건만** — 행 조건은 별도 항목(`CPU 상한 — 재분류가 …`)이 지킨다.
    find: 'passes < 5 && !last.done && rows < maxRows && Date.now() - t0 < deadlineMs',
    replace: 'passes < 5 && !last.done && rows < maxRows',
    test: 'src/tests/unit/ads-reclassify-deadline.test.ts',
    why:
      '이 레인은 **매시간 CPU 한도로 죽고 있었다**(`ok=false ms=3880`). 5패스 × 1,000행 × 행당 정규식 ~20개 = ' +
      '10만 회를 한 인보케이션에서 돈다 — `ads-cpu-work-cap` 이 세운 교리(*"페이지가 아니라 인보케이션당 총량"*)를 ' +
      '**호출부**가 어긴 것이다. 커서가 이어받으므로 일찍 멈춰도 커버리지 손실은 0 이다. ' +
      '⚠️ 08-04 실측에서 이 마감선만으론 부족함이 확인됐지만(`ms=1316` 에 마감선 1,800ms 를 못 닿고 사망) ' +
      '**빼면 안 된다** — D1 이 느린 회차는 행 수가 아니라 시간이 먼저 닿는다(둘은 병행 안전판이다).',
  },
  {
    name: '미사용 env 신고가 평상시에도 울림(경보 신뢰 상실)',
    file: 'src/worker-ads/env-drift.ts',
    find: "return u.length ? { env_unused: u.join(',') } : {}",
    replace: "return { env_unused: u.join(',') }",
    test: 'src/tests/unit/ads-env-drift.test.ts',
    why:
      '이상 없을 때도 키가 붙으면 하트비트 사유줄이 매 회차 오염되고, 진짜 신호가 그 안에 묻힌다. ' +
      '이 레포가 무수확 레인 판정에서 배운 것과 같다 — **평상시 조용하지 않은 경보는 아무도 안 본다.**',
  },
  {
    name: '미사용 env 목록이 낡음(새 노브를 오신고)',
    file: 'src/worker-ads/env-drift.ts',
    find: "'ADS_HIRA_ROWS',",
    replace: '',
    test: 'src/tests/unit/ads-env-drift.test.ts',
    why:
      '목록은 **코드가 읽는 키의 SSOT** 다. 새 노브를 코드에 넣고 목록에 안 넣으면 런타임이 그 키를 ' +
      '"설정했는데 안 쓰임"으로 **오신고**한다 — 정상 설정을 결함으로 부르는 순간 이 신호는 죽는다. ' +
      '(첫 작성에서 내가 손으로 적다가 실제로 64개를 빠뜨렸고, 이 시험이 즉시 잡았다.)',
  },
  {
    name: '표준데이터 호스트가 키를 못 받음(SERVICE_KEY_IS_NULL)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: "export const PORTAL_KEY_HOSTS = ['apis.data.go.kr', 'api.data.go.kr'] as const",
    replace: "export const PORTAL_KEY_HOSTS = ['apis.data.go.kr'] as const",
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '판정이 단일 호스트 비교였을 때 같은 포털의 표준데이터 게이트웨이(`api.data.go.kr`, ‘s’ 없음)가 조건에서 ' +
      '빠져 **키 없이 나갔고** 라이브가 `SERVICE_KEY_IS_NULL`(code 20)로 답했다. 그러면 *"우리 키가 이 데이터셋에 ' +
      '열려 있는가"* 를 영영 판정 못 한다 — **이 프로브의 존재 이유가 바로 그 판정인데 스스로 막고 있었다.** ' +
      '상권/상인회 축의 유일한 연락처 소스가 이 호스트에만 있다.',
  },
  {
    name: '전통시장 레인이 금지 파라미터를 실어 보냄',
    file: 'src/features/marketing/api/market-collect.ts',
    find: '&numOfRows=${rows}&type=json`',
    replace: '&numOfRows=${rows}&pageIndex=${page}&type=json`',
    test: 'src/tests/unit/market-collect.test.ts',
    why:
      '표준데이터 게이트웨이는 모르는 파라미터를 **거부**한다(`INVALID_REQUEST_PARAMETER_ERROR (pageIndex)`). ' +
      '다른 레인을 베끼다 "혹시 몰라" 한 줄 얹으면 **인증까지 통과한 요청이 죽는다** — 그리고 그 실패는 ' +
      '`found:0` 으로만 보여서 주소 문제로 오진하게 된다.',
  },
  {
    name: '전통시장 전화 필드 매핑이 끊김(연락 불가 명단이 된다)',
    file: 'src/features/marketing/api/market-collect.ts',
    find: "g(it, 'phoneNumber') || null",
    replace: "null",
    test: 'src/tests/unit/market-collect.test.ts',
    why:
      '상권 축에서 **전화가 이 소스의 존재 이유**다(나머지 세 소스는 연락처가 아예 없다). 필드명이 어긋나면 ' +
      'HTTP 200 에 행까지 오는데 **연락 불가 명단**만 쌓인다 — 인허가에서 실제로 당한 클래스(200 은 성공이 아니다).',
  },
  {
    name: '표준데이터에 모르는 파라미터를 실어 보냄(INVALID_REQUEST_PARAMETER)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: "  return host === 'api.data.go.kr' ? 'std' : 'both'",
    replace: "  return 'both'",
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '게이트웨이마다 **모르는 파라미터를 대하는 태도가 다르다.** 기관별 서비스는 조용히 무시하지만 ' +
      '표준데이터는 거부한다 — 라이브가 `INVALID_REQUEST_PARAMETER_ERROR (pageIndex)` 로 말해 줬다. ' +
      '즉 인증·주소가 다 맞은 요청을 **우리 편의 문법이 죽인다**(진단 도구가 스스로 만든 실패). ' +
      '상권 축의 유일한 연락처 소스가 이 게이트웨이에 있다.',
  },
  {
    name: '인허가 경로에서 오퍼레이션(/info)이 사라짐',
    file: 'src/features/marketing/api/license-url.ts',
    find: "export const LICENSE_OPERATION = 'info'",
    replace: "export const LICENSE_OPERATION = ''",
    test: 'src/tests/unit/license-url-variant.test.ts',
    why:
      '이 한 칸이 없어서 인허가 레인 전체가 며칠간 0건이었다. 게이트웨이는 `NO_OPENAPI_SERVICE_ERROR`(code 12)로 ' +
      '답하는데 그 코드는 **폐기와 경로 오타를 구분하지 못한다** — 실제로 이전 세션이 "서비스 폐기 확정"이라고 ' +
      '오판했다. 대표 우선업종(음식점·카페·미용·숙박)이 통째로 이 경로에 달려 있다.',
  },
  {
    name: '낡은 변종 판정을 그대로 믿음(옛 형태에 영구히 갇힘)',
    file: 'src/features/marketing/api/license-url.ts',
    find: 'return Number(state.v || 0) === LICENSE_STATE_VERSION ? state : null',
    replace: 'return state',
    test: 'src/tests/unit/license-url-variant.test.ts',
    why:
      '라이브 DB 에 **주소가 틀렸던 시절의 판정**(`{"id":"v1"}` + code 12 실패 이력)이 남아 있었다. 저장된 값이 ' +
      '항상 이기므로 기본값을 고쳐도 안 지워지고, 프로브는 *실패했을 때만* 도는데 경로가 고쳐진 뒤로는 v1 도 ' +
      '200 을 받는다(페이징 키가 조용히 무시될 뿐) → 실패가 없다 → 프로브가 안 돈다 → **영원히 v1**. ' +
      '에러 없이 같은 페이지만 긁는 "조용한 전진 0" 이다.',
  },
  {
    name: '인허가 기본 후보가 무시되는 페이징 키로 되돌아감',
    file: 'src/features/marketing/api/license-url.ts',
    find: "{ id: 'v4', pageParam: 'pageNo', sizeParam: 'numOfRows'",
    replace: "{ id: 'v4', pageParam: 'pageIndex', sizeParam: 'pageSize'",
    test: 'src/tests/unit/license-url-variant.test.ts',
    why:
      '라이브 응답 봉투가 `{"numOfRows":…,"pageNo":…}` 를 echo 한다 = 이 둘이 실제로 읽히는 키다. ' +
      '`pageIndex`/`pageSize` 는 같이 보내도 **조용히 무시**되므로 그쪽으로 되돌리면 **200 을 받으면서 ' +
      '영원히 1페이지만** 긁는다 — 에러가 없어 안 보이는 실패(이 레포가 "조용한 전진 0"이라 부르는 것).',
  },
  {
    name: '인허가 대문자 필드 별칭이 사라짐(200 인데 저장 0)',
    file: 'src/features/marketing/api/localdata-collect.ts',
    find: "g(it, 'mgtno', 'mgtNo', 'MNG_NO')",
    replace: "g(it, 'mgtno', 'mgtNo')",
    test: 'src/tests/unit/license-field-aliases.test.ts',
    why:
      '이관된 포털은 대문자 스네이크(`MNG_NO`/`BPLC_NM`/`TELNO`)를 쓴다. 옛 소문자 이름만 읽으면 ' +
      '**HTTP 200 에 실제 행이 와도** 전부 빈 문자열로 파싱돼 복합키가 성립하지 않고 행이 통째로 버려진다. ' +
      '경로만 고치고 이걸 빠뜨리면 증상(0건)이 그대로라 "아직도 안 된다"로 오진하게 된다.',
  },
  {
    name: '사망 지점 흔적이 이전 누적본을 오염시킴(제자리 push)',
    file: 'src/features/marketing/api/enrich-telemetry.ts',
    find: 'r.deaths = [...(r.deaths || []), at].slice(-DEATH_TRAIL_MAX)',
    replace: '{ (r.deaths ||= []).push(at); r.deaths = r.deaths.slice(-DEATH_TRAIL_MAX) }',
    test: 'src/tests/unit/enrich-rollup.test.ts',
    why:
      '`foldRound` 는 이전 누적본을 **얕은 복사**해 배열을 참조로 물고 온다. 제자리 push 면 아직 저장되지 ' +
      '않은 원본까지 함께 늘어나 **멱등 검사가 거짓말을 한다**(같은 라운드를 두 번 센 것처럼 보인다). ' +
      '계측이 틀리면 그 위에 세운 처방이 전부 틀린다 — 이 레코드의 존재 이유가 무너진다.',
  },
  {
    name: '심평원 재시도가 실험이 아니게 됨(같은 크기로 재시도)',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: 'Math.max(20, Math.floor(numRows / 5))',
    replace: 'numRows',
    test: 'src/tests/unit/hira-retry-experiment.test.ts',
    why:
      '이 재시도의 목적은 회복이 아니라 **원인 판별**이다 — 작은 페이지로 성공하면 "페이지 크기 문제"(무배포 노브로 해결), ' +
      '작은 페이지도 실패하면 "크기 무관"(동시성·외부)이다. 같은 크기로 다시 쏘면 두 경우가 구분되지 않아 ' +
      '60회 무수확의 원인을 **또 모르는 채로** 남는다.',
  },
  {
    name: '심평원 재시도 상한이 사라짐(페이지마다 재시도)',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: '      retried = true',
    replace: '      retried = false',
    test: 'src/tests/unit/hira-retry-experiment.test.ts',
    why:
      '무료 요금제의 서브리퀘스트 천장은 인보케이션당 ~50 이다. 회차당 1회 상한이 없으면 페이지마다 재시도가 붙어 ' +
      '**같은 회차의 다른 레인 예산까지 잡아먹는다** — 이 레포가 이미 여러 번 당한 자리다.',
  },
  {
    name: 'code 12 힌트가 "폐기 확정"으로 읽히게 약해짐',
    file: 'src/features/marketing/api/public-data-diag.ts',
    // 2026-08-03: 대조군을 하나 더 얻어(미신청=code 30) 문구가 정밀해졌다 — 지도를 갱신했다.
    //   ⚠️ 알려 준 게 이 검사 자신이다("낡은 지도" 모드).
    find: '🔑 단, **활용신청 문제는 아니다** — 미신청은 code 30(403)으로 따로 온다',
    replace: '',
    test: 'src/tests/unit/public-data-diag.test.ts',
    why:
      '2026-08-03 에 **내가 직접 이 오추론을 했다** — code 12 를 보고 "공정위 서비스 폐기 확정"이라고 인계에 적었다. ' +
      '대조군을 찔러 보니 살아있는 `MllBs_2Service`(같은 키로 200·264만건)도 오퍼레이션을 틀리면 **같은 code 12** 였다. ' +
      '두 가능성을 나열만 하는 문구는 읽는 사람이 자기 가설에 맞는 쪽을 고르게 둔다 — 오추론을 **명시적으로 막아야** 한다.',
  },
  {
    name: '레인 일감이 요금제를 모름(예산만 커지고 일은 그대로)',
    file: 'src/features/marketing/api/nps-workplace-enrich.ts',
    find: 'const maxLeads = maxLeadsArg ?? envPlanValue(undefined, 40, 120, env)',
    replace: 'const maxLeads = maxLeadsArg ?? 40',
    test: 'src/tests/unit/ads-cpu-deadline.test.ts',
    why:
      '축이 둘이다 — 예산만 키우고 회차당 처리 건수가 고정이면 **늘어난 예산이 그냥 남는다**. ' +
      '⚠️ 이 축은 예산과 달리 **비율로 유도하면 안 된다**(40×15=600 · NEIS 3×15=45 는 죽는 값이다) — ' +
      '그래서 `envLaneBudget` 이 아니라 명시값 `envPlanValue` 를 쓴다.',
  },
  {
    name: '유료 마감선을 만들어 놓고 분기가 안 씀',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'if (Date.now() - startedAt > runDeadlineMs)',
    replace: 'if (Date.now() - startedAt > RUN_DEADLINE_MS)',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '상수를 추가해도 **분기가 안 보면** 아무 일도 안 일어난다 — 유료 CPU 한도가 커져도 회차는 12초에 끊긴다.',
  },
  {
    name: '노브 등기부 강제 무력화',
    file: 'scripts/check-plan-knob-coverage.mjs',
    find: 'if (bad) process.exit(STRICT ? 1 : 0)',
    replace: 'if (false) process.exit(1)',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why: '등기부 누락·배선 누락을 통과시키면 다음 노브도 조용히 요금제를 못 받는다(하루에 세 번 만난 결함).',
  },
  {
    name: 'DO 알람이 요금제를 다시 모름',
    file: 'src/worker-ads/lane-alarm-policy.ts',
    find: "  if (!Number.isFinite(n) || n <= 0) return paidPlan(env) ? ALARM_INTERVAL_MS_PAID : ALARM_INTERVAL_MS_DEFAULT",
    replace: '  if (!Number.isFinite(n) || n <= 0) return ALARM_INTERVAL_MS_DEFAULT',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '지금 실제로 보강을 돌리는 레인이다 — 요금제가 못 닿으면 유료로 바꿔도 처리량이 한 톨도 안 는다.',
  },
  {
    name: '레인 예산이 요금제를 다시 모름',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: '  if (resolvePlan(env) !== \'paid\') return freeDefault',
    replace: '  return freeDefault; if (false)',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '실제 예산은 min(envBudget, learnedCap, platformCap) — env 가 80 이면 천장을 900 으로 올려도 80 에서 멈춘다.',
  },
  {
    name: '레인이 raw parseInt 로 예산 기본값 회귀',
    file: 'src/features/marketing/api/enrich-lane.ts',
    find: "envLaneBudget(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET, 300, env)",
    replace: "(parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 300)",
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '함수가 옳아도 레인이 안 쓰면 요금제가 닿을 길이 없다 — 오늘 같은 자리에서 이미 당했다.',
  },
  {
    name: 'miss 를 이름 대신 뺄셈으로 계산(음수 재발)',
    file: 'src/worker-ads/tick-history.ts',
    find: '    miss: [...ran].filter(nm => !beatNames.has(nm)).length,',
    replace: '    miss: ran.size - lanes.length,',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: '예산 밖 레인이 자기 하트비트를 남기면 음수가 된다 — 08-02 19:00 회차에서 실제로 나온 값.',
  },
  {
    name: '회차 요약이 flush 로 비워짐(붕괴 과소보고)',
    file: 'src/worker-ads/beat-batch.ts',
    find: '      seen.push({ name: beat.name, ok: beat.ok, ms: beat.ms })',
    replace: '      if (!pending.length) seen.length = 0; seen.push({ name: beat.name, ok: beat.ok, ms: beat.ms })',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: 'seen 이 pending 처럼 비워지면 마지막 flush 시점에 앞쪽 묶음이 사라져 요약이 실제보다 작아진다.',
  },
  {
    name: '회차 이력이 이름 대신 개수를 씀(miss 음수)',
    // 📍 2026-08-03: 꼬리가 `index.ts` 인라인 → `tail-bound.ts` `closeTick` 으로 이사해 앵커를 옮겼다.
    //   (이 이사를 낡은 지도 검사가 그 자리에서 잡았다 — 안 잡혔으면 이 불변식이 조용히 사라졌을 것이다.)
    file: 'src/worker-ads/tail-bound.ts',
    find: 'judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats',
    replace: 'o.beats.seenBeats.map(b => b.name.slice(4)), o.beats.seenBeats',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: '이름 대조를 버리면 miss 가 0 이 되거나(개수 뺄셈이면) 음수가 된다 — 라이브 실측 "띄운7 기록9".',
  },
  {
    name: '같은 회차가 두 줄로 갈림',
    file: 'src/worker-ads/tick-history.ts',
    find: 'const list = readTickHistory(prev).filter(t => t.at !== entry.at)',
    replace: 'const list = readTickHistory(prev)',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: 'flush 가 두 번이면 한 회차가 두 줄이 되어 회차 수가 부풀고 "얼마나 자주 도는가"를 오판한다.',
  },
  {
    name: 'cron 팬아웃이 다시 안 기다림(자식 취소)',
    file: 'src/worker-ads/index.ts',
    find: "kick('/__ads/enrich-influencer-driver?sync=1'",
    replace: "kick('/__ads/enrich-influencer-driver'",
    test: 'src/tests/unit/ads-fanout-cron-sync.test.ts',
    why: '드라이버가 0.6초에 반환하면 부모 waitUntil 이 풀려 손자가 취소된다 — 실측 prev_landed:false 2회 연속.',
  },
  {
    name: '팬아웃 신고가 띄운 뒤로 이동(비교 기준 사후값)',
    file: 'src/worker-ads/enrich.routes.ts',
    find: '    await reportFanout(c.env as never, K, rounds)\n    const kids = Array.from(',
    replace: '    const kids = Array.from(',
    test: 'src/tests/unit/ads-fanout-cron-sync.test.ts',
    why: 'lane_before 가 이번 라운드 전진 후 값이 되면 다음 회차가 영원히 "전진 없음"으로 오판한다.',
  },
  {
    name: 'sync 전멸을 초록으로 반환',
    file: 'src/worker-ads/enrich.routes.ts',
    find: 'ok: landed > 0, fanout: K, sync: true, landed, slices }, landed > 0 ? 200 : 500',
    replace: 'ok: true, fanout: K, sync: true, landed, slices }, 200',
    test: 'src/tests/unit/ads-fanout-cron-sync.test.ts',
    why: '"띄웠다 = 성공" 오해가 sync 경로로 되살아난다 — 자식이 전멸해도 화면이 초록.',
  },
  {
    name: '스냅샷이 조건부로 회귀(붕괴 판정의 분모 소실)',
    file: 'src/worker-ads/lane-runner.ts',
    find: "  const writes = [\n    env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_dispatch_last', snap),\n  ]\n  if (sel.deferred.length) {",
    replace: "  const writes = []\n  if (sel.deferred.length) {\n    writes.push(env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_dispatch_last', snap))",
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '미룬 게 없는 회차에 띄운 레인 수가 안 남는다 — 06:00Z 에서 실제로 "4개를 띄웠나 8개가 죽었나"를 못 갈랐다.',
  },
  {
    name: '도메인 격리 제거(예산이 다시 섞임)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '    const sel = selectLanesForTick(group, budgets[d], cursors[d] ?? 0, share)',
    replace: '    const sel = selectLanesForTick(group, perTick, cursors[d] ?? 0, share)',
    test: 'src/tests/unit/ads-lane-domains.test.ts',
    why: '도메인마다 전체 예산을 주면 격리가 없어진다 — B2B 레인이 늘면 인플루언서가 깎이던 그 상태.',
  },
  {
    name: '작은 도메인 최소 1자리 보장 제거',
    file: 'src/worker-ads/lane-domains.ts',
    find: 'for (const e of exact) { out[e.d] = Math.max(1, Math.floor(e.v)); used += out[e.d] }',
    replace: 'for (const e of exact) { out[e.d] = Math.floor(e.v); used += out[e.d] }',
    test: 'src/tests/unit/ads-lane-domains.test.ts',
    why: '몫이 작은 도메인(매장후보·도매)이 반올림에서 0 이 되어 영원히 안 돈다 — 부재 사고의 교과서적 형태.',
  },
  {
    name: '레인 도메인 표 누락(남의 예산을 씀)',
    file: 'src/worker-ads/lane-domains.ts',
    find: "  'enrich-influencer-driver': 'influencer',",
    replace: '',
    test: 'src/tests/unit/ads-lane-domains.test.ts',
    why: '표에서 빠진 레인은 FALLBACK 으로 흘러가 돌기는 도는데 남의 조 예산을 쓴다(에러 없음).',
  },
  {
    name: '유료 천장이 무료와 같아짐(요금제 반쪽)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'export const SUBREQ_PLATFORM_CAP_PAID = 900',
    replace: 'export const SUBREQ_PLATFORM_CAP_PAID = 60',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '유료로 바꿔도 레인당 처리가 60 에 묶이던 08-02 이전 상태. "레인 수만 늘고 일은 그대로".',
  },
  {
    name: '레인이 요금제를 우회(raw env 직접 전달)',
    file: 'src/features/marketing/api/enrich-lane.ts',
    find: 'envSubreqCap(env)',
    replace: 'platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP)',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '13개 파일이 전부 이 형태였다 — 함수가 옳아도 레인이 안 쓰면 요금제가 닿을 길이 없다.',
  },
  {
    name: '무료 보폭이 바뀜(라이브 회귀)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'return Math.max(RECOVER_STEP, Math.round(scaleBase(ceiling, learnedCap) / 30))',
    replace: 'return Math.max(RECOVER_STEP, Math.round(scaleBase(ceiling, learnedCap) / 10))',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '유료 축을 넣다가 무료 학습 곡선을 흔드는 것 — 에러 없이 수확만 줄어드는 종류의 회귀.',
  },
  {
    name: 'AIMD 불변식 위반(하향 ≤ 회복)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'return Math.max(ABANDON_STEP, Math.round(scaleBase(ceiling, learnedCap) / 15))',
    replace: 'return Math.max(ABANDON_STEP, Math.round(scaleBase(ceiling, learnedCap) / 60))',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '하향이 회복보다 작으면 회차가 계속 죽는 동안에도 상한이 순증해 영영 못 내려온다.',
  },
  {
    name: '보폭이 생활점 대신 천장 기준으로 회귀',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'const live = learnedCap && learnedCap > 0 ? Math.min(learnedCap, ceiling) : ceiling',
    replace: 'const live = ceiling',
    test: 'src/tests/unit/collect-budget-cap.test.ts',
    why: '첫 판이 그랬다 — 천장이 크고 실제 한도가 작은 배치(ADS_PLAN=paid 인데 계정은 무료)에서 낭비가 늘었다.',
  },
  {
    name: '예산 차감 제거(라이브 결함 재현)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)',
    replace: 'const cap = budget <= 0 ? 0 : budget',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '미룰 수 없는 레인이 예산 위에 얹히던 08-02 결함. 예산 8 에 12개가 떠 꼬리 3개가 CPU 한도로 잘렸다.',
  },
  {
    name: 'cap 하한 1 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)',
    replace: 'const cap = budget <= 0 ? 0 : Math.max(0, budget - always.length)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '0 이면 그 시간대가 반복될 때 커서가 영원히 안 움직인다(= 부재).',
  },
  {
    // 2026-08-02: 커서가 역할별로 갈리며 전진 지점이 `pickFrom` 안으로 옮겨졌다(이전 대상
    //   `nextCursor: (c + cap) % n` 은 소멸). 지도를 안 고치면 이 주입이 조용히 안 돈다.
    name: '커서 전진 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'next: (c + take) % n',
    replace: 'next: c',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '커서가 안 움직이면 매 회차 같은 레인만 돌고 나머지는 영원히 굶는다.',
  },
  {
    name: '커서 저장 제거(배선)',
    file: 'src/worker-ads/lane-runner.ts',
    // 역할별 커서라 숫자 하나로는 못 남긴다 — 저장이 JSON 으로 바뀌었다(2026-08-02).
    find: 'bind(DISPATCH_CURSOR_KEY, JSON.stringify(sel.nextCursors))',
    replace: 'bind(DISPATCH_CURSOR_KEY, "0")',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '순수 로직이 맞아도 저장을 안 하면 라운드로빈이 매번 0에서 다시 시작한다.',
  },
  {
    name: '역할 몫 무력화(측정 기아 재발)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: "return assignKey(lane.beat).startsWith('enrich') ? 'measure' : 'other'",
    replace: "return 'other'",
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '역할 판정이 죽으면 몫이 다시 **레인 개수**로 정해진다 — 수집 소스를 붙일 때마다 측정의 몫이 깎이는 한 방향 드리프트가 재발한다(08-02 라이브: 수집 13 : 측정 1, nb_unmeasured 상승).',
  },
  {
    name: '진단 노출 제거',
    file: 'src/features/marketing/api/ads-pool-diag.ts',
    find: "    dispatch: parseJson(find('ads_dispatch_last')),",
    replace: '',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '스냅샷을 쓰기만 하고 노출을 안 해 #919 첫 판정에서 ran/deferred 를 못 봤다.',
  },
  {
    name: '일 1회 레인 보호 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  return gap <= 60',
    replace: '  return true',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '일 1회 레인을 미루면 그 시간이 지나 영영 안 돈다 — 침묵이 아니라 부재라 경보에도 안 잡힌다.',
  },
  {
    name: '유료 확대 무력화',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'export const PAID_LANES_PER_TICK = 64',
    replace: 'export const PAID_LANES_PER_TICK = 8',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '대표 지시 "유료 전환 시 자연히 늘어나게" 의 실체 — 이게 죽으면 유료로 올려도 그대로다.',
  },
  {
    name: '예산 우회 래칫 무력화',
    file: 'scripts/check-ads-dispatch-bypass.mjs',
    find: "const added = found.filter(k => !baseline.includes(k))",
    replace: 'const added = []',
    test: 'src/tests/unit/ads-dispatch-bypass.test.ts',
    why: '래칫이 신규 우회를 안 잡으면 예산 밖 레인이 조용히 늘어난다(부모 CPU 직격).',
  },
  {
    name: '수집 타임라인 KST 보정 제거',
    file: 'src/features/marketing/api/pool-timeline.ts',
    find: "DATE(${tsColumn}, '+9 hours') AS d",
    replace: 'DATE(${tsColumn}) AS d',
    test: 'src/tests/unit/ads-pool-timeline.test.ts',
    why: 'D1 값은 Z 없는 UTC 라 보정 없이 DATE() 하면 한국 사용자에게 하루 밀린 날짜를 보여준다(실사고 4건 클래스).',
  },
  {
    name: '수집 타임라인 풀 컬럼 혼동',
    file: 'src/features/marketing/api/pool-timeline.ts',
    find: "company: { table: 'ad_company_leads', tsColumn: 'collected_at' },",
    replace: "company: { table: 'ad_company_leads', tsColumn: 'created_at' },",
    test: 'src/tests/unit/ads-pool-timeline.test.ts',
    why: '2026-08-02 라이브 실사고 재현: created_at 으로 적어 배포했더니 no such column 을 catch 가 삼켜 **에러 없이 allTime 0**(17만 건 풀이 빈 것처럼). 둘 다 collected_at 이다.',
  },
  {
    name: '팬아웃 자기신고 무력화(띄웠다=성공)',
    file: 'src/features/marketing/api/enrich-fanout-health.ts',
    find: '    ok: verdict.landed !== false,',
    replace: '    ok: true,',
    test: 'src/tests/unit/ads-enrich-fanout-health.test.ts',
    why: '필드만 추가하고 ok 를 안 뒤집으면 화면은 여전히 초록이다 — 자식이 전멸해도 6시간을 모른다(08-02 실측).',
  },
  {
    name: '마감 창 가드 제거(확정 실패 + 가짜 도장)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'return deadline - now >= FETCH_TIMEOUT_FLOOR_MS',
    replace: 'return true',
    test: 'src/tests/unit/ads-invocation-lifetime.test.ts',
    why:
      '바닥값(1.5s)을 줄 수 없는데도 항목을 집으면 **확정적으로 마감을 넘겨 실패**하고, 그 리드는 ' +
      '데이터 없이 perf_checked_at 도장을 받아 22,000 깊이 큐 뒤로 밀린다(nb_unmeasured 에서도 빠진다). ' +
      '08-02 실측: tried 9 / failed 3 — 실패 3 = 동시성 3(워커마다 마지막 1건). 전수 시뮬레이션상 ' +
      '가드를 지우면 잔여 1~1,499ms 구간 1,499건이 전부 마감 초과가 된다.',
  },
  {
    name: '풀 스캔 작업 상한 제거',
    file: 'src/features/marketing/api/pool-scan-budget.ts',
    find: 'if (n >= POOL_SCAN_MAX_ROWS) return true',
    replace: 'if (false) return true',
    test: 'src/tests/unit/ads-cpu-work-cap.test.ts',
    why: '상한이 없으면 한 인보케이션이 4만 행을 훑어 CPU 한도를 넘긴다(#908).',
  },
  {
    name: '스키마 매니페스트에 로직 유입',
    file: 'src/worker/routes/repair-schema/column-repairs.ts',
    find: 'export const COLUMN_REPAIRS: ColumnRepair[] = [',
    replace: 'const mk = (t) => ({ desc: t, sql: `ALTER TABLE ${t} ADD x TEXT` })\nexport const COLUMN_REPAIRS: ColumnRepair[] = [\n    mk("zz"),',
    test: 'src/tests/unit/repair-schema-manifest.test.ts',
    why:
      '이 파일은 "순수 데이터"라는 이유로 600줄 캡을 면제받았다. 로직이 들어오면 그 근거가 사라져 ' +
      '단지 "린트를 끈 1,000줄짜리 파일"이 된다. 이 주입은 처음엔 **초록이 떴다** — 검사가 배열 ' +
      '본문만 봐서 선언 위에 심은 헬퍼를 못 봤다. 파일 전체를 보게 고친 뒤 빨강.',
  },
  {
    name: '추천 보너스 원장 폴백 제거',
    file: 'src/features/group-buy/api/referral-bonus.ts',
    find: "await recordPointTxMinimal(DB, uid, 'referral_bonus', bonus, desc)",
    replace: '/* removed */',
    test: 'src/tests/unit/point-credit-ledger-row.test.ts',
    why:
      '이 원장 행은 잔액 기록이자 **중복 방지 키**다(`alreadyRewarded` 가 description LIKE 로 읽는다). ' +
      '행이 없으면 같은 추천 조합이 매번 다시 보상받는다 — 불일치를 넘어 반복 지급.',
  },
  {
    name: '회차 조건 clamp 를 순진한 Number 로',
    file: 'src/features/marketing/api/store-trades.ts',
    find: "  const ok = (typeof v === 'number' && Number.isFinite(v))",
    replace: '  const ok = Number.isFinite(Number(v))',
    test: 'src/tests/unit/store-collect-config.test.ts',
    why:
      '`Number(null)` · `Number([])` · `Number("")` 은 전부 **0** 이라 "값 없음"이 기본값이 아니라 ' +
      '**하한**으로 조용히 바뀐다. 이 레포는 같은 함정으로 `{amount: []}` 가 0원 환불로 통과한 적이 있다(#941). ' +
      '이 항목은 시험이 실제로 잡아낸 결함이다.',
  },
  {
    name: '파트너 커서가 계획한 창 크기로 전진(영구 사각지대)',
    file: 'src/features/marketing/api/company-collect.ts',
    find: 'const nextCursor = total > 0 ? (cursor + consumed) % total : 0',
    replace: 'const nextCursor = total > 0 ? (cursor + batch) % total : 0',
    test: 'src/tests/unit/company-keyword-grid.test.ts',
    why:
      '이 레인은 거의 매 회차 예산이 먼저 마른다(실측 `keywords 11 · limit_hit true`). ' +
      '계획한 12칸을 전진하면 못 돈 1개가 **건너뛰어지고**, 전진폭이 창 크기와 같아 창 경계가 ' +
      '영원히 고정되므로 **매 회전 같은 자리**가 빠진다 — 지연이 아니라 영구 사각지대다. 오류도 안 난다.',
  },
  {
    name: '카카오 매장 회차가 다시 완주를 전제함(중간 정산 제거)',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'if (cursorKey && rows.length >= FLUSH_ROWS) await flushAt(cursorKey,',
    replace: 'if (false) await flushAt(cursorKey,',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '맨 끝에서 한 번만 저장·전진하면 회차가 중간에 죽을 때 **캔 것도 전진도 통째로** 사라지고, ' +
      '다음 회차가 같은 키워드를 또 훑는다 — 또 죽으면 영원히 0 이다(#927 이 그 구조로 며칠 멈췄다). ' +
      '08-02 실측: 부모가 ms≈3.6초에 CPU 한도로 죽는데 이 레인의 완주 시간은 8,097ms 다. 완주가 예외다.',
  },
  {
    name: '수동 트리거가 ur-ads 에 없는 경로를 부름',
    file: 'src/features/marketing/api/store-prospects.routes.ts',
    find: "['/collect-store-kakao', 'collect-store-kakao'],",
    replace: "['/collect-store-kakao', 'collect-store-kakao-x'],",
    test: 'src/tests/unit/store-collect-config.test.ts',
    why:
      '위임 `kick()` 이 fail-soft 라 대상이 틀려도 `{success:true, started:true}` 가 돌아간다 — ' +
      '화면엔 "수집 시작" 토스트가 뜨고 **아무 일도 안 일어난다**. 404 보다 나쁜 건 404 가 성공처럼 보이는 것이고, ' +
      '이 레인은 5회차에 한 번 도는 터라 "곧 되겠지"와 구분조차 안 된다.',
  },
  {
    name: '지역 권역 매칭 0 → 전국 폴백 제거',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: '  return picked.length ? picked : S2_REGIONS // 아무것도 안 잡히면 전국(설정 오타로 수집이 0 이 되면 안 된다)',
    replace: '  return picked',
    test: 'src/tests/unit/store-collect-config.test.ts',
    why: '설정 오타 하나로 그리드가 0 이 되면 레인이 **에러 없이** 아무것도 안 캔다 — 침묵하는 0 보다 넓게 도는 편이 낫다.',
  },
  {
    name: '매장 업태 — 빈 배열도 상수로 폴백(끈 게 되살아남)',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'const voucherTrades = dbTrades ? (dbTrades.voucher || []) : VOUCHER_TRADES',
    replace: 'const voucherTrades = (dbTrades?.voucher?.length ? dbTrades.voucher : VOUCHER_TRADES)',
    test: 'src/tests/unit/store-trades-config.test.ts',
    why:
      '"조회 실패" 와 "의도적으로 다 끔" 은 둘 다 비어 있지만 뜻이 정반대다. 후자에 폴백하면 ' +
      '화면은 OFF 인데 수집은 계속 돈다 — 설정이 무력화되는 가장 나쁜 실패이고, 에러도 안 난다.',
  },
  {
    name: '매장 업태 시드가 설정을 덮어씀',
    file: 'src/features/marketing/api/store-trades.ts',
    find: 'INSERT OR IGNORE INTO ad_store_trades (block, kw, category) VALUES',
    replace: 'INSERT OR REPLACE INTO ad_store_trades (block, kw, category) VALUES',
    test: 'src/tests/unit/store-trades-config.test.ts',
    why: 'REPLACE 면 대표가 끈 업태가 **매 배포마다** 되살아난다 — 설정이 배포에 지워진다.',
  },
  {
    name: '수집 업종 토글이 집계와 다른 식을 씀',
    file: 'src/features/marketing/api/company-trades.ts',
    find: 'UPDATE ad_company_keywords SET active = ? WHERE ${TRADE_EXPR} = ?',
    replace: 'UPDATE ad_company_keywords SET active = ? WHERE subcategory = ?',
    test: 'src/tests/unit/company-trades-toggle.test.ts',
    why:
      '집계(화면)와 토글(실행)이 다른 식을 쓰면 대표가 끈 줄 아는 업종이 계속 캐진다. ' +
      '서브카테고리가 빈 업종은 아예 안 꺼진다 — 에러 없이.',
  },
  {
    name: '마지막 활성 업종 가드 제거',
    file: 'src/features/marketing/api/company-trades.ts',
    find: "if ((Number(self?.n) || 0) > 0 && activeTrades <= 1) return { ok: false, error: 'LAST_ACTIVE_TRADE' }",
    replace: '',
    test: 'src/tests/unit/company-trades-toggle.test.ts',
    why:
      '전부 끄면 회전 쿼리가 0행을 받아 수집이 **에러 없이** 멈추고 하트비트는 초록으로 남는다 ' +
      '(레인은 정상 실행되고 할 일이 없을 뿐이다). 클릭 한 번으로 그 상태가 될 수 있다.',
  },
  {
    name: '우선업종 category 오타(조용한 0 순위)',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: "{ kw: '한식', category: '일반음식점' }",
    replace: "{ kw: '한식', category: '음식점' }",
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      'category 는 `PRIORITY_UPJONG`(인허가 한글 업종명)과 글자까지 같아야 우선순위 SQL 에 걸린다. ' +
      '한 글자만 달라도 에러 없이 **0 순위**가 되고 어드민 업종 필터에서도 별개 항목으로 갈린다 ' +
      '— store-prospects.ts 주석이 이미 경고한 함정이다.',
  },
  {
    name: '카카오 매장 수집 마감선 제거',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    // 2026-08-02: 마감선이 요금제 인지 지역변수(`runDeadlineMs`)로 바뀌어 이 지도를 갱신했다.
    //   ⚠️ 갱신을 알려 준 게 이 검사 자신이다("낡은 지도" 모드) — 그게 이 파일의 존재 이유다.
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break outer }",
    replace: '',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '커서 저장이 루프 뒤에 있다. CPU 한도로 죽으면 커서가 안 올라가 다음 회차가 같은 키워드를 ' +
      '또 훑는다 ⇒ **영원히 전진 0**. 통신판매 레인이 정확히 그렇게 며칠간 멈춰 있었다(#927).',
  },
  {
    name: '무인 블록 최소 몫 보장 제거',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'const unmanned = Math.max(1, Math.round(total * (1 - voucherShare)))',
    replace: 'const unmanned = Math.floor(total * (1 - voucherShare))',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '몫이 0 이면 그 레인은 **에러 없이** 멈춘다 — 커서도 안 움직여서 아무도 모른다. ' +
      '대표가 07-28 에 요청한 무인 레인을 조용히 죽이는 경로다.',
  },
  {
    name: '카카오 매장 블록이 커서를 공유',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: "const CURSOR_KEY_VOUCHER = 'ads_store_kakao_cursor_v'",
    replace: "const CURSOR_KEY_VOUCHER = 'ads_store_kakao_cursor'",
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '두 블록(우선업종·무인)이 한 커서를 쓰면 서로의 진행을 덮어써 어느 쪽도 한 바퀴를 못 돈다 ' +
      '— 레인별 학습 상한을 공유해 같은 사고가 났던 `ads_subreq_cap` 과 똑같은 구조다(2026-07-28).',
  },

  // ── 🎚️ 회차당 레인 수 학습기 (2026-08-02) — 손으로 잰 상수를 대체한 제어 루프
  {
    name: '학습기가 예산 밖 기록(off)을 해로 셈',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  Math.max(0, t.fail || 0) + Math.max(0, t.miss || 0) >= HARM_MIN_LANES',
    replace: '  Math.max(0, t.fail || 0) + Math.max(0, t.miss || 0) + Math.max(0, t.off || 0) >= HARM_MIN_LANES',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '`off` 는 DO 알람·우회 레인이 자기 하트비트를 남긴 정상 동작이다(라이브 "띄운7 기록9"). ' +
      '이걸 해로 세면 학습기가 매 회차 물러나 **영원히 바닥에 눌린다** — 처리량을 스스로 반으로 깎고 아무도 모른다.',
  },
  {
    name: '자기신고 1건에도 함대를 깎음',
    file: 'src/worker-ads/lane-aimd.ts',
    find: 'export const HARM_MIN_LANES = 2',
    replace: 'export const HARM_MIN_LANES = 1',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '`enrich-influencer-fanout` 은 CPU 와 무관하게 스스로 ok=false 를 남긴다(라이브 실재). ' +
      '문턱이 1 이면 그 자기신고 하나가 매 회차 레인 수를 깎는다 — CPU 고갈은 떼로 죽인다(실측 5·2·4).',
  },
  {
    name: '물러남이 반올림으로 제자리가 됨',
    file: 'src/worker-ads/lane-aimd.ts',
    find: 'const backed = Math.min(base - 1, Math.floor(base * BACKOFF_FACTOR))',
    replace: 'const backed = Math.ceil(base * BACKOFF_FACTOR)',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why: '"최소 1 은 반드시 줄인다"가 없으면 작은 값에서 물러남이 사라져 학습이 멈춘다(계속 죽으면서 그 자리를 지킨다).',
  },
  {
    name: '유료 전환이 배운 자리를 버리고 천장에서 시작',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  const base = clampCap(prev?.cap ?? start, top)',
    replace: '  const base = clampCap(start, top)',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '이 축의 한도는 요금제가 아니라 인보케이션당 CPU 다(유료 기본값도 30초). 배운 자리를 버리고 ' +
      '`PAID_LANES_PER_TICK`(64)에서 시작하면 **유료로 바꾼 첫 정각에 무너진다** — 대표 요구사항의 정반대.',
  },
  {
    name: '학습값이 디스패처에 안 닿음',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  if (Number.isFinite(learned as number) && (learned as number) >= 1) return Math.floor(learned as number)',
    replace: '  if (false) return 0',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '배우기만 하고 안 쓰면 오늘 세 번 겪은 그 상태(닿지 않는 노브)가 그대로다 — 에러가 없어서 ' +
      '학습이 도는 것처럼 보이는데 회차 수는 상수 그대로다.',
  },
  {
    name: '바닥 고착 탈출이 사라짐',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  if (pinned >= PROBE_AFTER_PINNED) return { cap: Math.min(top, MIN_LANES_PER_TICK + 1), clean: 0, pinned: 0 }',
    replace: '  if (pinned >= 999999) return { cap: Math.min(top, MIN_LANES_PER_TICK + 1), clean: 0, pinned: 0 }',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '하트비트를 아예 안 남기는 레인이 하나만 있어도 `miss` 가 영구 1 이라 바닥에 영원히 눌린다. ' +
      '탈출이 없으면 그 상태가 신호 없이 지속된다("실패가 아니라 조용한 부재").',
  },
  {
    name: 'cron 계정 한도 초과(스케줄 PUT 전면 거부)',
    file: 'wrangler.toml',
    find: 'crons = ["*/5 * * * *", "0 18 * * *", "0 19 * * *", "0 20 * * SUN"]',
    replace: 'crons = ["*/5 * * * *", "0 18 * * *", "0 19 * * *", "0 20 * * SUN", "0 21 * * SUN"]',
    test: 'src/tests/unit/cron-schedule.test.ts',
    why:
      '무료 플랜은 **계정당** cron 5개다(code 10072). 이 계정은 지금 정확히 5(ur-live 4 + ads 1) — 6번째를 넣으면 ' +
      '스케줄 PUT 이 통째로 거부되고 **그 뒤 모든 worker-deploy 가 이 단계에서 실패**해 cron 코드 ' +
      '배포가 전면 정지한다. 2026-08-02 13:19Z 에 실제로 그렇게 됐고, 한 파일만 보는 검사로는 못 잡는다.',
  },
  {
    name: 'cron day-of-week 0 재유입(배열 전체 거부)',
    file: 'wrangler.toml',
    // 🔁 2026-08-02: 원래 좌표는 `"0 20 * * SUN"` 이었는데, 무료 한도로 그 항목을 잠깐 뺐을 때
    //   **뺀 이유를 적은 주석에 같은 문자열이 남아** 주입이 주석에 걸렸다. 주석을 고쳐 봐야
    //   동작이 안 바뀌니 테스트가 통과했고 *"가드가 헛돈다"* 로 오진됐다(진실은 "낡은 지도").
    //   ⇒ 좌표를 **항상 살아 있는** 항목으로 옮긴다. 지키려는 것은 특정 cron 이 아니라
    //   **배열 안 어떤 dow 든 0 이면 안 된다** 이므로 어느 항목이든 무방하다.
    find: '"0 18 * * *"',
    replace: '"0 18 * * 0"',
    test: 'src/tests/unit/cron-schedule.test.ts',
    why:
      '표준 crontab 에선 0=일요일이라 맞아 보이지만 Cloudflare 는 1-7/MON-SUN 만 받는다(code 10100). ' +
      '스케줄 PUT 이 원자적 전체 교체라 이 한 줄이 배열 **전체**를 무효화한다 — 주간 D1 백업이 ' +
      '몇 달간 등록조차 안 된 채였고(재해복구 0) 에러는 배포 로그 안에만 있었다. ' +
      '⚠️ 위 계정-한도 항목과 별개다: 하나는 개수, 이것은 문법이며 서로를 대체하지 않는다.',
  },
  {
    name: '바인딩을 주석으로 되돌림(배포가 지운다)',
    file: 'wrangler.toml',
    find: '[[r2_buckets]]\nbinding = "BACKUP_BUCKET"',
    replace: '# [[r2_buckets]]\n# binding = "BACKUP_BUCKET"',
    test: 'src/tests/unit/worker-bindings-declared.test.ts',
    why:
      '`wrangler deploy` 는 이 파일이 선언한 것으로 워커 설정을 **통째로 교체**한다 — 주석은 ' +
      '"추가 안 함"이 아니라 **삭제**다. 2026-08-02~03 에 두 번 당했고(CACHE_KV · BACKUP_BUCKET), ' +
      '두 번째는 **백업 cron 을 켜는 그 배포가 백업이 쓸 버킷을 지웠다**. 에러는 안 나고 ' +
      '주간 회차가 올 때(일주일 뒤) 조용히 실패한다.',
  },

  // ── 🚚 ur-ads 배포가 조용히 안 나감 (2026-08-02 실사고)
  {
    name: 'env 밖 요금제 쌍(_PAID)이 다시 사각지대로',
    file: 'scripts/check-plan-knob-coverage.mjs',
    find: 'if (orphanPaid.size) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why:
      '요금제 축의 절반은 env 가 아니라 파일 안 상수 쌍(RUN_DEADLINE_MS/_PAID 등)이다 — 등기부에도 R2 에도 ' +
      '안 걸린다. `_PAID` 를 만들고 선택부를 안 붙이면 **유료로 바꿔도 그 축은 안 오른다**(에러 없음).',
  },
  {
    name: 'bad 집계 변수 소실(R3 위반 시 ReferenceError)',
    file: 'scripts/check-plan-knob-coverage.mjs',
    find: 'let bad = false',
    replace: 'globalThis.__bad_removed = 1',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why:
      'R3 는 `bad = true` 로 집계한다 — 선언이 사라지면 위반이 났을 때 ReferenceError 로 죽는다. ' +
      '⚠️ 통과할 땐 멀쩡하고 **실패할 때만** 깨지는 모양이라 눈으로는 못 본다(첫 판이 실제로 그 상태였다: ' +
      'R3 를 선언보다 앞에 뒀다). 위치·존재 검사가 없으면 그대로 머지된다.',
  },
  {
    name: 'PR 검증이 다시 건너뛰어짐(미검증 코드 머지)',
    file: '.github/workflows/verify.yml',
    find: '  pull_request:\n    branches: [main]\n  push:',
    replace: "  pull_request:\n    branches: [main]\n    paths-ignore: ['docs/**']\n  push:",
    test: 'src/tests/unit/ci-verify-coverage.test.ts',
    why:
      '문서 커밋을 코드 커밋 뒤에 밀면 concurrency 가 앞 run 을 취소하고 뒤 커밋은 자기 run 을 안 만든다 ' +
      '— PR 에 실패한 체크가 하나도 없는데 코드는 한 번도 검증되지 않은 상태가 된다(2026-08-03 실제 발생).',
  },
  {
    name: '고아 레인 판정이 나이를 다시 안 봄',
    file: 'src/worker-ads/lane-cadence.ts',
    find: '      return (age as number) > staleMinutes       // 🔴 최근에 뛰고 있으면 고아가 아니다',
    replace: '      return true',
    test: 'src/tests/unit/ads-lane-cadence.test.ts',
    why:
      'DO 알람·우회로 도는 레인은 디스패처 목록에 없다 — 나이를 안 보면 **멀쩡히 도는 레인이 전부 고아**로 ' +
      '찍힌다(실측 16건 중 대부분). 고칠 게 없는 경보 16줄이 진짜 하나(sweep-kakao-phone 4일 정지)를 묻는다.',
  },
  {
    name: 'never_fired 가 다시 비대칭 정규화',
    file: 'src/worker-ads/lane-cadence.ts',
    find: '  return known.filter(k => !fired.has(baseLaneName(k))).sort()',
    replace: '  return known.filter(k => !fired.has(k)).sort()',
    test: 'src/tests/unit/ads-lane-cadence.test.ts',
    why:
      '`known` 은 쿼리를 단 채 들어오는데 하트비트 쪽만 쿼리를 떼면, 쿼리 있는 레인은 기록이 멀쩡히 있어도 ' +
      '**영원히 "한 번도 안 돌았다"** 로 찍힌다(실측 2건). 오탐이 경보 전체의 신뢰를 깎는다.',
  },
  {
    name: 'ur-ads 배포 백오프가 초 단위로 회귀',
    file: '.github/workflows/deploy-ads.yml',
    find: 'WAIT=$(( i == 1 ? 60 : (i == 2 ? 150 : 300) ))',
    replace: 'WAIT=$(( i * 10 ))',
    test: 'src/tests/unit/deploy-retry-backoff.test.ts',
    why:
      'Cloudflare 10429 는 초 단위로 안 풀린다 — 실측에서 3회 재시도가 40초 안에 소진돼 배포가 실패했고 ' +
      'ur-ads 가 낡은 코드로 계속 돌았다(머지 2건이 조용히 미배포). 라이브는 멀쩡해 보인다.',
  },
  {
    name: '소비자 Pages 배포 백오프가 초 단위로 회귀',
    file: '.github/workflows/main.yml',
    find: "                SLEEP=$(( i == 1 ? 60 : (i == 2 ? 150 : 300) ))",
    replace: "                SLEEP=$((i * 10))",
    test: 'src/tests/unit/deploy-retry-backoff.test.ts',
    why:
      '소비자 사이트 배포가 같은 10429 로 **연속 4회** 실패했다(22:53·23:37·23:47·23:56 KST). ' +
      '라이브가 4개 머지만큼 뒤처졌는데 화면은 멀쩡해 보인다 — 한 곳만 고치면 다른 곳이 같은 이유로 죽는다.',
  },
  {
    name: '빈 회차를 해로 안 셈(학습기 관측 편향 재발)',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  if (!tickHarmed(tick) && missed <= 0) {',
    replace: '  if (!tickHarmed(tick)) {',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '부모가 flush 전에 죽은 회차는 요약이 없다 — 즉 **가장 심하게 무너진 회차일수록 학습기 눈에 안 띈다**. ' +
      '빈자리를 안 세면 학습기가 살아남은 회차만 보고 영영 안 물러난다(실측: 관측된 회차 5중 2).',
  },
  {
    name: '빈 회차를 이력 덧붙인 *뒤* 에 셈(항상 0)',
    file: 'src/worker-ads/tick-history-write.ts',
    find: "    const prev = [...hist].reverse().find(t => t.at !== at) ?? null\n    const next = appendTick(pick(TICK_HISTORY_KEY), tick)",
    replace: "    const next = appendTick(pick(TICK_HISTORY_KEY), tick)\n    const prev = readTickHistory(next).at(-1) ?? null",
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why:
      '덧붙인 뒤 마지막 항목은 **방금 만든 이 회차**라 간격이 항상 0 이 된다 — 검사가 통째로 헛돈다 ' +
      '(이 레포가 반복해 만난 "헛도는 가드" 의 교과서적 형태). ' +
      '2026-08-06 부터는 디스패치가 같은 `at` 으로 잠정 항목을 먼저 박으므로 `.at(-1)` 자체가 늘 이 회차다.',
  },
  {
    name: '잠정 회차를 해로 셈(관측 실패를 붕괴로 오독 — cap 자해)',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  if (prev.p === 1) return 0\n',
    replace: '',
    test: 'src/tests/unit/ads-provisional-tick.test.ts',
    why:
      '이 한 줄이 2026-08-06 사고의 수리다. 빈자리를 붕괴로 읽어 **레인이 전부 ok=true 인 밤사이에** ' +
      'cap 이 6 → 2(바닥)로 자해했다. 빼면 "관측만 죽은 회차"가 다시 해로 잡혀 사고가 그대로 재현된다.',
  },
  {
    name: '디스패치가 잠정 회차를 안 남김(꼬리 실패 = 영구 빈자리)',
    file: 'src/worker-ads/lane-runner.ts',
    find: '  if (opts.at) {',
    replace: '  if (false) {',
    test: 'src/tests/unit/ads-provisional-tick.test.ts',
    why:
      '잠정 항목이 없으면 부모가 꼬리까지 못 산 회차는 이력에 빈자리로 남고, 그 빈자리가 다시 ' +
      '붕괴 신호가 된다 — 수리 이전 상태로 통째 회귀한다.',
  },
  {
    name: '배포 워크플로가 자기 자신을 경로에서 잃음',
    file: '.github/workflows/deploy-ads.yml',
    find: "      - '.github/workflows/deploy-ads.yml'",
    replace: '',
    test: 'src/tests/unit/deploy-retry-backoff.test.ts',
    why:
      '자기 자신이 paths 에 없으면 **이 워크플로의 수리가 배포되지 않는다** — 깨진 배포 경로를 고쳐도 ' +
      '무관한 코드 변경을 기다려야 적용된다(수리를 검증할 방법이 없는 자기참조적 사각지대).',
  },
  {
    name: '집중 축 커서를 읽어오지 않음(항상 0 — 앞 4개만 무한 반복)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '[STATS_KEY, FOCUS_CURSOR_KEY,',
    replace: '[STATS_KEY,',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      'readSettings 목록에 없는 키는 **에러가 아니라 undefined** 로 온다 → parseInt(\'0\') → 커서 0 고정. ' +
      '라이브 실측: 활성 대행사 키워드 18개 중 앞 4개만 돌고 "체험단 대행"·"인플루언서 섭외" 등 14개는 ' +
      '`found_total = 0 · last_run_at = null`(한 번도 검색된 적 없음). 슬롯 배정(`focus_n: 4`)은 정상이라 ' +
      '통계만 봐선 멀쩡해 보였다.',
  },
  {
    name: '체험단 분류 룰 소실 — 승격 게이트가 그 축을 영구 차단(hits 78 이 영원히 대기)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: "  { cat: '체험단', re: /체험단(?!\\s*(모집|대행|운영))|서포터즈|협찬|리뷰어/i },\n",
    replace: '',
    test: 'src/tests/unit/ads-experience-group-axis.test.ts',
    why:
      '분류 불가는 category=\'자동\' 이 되고 `canAutoPromote` 가 막는다 → **hits 가 아무리 쌓여도 승격 0**. ' +
      '라이브 실측(2026-08-17): 체험단(78) · 블로그체험단(40) · 협찬플러스(21) · 제품협찬(12) 이 그 상태로 ' +
      '대기하고 있었다. 키워드 정원을 늘려도 소용없다 — 게이트가 정원보다 먼저 막는다. 에러 없이 축 하나가 통째로 꺼진다.',
  },
  {
    name: '체험단이 승격 허용목록에서 빠짐(분류는 되는데 게이트가 막음)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: "  '체험단',                                     // 이미 브랜드 협업을 받아 본 층(행위 신호 — 위 룰 docblock 실측)\n",
    replace: '',
    test: 'src/tests/unit/ads-experience-group-axis.test.ts',
    why:
      '분류와 게이트는 **다른 층**이다 — 룰이 살아 있어도 허용목록에 없으면 승격이 0 이다. 두 곳을 함께 ' +
      '봐야 하는 구조라 한쪽만 고치는 실수가 나기 쉽고, 그 결과는 "분류는 잘 되는데 왜 안 늘지" 다.',
  },
  {
    name: '체험단 lookahead 소실 — 대행사(집중 축)를 통째로 훔친다',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: "re: /체험단(?!\\s*(모집|대행|운영))|서포터즈|협찬|리뷰어/i",
    replace: 're: /체험단|서포터즈|협찬|리뷰어/i',
    test: 'src/tests/unit/ads-experience-group-axis.test.ts',
    why:
      '`체험단 모집`·`체험단 대행` 은 체험단을 **운영하는** 대행사이고, 대행사는 리드 1건이 매장 N건으로 ' +
      '곱해지는 유일한 축(집중 전용 슬롯)이다. lookahead 가 없으면 그 신호가 전부 체험단으로 흘러 ' +
      '**집중 축이 조용히 비고** 전용 슬롯은 스스로 반납된다(=대행사 발굴 정지). 축을 지키는 것은 룰 순서가 아니라 이 lookahead 다.',
  },
  {    name: '신선도 조율기의 차단 동결이 사라짐(확장이 네이버 차단을 부른다)',
    file: 'src/features/marketing/api/influencer-freshness-control.ts',
    find: "  if ((Number(s?.blocked) || 0) > 0) return { cap: cur, reason: 'blocked-freeze', ...base }",
    replace: '',
    test: 'src/tests/unit/ads-freshness-control.test.ts',
    why:
      '조율기는 수확이 떨어지면 캡을 넓히는데, 차단 중에 넓히면 **차단을 더 세게 부른다**. 차단은 발굴 ' +
      '전체를 멎게 하고(라이브에서 blocked>0 이면 크롤이 통째로 정지) 되돌리기도 어렵다(평판·IP). ' +
      '그래서 하락 중이어도 차단이면 동결이 옳다 — 이 가드가 없으면 자동화가 스스로 목을 조른다.',
  },
  {
    name: '신선도 조율기가 하락을 감지하지 못함(발굴량이 마르는 걸 방치)',
    file: 'src/features/marketing/api/influencer-freshness-control.ts',
    find: '  const declining = before > 0 && after < before * FRESHNESS_DECLINE_RATIO',
    replace: '  const declining = false',
    test: 'src/tests/unit/ads-freshness-control.test.ts',
    why:
      '이 한 줄이 조율기의 존재 이유다. 없으면 항상 stable 로 떨어져 **캡이 영구 고정** = 사람이 상수를 ' +
      '올려 줄 때만 발굴량이 오르는 종전 구조로 회귀한다. 라이브 실측: 그 구조에서 08-12 6,366명 → ' +
      '08-16 3,773명(−41%)이 났고 신규 활성화가 7일간 0 이었다. 에러가 없어 조용히 마른다.',
  },
  {
    name: '조율기가 정한 캡을 저장하지 않음(계산만 하고 아무 일도 안 함)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    [FRESHNESS_CAP_KEY, String(fresh.cap)],\n',
    replace: '',
    test: 'src/tests/unit/ads-freshness-control.test.ts',
    why:
      '#930 집중 커서와 **정확히 같은 실패 모드**: 매 회차 계산은 하는데 저장이 없어 다음 회차가 항상 ' +
      '옛 캡을 읽는다. 통계에는 새 캡이 찍히므로 화면만 보면 조율이 되는 것처럼 보인다.',
  },
  // 🗑️ **삭제(2026-08-17)** — `다 훑은 키워드 은퇴가 승격 차단에서 빠짐`.
  //   #1163 의 `exhausted` 조각을 **에폭으로 통합**하면서(대표 "에폭으로 통합해서 머지해줘")
  //   그 조각 자체가 사라졌다. 그리고 에폭은 **차단에 넣으면 안 된다** — 승격이 리셋하므로 livelock 이
  //   성립하지 않고, 넣으면 30일 영구 배제가 된다. 즉 이 주입의 전제가 반대로 뒤집혔다.
  //   지키던 것은 두 갈래로 살아 있다: 평생 카운터 셋의 차단 포함(`ads-freshness-control` ·
  //   `ads-keyword-promotion-room`)과, 그 역방향 주입 `에폭 은퇴를 승격 차단에 넣는다`.
  {
    name: '축 이월(carry) 적립을 버림 — 선언한 배수 3:2:1 이 조용히 뒤집힌다',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '  if (wSum > 0) for (let i = 0; i < 3; i++) credit[i] += (budget * w[i]) / wSum',
    replace: '  for (let i = 0; i < 3; i++) credit[i] = 0\n  if (wSum > 0) for (let i = 0; i < 3; i++) credit[i] += (budget * w[i]) / wSum',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '이월을 버리면 매 회차 0 에서 시작하니 비례 배분만 남고, 정수 슬롯 경쟁에서 **작은 축이 매 회차 0** 이 된다. ' +
      '반대로 옛 바닥(매 회차 최소 1슬롯)을 되살리면 폭이 좁을 때 세금이 22% 가 되어 본업 축이 가장 느려진다 — ' +
      '2026-08-12 라이브 실측: 우선 358개(전체 78% · 이메일 수율 24.4%)가 평균 7.04일 미실행(최악 15.94일)인 반면 ' +
      '일반 76개는 3.26일 · 집중 25개는 1.34일. 선언한 정책이 코드에서 뒤집힌 것을 아무도 못 봤다.',
  },
  {
    name: '축 이월을 저장하지 않음(carry 영구 0 — 불변식 ④ 가 조용히 사라짐)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    [AXIS_CARRY_KEY, serializeAxisCarry(nextAxisCarry)],\n',
    replace: '',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '집중 축 커서(#930)와 **정확히 같은 실패 모드**: 계산은 매 회차 하는데 저장이 없어 다음 회차가 항상 0 을 읽는다. ' +
      '에러가 없고 슬롯 합계도 정상이라 통계만 보면 멀쩡하다 — 작은 축이 영구 0 이 되는 것만 달라진다.',
  },
  {
    name: '민 커서를 통계 JSON 에만 남기고 저장 안 함',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    [FOCUS_CURSOR_KEY, String(nextFocusCursor)],\n',
    replace: '',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '다음 회차가 읽는 곳은 `platform_settings` 이지 통계 blob 이 아니다. 라이브 실측에서 ' +
      'cursor_pri=158 · cursor=6 은 있는데 cursor_focus 는 **행 자체가 없었다** — 계산은 매 회차 했는데 ' +
      '아무 데도 안 남았다. 커서가 있는 레인이라면 어디서든 같은 형태로 재발한다.',
  },
  {
    name: '집중 축 커서를 계획한 수만큼 밀어 안 돈 키워드를 건너뜀',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '(focusCursor + focusDone)',
    replace: '(focusCursor + nFocus)',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '예산은 픽 4개를 다 못 돈다(보통 1~2개). 계획한 수만큼 밀면 처리 못 한 키워드를 지나쳐 ' +
      '**한 바퀴에 한 번도 안 걸리는 자리**가 생긴다 — 우선/일반 커서가 `prefixDone` 을 쓰는 이유와 같은 병(leapfrog).',
  },
  {
    name: "bare '마케터' 가 소개글까지 대행사로(이용권 축에서 훔쳐옴)",
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: '광고\\s*(운영|세팅|집행)/i,\n    nameRe:',
    replace: '광고\\s*(운영|세팅|집행)|마케터/i,\n    nameRe:',
    test: 'src/tests/unit/ads-classify-marketer.test.ts',
    why:
      '라이브 실측: 대행사 273명 중 **45명(16%)이 오직 이 단어 하나로** 들어왔고, 원래 자리는 ' +
      '맛집 10 · 외식창업 8 · IT/재테크 5 · 카페 5 · 숙소 4 · 여행 2 · 패션 1 · 미분류 10 — ' +
      '대부분 이용권 본체 축이다. "15년차 마케터. 75개국 여행" 이 여행 블로거를 대행사로 만든다.',
  },
  {
    name: '이름 전용 신호를 안 봄(진짜 마케터가 사라짐)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: 'if (!r.re.test(text) && !(r.nameRe && r.nameRe.test(name))) continue',
    replace: 'if (!r.re.test(text)) continue',
    test: 'src/tests/unit/ads-classify-marketer.test.ts',
    why:
      '좁히기의 짝이다. `nameRe` 를 안 보면 싱어송마케터·지역전문마케터·QR마케터처럼 **이름으로 자기를 ' +
      '선언한 실제 마케터 14명**이 통째로 빠진다 — 오탐을 줄이려다 정탐을 버리는 형태.',
  },
  {
    name: '규칙이 거부하는 옛 카테고리를 안 비움(영구 고착)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: "  if (stored === '마케팅대행사') {",
    replace: "  if (false && stored === '마케팅대행사') {",
    test: 'src/tests/unit/ads-classify-marketer.test.ts',
    why:
      '재분류는 `classifyCategory` 가 **null 이면 그대로 둔다.** 규칙을 좁히면 어느 규칙에도 안 걸리는 ' +
      '행이 생기는데(실측 45 중 10건), 안 비우면 옛 값이 영구히 굳는다 — `shouldClearCategory` docblock 이 ' +
      '입주 시공업체 27명 실측으로 이미 경고한 바로 그 형태("측정하면 점진 교정된다"는 낙관은 틀렸다).',
  },
  {
    name: '시트 미러가 사이클 스냅샷을 넘어 그리드 밖을 씀',
    file: 'src/features/marketing/api/sheets-sync.ts',
    find: 'Math.min(PAGE, ROWS_PER_RUN - wrote, room)',
    replace: 'Math.min(PAGE, ROWS_PER_RUN - wrote)',
    test: 'src/tests/unit/ads-sheets-sync.test.ts',
    why:
      '그리드는 사이클 **시작 시점 total** 로만 넓힌다(`ensurePoolSheet(total+2)`, `off===0` 분기 안). ' +
      '읽기 루프에 그 상한이 없으면 사이클 도중 늘어난 행을 그리드 밖에 쓰고 Sheets 400 이 난다. ' +
      '실패는 커서를 그 자리에 저장하고 끝나므로 `off` 가 0 으로 돌아갈 길이 없다 = **영구 고착**' +
      '(2026-08-03 라이브: `{off:44000, total:43597}`, 24시간 7회 실패).',
  },
  {
    name: '지나친 커서를 되돌리지 않아 그리드 확장이 영영 안 불림',
    file: 'src/features/marketing/api/sheets-sync.ts',
    find: 'return cur.total > 0 && cur.off >= cur.total ? { off: 0, total: 0 } : cur',
    replace: 'return cur',
    test: 'src/tests/unit/ads-sheets-sync.test.ts',
    why:
      '위 상한은 *앞으로* 안 넘어가게 할 뿐, **이미 넘어가 있는 라이브 커서는 안 푼다.** 이 되돌림이 ' +
      '없으면 배포해도 같은 행에서 400 이 계속 나고, 2~3칸뿐인 회차 예산에서 한 칸을 계속 태운다. ' +
      '⚠️ `total` 을 0 으로 되돌리는 것까지가 수리다 — 그래야 호출부가 총계를 다시 세고 그리드를 넓힌다.',
  },
  {
    name: '알람이 모는 수집 레인을 부모도 던짐(부모 CPU 이중 소모)',
    file: 'src/worker-ads/index.ts',
    find: "if (!laneAlarmOn && env.ADS_AUTO_COLLECT_ENABLED === 'true')",
    replace: "if (env.ADS_AUTO_COLLECT_ENABLED === 'true')",
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '리스가 이중 *실행* 은 막지만 **던지는 것 자체가 부모 CPU 를 먹는다** — 그게 애초에 이 레인을 죽인 ' +
      '원인이다(2026-08-03 실측: 디스패치 3초 뒤 `ads:collect  Worker exceeded CPU time limit`).',
  },
  {
    name: 'laneAlarmOn 선언이 첫 사용보다 아래로(런타임 TDZ)',
    file: 'src/worker-ads/index.ts',
    find: '  const laneAlarmOn = laneAlarmDrivesEnrich(env)\n',
    replace: '',
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '`const` 는 TDZ 라 선언보다 먼저 쓰면 **런타임에 ReferenceError** 인데 **타입체크는 통과한다**. ' +
      '수집 게이트가 보강 블록보다 위에 있어 작성 중 실제로 밟았다. 이 주입은 선언을 통째로 지워 ' +
      '"순서" 불변식이 위치를 실제로 보는지 확인한다.',
  },
  {
    name: '시트 미러가 알람과 cron 에서 동시에 돎 (리스 없음 → 시트 행 중복)',
    file: 'src/worker-ads/index.ts',
    find: "if (!laneAlarmOn && env.ADS_SHEETS_SYNC_ENABLED === 'true')",
    replace: "if (env.ADS_SHEETS_SYNC_ENABLED === 'true')",
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '시트 미러는 리스가 없다(커서 기반 append) — collect 는 겹쳐도 리스가 한쪽을 걸러 주지만 이 레인은 ' +
      '`!laneAlarmOn` 게이트가 이중 실행의 **유일한** 방어다. 게이트가 빠지면 알람과 cron 이 같은 정각에 ' +
      '겹쳐 돌아 구글시트에 행이 중복되고, 에러가 없어 아무도 모른다. 이 주입은 그 게이트 소실을 재현한다.',
  },
  {
    name: '수집 레인 시간당 상한이 조용히 증설됨',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: '  collect: {\n    runsPerHour: 1,\n',
    replace: '  collect: {\n',
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '빼면 정책 기본값(12회/시간)을 받는다 = cron 설계 의도(`0 * * * *`)를 12배 넘는 증설이고, ' +
      '**네이버로 나가는 요청량이 늘어나는 변경**이라 대표 판단 사항이다. 값이 조용히 바뀌는 것을 막는다.',
  },
  {
    name: '3차 이관 match-registry cron 게이트 소실(알람과 이중 디스패치)',
    file: 'src/worker-ads/index.ts',
    find: "if (!laneAlarmOn) kick('/__ads/match-registry'",
    replace: "kick('/__ads/match-registry'",
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '이관 후 유일하게 계속 죽던 레인(×3, 2026-08-06 까지)이라 3차로 옮겼다. 게이트가 빠지면 ' +
      '알람과 cron 이 같은 정각에 겹쳐 던지고, 던지는 것 자체가 부모 CPU 를 먹는다 — ' +
      '그게 애초에 이 레인 계열을 죽인 원인이다(2·3차 공통 규약).',
  },
  {
    name: '키워드 수율 은퇴 소실 — 고갈 auto 가 슬롯을 영구 점유(신선도 회전 정지)',
    // 2026-08-09: SQL 이 rotation SSOT 조각(AUTO_RETIRE_WHERE)으로 이사 — 주입 표적도 따라간다.
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: 'yield: `COALESCE(found_total, 0) >= 50',
    replace: 'yield: `COALESCE(found_total, 0) >= 999999',
    test: 'src/tests/unit/ads-keyword-promotion-room.test.ts',
    why:
      'barren_streak 은 저장 0 회차 연속만 세므로 "가끔 1명씩 떨궈 streak 을 리셋하는"(found 50+/saved<10) ' +
      '저수율 auto 는 영영 은퇴하지 않는다(실측: 동작카페 91/2 · 중랑네일 94/3 이 자리 점유, ' +
      '승격 대기 2,981개가 밖). 임계를 사실상 무한대로 올리는 이 주입은 은퇴를 무력화한다.',
  },
  {
    name: 'enrich 킬스위치가 알람 러너에서 소실(죽은 손잡이 재발)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "if ((env as unknown as { ADS_INFLUENCER_ENRICH_DISABLED?: string }).ADS_INFLUENCER_ENRICH_DISABLED === 'true') return { skipped: 'disabled' }",
    replace: '',
    test: 'src/tests/unit/ads-enrich-shards.test.ts',
    why:
      '게이트가 cron 폴백 호출부에만 있으면 알람 모드(라이브)에서 스위치를 켜도 아무 일도 안 ' +
      '일어난다 — 2026-08-02 알람 이관 때 실제로 그렇게 유실됐고 2026-08-09 에 발견됐다. ' +
      '행동 테스트(run() 이 skipped 반환)가 잡는다.',
  },
  {
    name: '카페 게이트 폴백 소실 — 배포만으로 카페가 켜져 회차 예산을 먹는다',
    // 2026-08-11: 600줄 래칫으로 `collect-track-gates.ts` 로 분리 — 표적도 따라간다.
    file: 'src/features/marketing/api/collect-track-gates.ts',
    find: "  return (env as { ADS_COLLECT_CAFE_ENABLED?: string } | undefined)?.ADS_COLLECT_CAFE_ENABLED !== 'false'",
    replace: '  return true',
    test: 'src/tests/unit/ads-collect-gates.test.ts',
    why:
      '라이브 env 는 ADS_COLLECT_CAFE_ENABLED=false(카페 OFF)이고, 설정이 비어 있는 동안에는 그 env 를 ' +
      '따라야 한다. 폴백을 true 로 만들면 배포하는 순간 카페가 켜져 키워드당 1 서브리퀘스트를 먹는다 — ' +
      '지금은 회차 예산(56)이 캡이라 그만큼 키워드 폭이 줄어 발굴량이 직접 감소한다(카페 이메일은 0건).',
  },
  {
    name: 'YT 콜 세부 계측이 집계에서 탈락(예산 60% 트랙의 낭비율을 영영 못 봄)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: "          ytCalls.videos_empty = (ytCalls.videos_empty ?? 0) + (r.calls.videos_empty ?? 0)",
    replace: '',
    test: 'src/tests/unit/ads-collect-gates.test.ts',
    why:
      'DiscoverCalls 는 videos 콜의 성과(email/contact/cat/empty)를 이미 세는데 집계부가 3개만 옮겨 ' +
      '스냅샷에 도달하지 못했다("계산해 놓고 안 쓰면 소용없다"). videos_empty 가 곧 잘라도 되는 몫이라 ' +
      '이 줄이 빠지면 예산 60%를 쓰는 트랙을 다시 추측으로만 논하게 된다.',
  },
  {
    name: '순환 나이가 등록일 기준으로 회귀(승격 물결마다 가짜 starved 경보)',
    file: 'src/features/marketing/api/collect-health-alert.ts',
    find: "MAX(julianday('now') - julianday(COALESCE(last_run_at, activated_at, created_at))) AS oldest_days",
    replace: "MAX(julianday('now') - julianday(COALESCE(last_run_at, created_at))) AS oldest_days",
    test: 'src/tests/unit/ads-rotation-health.test.ts',
    why:
      '미실행 키워드 나이를 등록일로 재면 몇 주 잠자던 후보가 승격되는 순간 "N주 굶음"으로 보인다 — ' +
      '2026-08-10 실측: 댕댕이(07-21 생성→08-09 승격)가 즉시 3.7바퀴 starved 로 잡혀 대표에게 ' +
      '가짜 경보가 나갔다. cap 상향·가석방 복귀 등 승격 물결마다 재발하는 클래스.',
  },
  {
    name: '가석방 소실 — 은퇴 증거 유통기한이 빠지면 차단이 다시 영구 배제가 됨',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: ' AND COALESCE(saved_total, 0) < 10 AND ${FRESH_EVIDENCE}`',
    replace: ' AND COALESCE(saved_total, 0) < 10`',
    test: 'src/tests/unit/ads-keyword-promotion-room.test.ts',
    why:
      '대표 확정(2026-08-09) "영구 배제가 되면 안된다" — 은퇴 조건은 증거 신선도(30일)로 만료돼야 ' +
      '승격 차단(그 부정)도 함께 만료된다. 신선도 절을 빼면 그 클래스의 좀비는 영영 재도전을 못 받는다.',
  },
  {
    name: '은퇴↔승격 livelock 재무장 — 즉시-재은퇴 좀비가 승격 슬롯을 태움',
    file: 'src/features/marketing/api/influencer-keyword-promote.ts',
    // ⚠️ 2026-08-17 앵커 갱신 — 같은 줄에 `PROMOTE_COOLDOWN_SQL` 이 추가됐다. 옛 replace(`AND keyword IN`)는
    //   새 줄의 **부분문자열이라 잔재 검사가 상시 오탐**을 냈다(실제로 그렇게 잡혔다). 두 조각을 다 적어 유일하게 만든다.
    find: 'AND ${PROMOTE_NOT_RETIRABLE_SQL} AND ${PROMOTE_COOLDOWN_SQL} AND keyword IN',
    replace: 'AND ${PROMOTE_COOLDOWN_SQL} AND keyword IN',
    test: 'src/tests/unit/ads-keyword-promotion-room.test.ts',
    why:
      '은퇴는 active=0 만 쓰고 hits 는 재채굴마다 쌓인다 — 이 가드가 빠지면 은퇴자가 hits DESC 로 ' +
      '신선 큐를 제치고 재승격되고, 수율/F-30/barren 은 평생 카운터라 다음 회차 시작에 한 번도 안 돌고 ' +
      '재은퇴된다(2026-08-09 실측 좀비 5 · 게이트 통과 4). 승격 슬롯이 좀비에게 새는 livelock.',
  },
  {
    name: '자동 키워드 cap 이 조용히 60 으로 회귀(신선 유입 재차단)',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: 'export const MAX_AUTO_KEYWORDS = 120',
    replace: 'export const MAX_AUTO_KEYWORDS = 60',
    test: 'src/tests/unit/ads-keyword-promotion-room.test.ts',
    why:
      '07-21 발굴 스파이크(12,533/일)의 재현 조건이 신선 키워드 유입인데, cap 60 은 라이브에서 ' +
      'room 0 으로 꽉 차 있었다. 회귀하면 발굴이 다시 고갈 셋 반복으로 돌아간다 — 네이버 호출량과 ' +
      '무관한 값이라(회차 폭 6 은 별도 상수) 리스크 근거로 되돌릴 이유도 없다.',
  },
  {
    name: '4차 이관 daily-batch cron 게이트 소실(알람과 이중 실행 — 일일 배치는 멱등 보장이 없다)',
    file: 'src/worker-ads/index.ts',
    find: "if (!laneAlarmOn) gates.dailyAt(18, '/__ads/daily-batch'",
    replace: "gates.dailyAt(18, '/__ads/daily-batch'",
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '일 1회 레인 7개를 4차로 알람에 옮겼다(08-08 하루에만 5개가 부모 사망 회차에서 발화 실종). ' +
      'daily-batch 는 5단계 순차 배치라 알람과 cron 이 같은 18시에 겹치면 가격→순위→스냅샷이 ' +
      '두 번 돌며 이력이 이중 기록된다 — 게이트가 유일한 방어다.',
  },
  {
    name: '정비 알람이 재보정 시각 양보를 잃음(리스 경합 — 진 쪽이 흔적 없이 사라진다)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "if (new Date().getUTCHours() === RESCAN_HOUR_UTC) return { skipped: 'rescan_hour' }",
    replace: '',
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      'cron 시절 `hourlySchedule(PHASES, [RESCAN_HOUR_UTC])` 가 하던 양보를 알람 러너가 잃으면, ' +
      '시간당 최대 12회 도는 정비가 19시 내내 MAINT_LEASE 를 쥐어 일 1회뿐인 야간 재보정이 ' +
      '리스를 못 잡고 조용히 사라진다 — 침묵 경보 3.2일의 재발 경로다.',
  },
  {
    name: '3차 이관 commerce cron 게이트 소실 — 다른 파일(cron-public-data)이라 따로 지킨다',
    file: 'src/worker-ads/cron-public-data.ts',
    find: "if (!laneAlarmDrivesEnrich(env) && e.ADS_COMMERCE_ENABLED === 'true')",
    replace: "if (e.ADS_COMMERCE_ENABLED === 'true')",
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      'commerce 의 cron 등록은 index.ts 가 아니라 cron-public-data.ts 에 있다 — index.ts 만 지키는 ' +
      '검사라면 이 파일의 게이트가 사라져도 초록이다(낡은 지도 클래스). 08-08 23:00 KST 한 회차에 ' +
      'hira·commerce·storeinfo 가 몰살한 그 자리의 재발 방지.',
  },
  {
    name: '미루기 판정이 주기 대신 침묵 임계를 봄(매시간 레인이 통째로 always)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  const period = Number(lane.periodMin)\n  if (Number.isFinite(period) && period > 0) return period <= 60\n',
    replace: '',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '`gapMin` 은 `staleGapMinutes` = 주기×2+30 으로 **부풀린** 침묵 판정 임계다. 이 분기를 지우면 ' +
      '매시간 레인의 150 이 `> 60` 으로 읽혀 **전부 `always`** 가 된다(2026-08-03 12:00 KST 실측: ' +
      '네 도메인 전부 `deferred: 0`, 레인 14). 예산·학습기는 미룰 수 있는 레인에만 작용하므로 ' +
      '통제 대상이 0 개가 되고, #1007(예산 0 구속) 수리가 옳고도 무력해진다.',
  },
  {
    name: '게이트 레인에도 periodMin 60 을 실어 일 1회 레인이 미뤄짐',
    file: 'src/worker-ads/lane-cadence.ts',
    find: "  return opts?.gap === undefined ? { gapMin, periodMin: 60 } : { gapMin }",
    replace: '  return { gapMin, periodMin: 60 }',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '반대 방향의 사고 — 명시 `gap` 을 받은 게이트 레인(일 1회·N시간·스케줄)까지 매시간으로 표시하면 ' +
      '**미룰 수 있게** 되고, 그 레인의 조 차례가 지정 시각이 아닌 때 걸리는 순간 **영영 안 돈다**. ' +
      '침묵이 아니라 부재라 경보에도 안 잡힌다(`isDeferrable` docblock 이 경고하는 바로 그 형태).',
  },
  {
    name: '은퇴 축 리드를 안 비움(유령 카테고리 영구 잔존)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: '  if (retired.has(stored)) return true',
    replace: '  if (false) return true',
    test: 'src/tests/unit/ads-category-retire.test.ts',
    why:
      '축을 접어도 리드의 카테고리 값은 남는다 — 아무 규칙도 안 만드는 유령 값이 영구 잔존한다. ' +
      '재분류는 `classifyCategory` 가 null 이면 그대로 두므로 스스로 낫지 않는다.',
  },
  {
    name: '은퇴 축을 키워드 폴백이 다시 붙임(비우기와 무한 싸움)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: '!NON_CATEGORIES.has(kc) && !retired.has(kc)',
    replace: '!NON_CATEGORIES.has(kc)',
    test: 'src/tests/unit/ads-category-retire.test.ts',
    why:
      '비우기(①)만 있고 유입 차단(②)이 없으면 재분류가 지우고 저장이 다시 붙여 **영원히 제자리**다. ' +
      '두 경로는 짝이라 하나만 있으면 무의미하다.',
  },
  {
    name: '은퇴 축 키워드가 수집 슬롯을 계속 먹음',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '.filter(k => !k.category || !RETIRED_CATEGORIES.has(k.category))',
    replace: '',
    test: 'src/tests/unit/ads-category-retire.test.ts',
    why:
      '수집은 시간당 1회 · 회차당 16픽뿐이다(실측). 접은 축 키워드가 계속 순번을 받으면 살아있는 축이 ' +
      '그만큼 굶는다 — 대행사 축이 19개 중 17개를 못 돌던 것과 같은 희소성 문제다.',
  },
  {
    name: '예산 0 을 "미설정"으로 읽어 기본값 6 으로 바꿔치기(제어 반전)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'perTick >= 0 ? Math.floor(perTick)',
    replace: 'perTick >= 1 ? Math.floor(perTick)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '`domainBudgets` 는 예산이 도메인 수보다 적으면 **일부러 0 을 주고 회전**시킨다(그 함수 docblock). ' +
      '여기서 0 을 걸러 기본값 6 으로 바꾸면 **조일수록 레인이 늘어나는 제어 반전**이 된다 — ' +
      '실측(2026-08-03 11:00 KST, 학습 cap 2): 예산 0 인 두 도메인이 3개·6개를 띄워 총 11개. ' +
      '그 붕괴가 부모 꼬리의 `writeTickSummary`·`sheets-sync` 를 지워 학습기가 더 조이는 폭주 고리였다.',
  },
  {
    name: '쉬는 회차에도 cap 하한 1 을 깔아 "쉬어라"가 무효화됨',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)',
    replace: 'const cap = Math.max(1, budget - always.length)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '위 수리의 짝이다. 0 을 제대로 읽어도 하한 1 이 남아 있으면 쉬는 조가 매 회차 1개씩 띄운다 — ' +
      '도메인 수만큼 곱해지면 학습기 판단(cap 2)이 다시 안 맞는다. 하한은 *자리를 받은* 조에만 있어야 한다.',
  },
  {
    // ⚠️ 2026-08-17 병합 사고 흔적 — 유니온 해소가 `},\n  {` 경계를 삼켜 **두 주입이 한 객체로 융합**됐다.
    //   JS 는 뒤엣 키가 이기므로 위 `쉬는 회차 cap 하한` 주입이 **통째로 사라져 있었다**(에러 없이).
    //   객체 리터럴을 유니온으로 풀 때의 두 번째 실패 형태다 — 첫째는 같은 키 두 벌(위 tier 주입).
    name: 'YT 건너뛴 행이 스탬프를 못 받아 영구 선두(재선택 churn)',
    // ⚠️ 2026-08-03 600줄 래칫으로 YT 성과가 이 파일로 분리됐다(순수 이동). 앵커가 안 따라오면
    //   이 주입은 "find 문자열이 소스에 없음"으로 낡은 지도 판정을 받는다 — 그게 이 러너의 모드 ②다.
    file: 'src/features/marketing/api/influencer-yt-performance.ts',
    find: "category_source = COALESCE(?, category_source), pub_checked_at = datetime('now') WHERE id = ?",
    replace: 'category_source = COALESCE(?, category_source) WHERE id = ?',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '선택 순서가 `(pub_checked_at IS NULL) DESC` 다. 스탬프가 없으면 예산으로 건너뛴 행이 **다음 회차에도 ' +
      '맨 앞**이라 채널콜을 또 태운다. 실측: PT 하루 2,003 units 로 106행만 측정 = **19콜/행**(코드상 2~3콜).',
  },
  {
    name: 'YT 성과 상한이 고정으로 회귀(검색 유휴분을 못 씀)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: 'resolveYtPerfCap(ytSearchCalls * YT_SEARCH_UNIT_COST, env.ADS_YT_PERF_UNITS)',
    replace: 'Math.min(9000, YT_PERF_UNITS_DEFAULT)',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '실측: 검색 배정 9,000 중 2,200만 쓰는데 성과는 2,000 상한에 걸려 **그날 남은 시간 측정 0**. ' +
      '멎은 쪽이 수율이 더 높은 축이다(YT 45.2% vs 블로그 28.6%). 총 쿼터의 58%가 놀고 있었다.',
  },
  {
    name: '선두 기록 누락 — 교대가 성립하지 않음',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: "    led: naverFirst ? 'naver' : 'front',\n",
    replace: '',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      'DO 알람에선 `depth` 가 항상 0 이라 `depth % 2 === 1` 교대가 **영원히 거짓**이다. 직전 선두를 ' +
      '기록해야 교대가 성립한다. YT 상한을 푼 뒤에는 이게 없으면 블로거가 굶는다 — 두 수리는 한 몸이다.',
  },
  {
    name: '알람이 cron 시절 7초 창을 그대로 씀',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "return runInfluencerEnrich(env, 0, undefined, k > 1 ? { i, k } : null, { driver: 'alarm', naverOnly: i > 0 })",
    replace: 'return runInfluencerEnrich(env)',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '7초의 근거는 *"부모 인보케이션이 10.5초에 회수되고 자식이 함께 죽는다"* 였다. **알람엔 부모가 없다** — ' +
      '같은 알람의 collect 가 28,643ms 완주가 증거다. 전제가 사라진 값을 그대로 쓰면 창이 근거 없이 좁다.',
  },
  {
    name: '알람 부트스트랩이 죽은 체인을 못 살림(레인이 조용히 멎는다)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'const kind = alarmReviveKind(cur, Date.now())',
    replace: "const kind = cur == null ? 'none' : 'alive'",
    test: 'src/tests/unit/ads-alarm-revive.test.ts',
    why:
      '이게 2026-08-09 사고 그 자체다 — `getAlarm()` 이 non-null 이면 "이미 걸려 있다"며 넘어가는데, ' +
      '**예약 시각이 3.5시간 과거인데 안 깨어난** 인스턴스가 정확히 그 상태였다. 매 정각 확인하면서 ' +
      '매 정각 못 살려 측정 갈래가 6시간 죽어 있었고, 하트비트는 계속 초록이었다.',
  },
  {
    name: '알람 사망 판정 여유가 간격보다 짧음(정상 지연을 덮어써 회차를 잃음)',
    file: 'src/worker-ads/lane-alarm-policy.ts',
    find: 'export const ALARM_DEAD_AFTER_MS = 30 * 60_000',
    replace: 'export const ALARM_DEAD_AFTER_MS = 30_000',
    test: 'src/tests/unit/ads-alarm-revive.test.ts',
    why:
      '**부호만 반대인 같은 고장.** 런타임의 알람 발화는 정확하지 않아 수십 초~수 분 지연이 정상인데, ' +
      '여유가 간격보다 짧으면 그 정상 지연을 죽음으로 오판해 알람을 계속 덮어쓴다 → 고치려던 것과 ' +
      '반대로 회차를 잃는다. 되살리기를 넣을 때 반드시 같이 고정해야 하는 짝이다.',
  },
  {
    name: '측정 샤드가 slice 를 안 넘김(같은 사람 중복 측정 — 늘린 만큼 손해)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: 'k > 1 ? { i, k } : null',
    replace: 'null',
    test: 'src/tests/unit/ads-enrich-shards.test.ts',
    why:
      '이 큐는 선점이 아니라 정렬+LIMIT 이라, slice 없이 샤드를 늘리면 **전부 같은 앞머리**를 집는다. ' +
      '처리량은 그대로인데 예산만 샤드 수만큼 태운다. ⚠️ `sliceClause` 순수함수 검증만으로는 이걸 못 잡는다 ' +
      '(2026-08-09 주입 실험에서 실제로 초록이 떴다) — 러너의 배선을 직접 봐야 한다.',
  },
  {
    name: '측정 샤드 1+ 가 YT 도 돎(이미 초과인 일 쿼터를 샤드 수만큼 태움)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: 'naverOnly: i > 0',
    replace: 'naverOnly: false',
    test: 'src/tests/unit/ads-enrich-shards.test.ts',
    why:
      '`enrichYouTubePerformance` 는 `slice` 를 안 받아 샤드마다 **통째로 반복**된다. YT 쿼터는 이미 ' +
      '초과 상태이고 미측정 백로그의 98%는 네이버다(youtube 667명뿐) — 순손해다.',
  },
  {
    name: 'naverOnly 가 앞 레인을 안 건너뜀(플래그만 있고 무력)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    // 🗺️ 2026-08-12 앵커 이사: 이 분기에 여력 자동배치 폴백이 붙었다(블로그가 마르면 링크인바이오).
    //   지키는 불변식은 그대로 — **YT 는 여전히 안 부른다**(샤드 수만큼 쿼터가 곱해진다).
    find: '    await runNaver(0)\n    // ♻️ 여력 자동배치',
    replace: '    await runNaver(0); await runFront()\n    // ♻️ 여력 자동배치',
    test: 'src/tests/unit/ads-enrich-shards.test.ts',
    why:
      '플래그를 넘겨도 분기가 앞 레인(bio+YT)을 그대로 돌면 쿼터 보호가 무효다 — ' +
      '"스위치는 있는데 아무것도 안 끄는" 형태이고, 에러가 없어 조용히 통과한다.',
  },
  {
    name: '재업로드가 반응 시각을 덮음(COALESCE 제거)',
    file: 'src/features/marketing/api/outreach-status-ingest.ts',
    find: 'opened_at = COALESCE(opened_at, ?)',
    replace: 'opened_at = ?',
    test: 'src/tests/unit/ads-outreach-status-ingest.test.ts',
    why:
      '같은 파일을 두 번 올리면 "방금 열었다"로 덮여 반응 시점 분석이 망가진다. 멱등은 "에러가 안 난다"가 ' +
      '아니라 **최종 상태가 같다** 는 뜻이다.',
  },
  {
    name: 'sent 가 contacted_at 을 덮어 리마인더가 영원히 안 나감',
    file: 'src/features/marketing/api/outreach-status-ingest.ts',
    find: 'contacted_at = COALESCE(contacted_at, ?)',
    replace: 'contacted_at = ?',
    test: 'src/tests/unit/ads-outreach-status-ingest.test.ts',
    why:
      'contacted_at 은 발송 큐/리마인더의 "이미 보냈나·언제" 판정에 쓰인다. 재업로드가 갱신하면 D+N 창이 ' +
      '매번 밀려 **후속 발송이 구조적으로 0** 이 된다. 에러가 안 나서 안 보이는 종류다.',
  },
  {
    name: '수신거부가 opted_out 을 안 세움(또는 다른 상태가 세움)',
    file: 'src/features/marketing/api/outreach-status-ingest.ts',
    find: "case 'opt_out':",
    replace: "case 'sent2':",
    test: 'src/tests/unit/ads-outreach-status-ingest.test.ts',
    why:
      '수신거부는 법적 의사표시다. 안 세우면 다음 발송에 그 사람이 다시 뽑히고, 반대로 다른 상태가 세우면 ' +
      '멀쩡한 리드가 영구 제외된다(해제는 사람만 한다).',
  },
  {
    name: '미매칭을 안 세어 반쯤 먹힌 업로드가 성공으로 보임',
    file: 'src/features/marketing/api/outreach-status-ingest.ts',
    find: '    if (ch === 0) out.unmatched++',
    replace: '    if (false) out.unmatched++',
    test: 'src/tests/unit/ads-outreach-status-ingest.test.ts',
    why:
      '주소가 풀에 없으면 changes 0 인데 그걸 안 세면 응답이 "성공"이다. 이 레포가 반복해 만난 ' +
      '*"실패가 아니라 부재"* 클래스 — 유입구에서 특히 위험하다(대표는 넣었다고 믿는다).',
  },
  {
    name: 'YT 몫이 옛 비율로 회귀(서브리퀘스트당 이메일 2.5배를 버림)',
    file: 'src/features/marketing/api/influencer-enrich-plan.ts',
    find: 'Math.min(20, Math.floor(usable * 0.55))',
    replace: 'Math.min(20, Math.floor(usable * 0.35))',
    test: 'src/tests/unit/ads-enrich-yt-priority.test.ts',
    why:
      'YT 는 건당 1 fetch, 블로거는 2 인데 같은 날 수율은 YT 가 더 높다(26.7% vs 21.2%) — ' +
      '서브리퀘스트당 2.5배다. 비율이 돌아가면 같은 예산으로 얻는 이메일이 조용히 줄어든다.',
  },
  {
    name: '블로거 선두 회차가 YT 몫까지 먹음(그 회차 YT 0행)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: 'naverRoomWithYtReserve(budget.left, naverMax, ytReserve)',
    replace: 'naverRoomFromRemaining(budget.left, naverMax)',
    test: 'src/tests/unit/ads-enrich-yt-priority.test.ts',
    why:
      '`naverRoomFromRemaining` 은 `max(planned, affordable)` 이라 선두일 때 예산 전체를 가져간다. ' +
      '그러면 **회차의 절반에서 YT 가 한 명도 못 재고**, ytMax 를 올린 의미가 통째로 사라진다. ' +
      '에러가 없어 안 보이는 종류 — 스냅샷의 yt 가 0 인 회차로만 드러난다.',
  },
  {
    name: '발송 큐가 중복 주소를 그대로 내보냄(같은 사람에게 두 번)',
    file: 'src/features/marketing/api/outreach-queue.ts',
    find: 'return dedupeByEmail((rows?.results || []) as T[]).slice(0, limit)',
    replace: 'return ((rows?.results || []) as T[]).slice(0, limit)',
    test: 'src/tests/unit/ads-outreach-dedupe-wiring.test.ts',
    why:
      '실측 130그룹/262행 — 그대로 두면 132통이 두 번째로 나간다. 상대는 짜증나고 브랜드가 깎이며, ' +
      '회신률 통계까지 흐려진다(같은 사람을 두 번 센다).',
  },
  {
    name: '연락 대상 내보내기가 중복 주소를 그대로 담음',
    file: 'src/features/marketing/api/influencer-pool-export.ts',
    find: "const outRows = opts?.contactable ? dedupeByEmail(rows) : rows",
    replace: 'const outRows = rows',
    test: 'src/tests/unit/ads-outreach-dedupe-wiring.test.ts',
    why:
      '대표의 실제 워크플로는 **엑셀 내보내기 → 직접 발송**이라, 큐만 고치고 내보내기를 빼면 ' +
      '정작 발송되는 경로에는 중복이 그대로 남는다(고친 줄 알고 안 고친 형태).',
  },
  {
    name: '결과 화면이 파서를 다시 짬(인식 건수와 실제 반영이 갈라짐)',
    file: 'src/pages/admin/influencer-pool/OutreachResultPanel.tsx',
    find: "  parseOutreachCsv, OUTREACH_STATUSES, OUTREACH_INGEST_MAX,",
    replace: "  OUTREACH_STATUSES, OUTREACH_INGEST_MAX,\n  parseOutreachCsv as _unusedParse,",
    test: 'src/tests/unit/ads-outreach-result-panel.test.tsx',
    why:
      '화면이 "인식 3건"이라 해놓고 서버가 다르게 세면 그 숫자는 **거짓말**이다. 파서 두 벌은 반드시 ' +
      '갈라진다 — 그러면 대표는 넣었다고 믿는데 절반만 들어간다(이 기능의 존재 이유가 그 오해를 없애는 것).',
  },
  {
    name: '결과 500 상한을 안 나눠 보냄(초과분 조용히 유실)',
    file: 'src/pages/admin/influencer-pool/OutreachResultPanel.tsx',
    find: 'i += OUTREACH_INGEST_MAX',
    replace: 'i += 100000',
    test: 'src/tests/unit/ads-outreach-result-panel.test.tsx',
    why:
      '서버는 500 초과를 400 으로 거절한다. 안 나누면 큰 파일이 통째로 실패하고, 대표는 파일을 ' +
      '손으로 쪼개야 한다 — 그 마찰이 곧 "결과가 안 들어옴"이고 이 화면을 만든 이유가 사라진다.',
  },
  {
    name: '미매칭이 화면에 안 남음(절반만 먹힌 업로드가 성공으로 보임)',
    file: 'src/pages/admin/influencer-pool/OutreachResultPanel.tsx',
    find: "{' · '}미매칭 <b>{formatNumber(result.unmatched)}</b>건",
    replace: '',
    test: 'src/tests/unit/ads-outreach-result-panel.test.tsx',
    why:
      '미매칭(풀에 없는 주소)은 **조용한 0건과 구분이 안 된다**. 토스트로 흘리면 사라지고, ' +
      '대표는 반영됐다고 믿는다 — 이 레포가 반복해 만난 *"실패가 아니라 부재"* 클래스.',
  },
  {
    name: '결과 화면이 페이지에서 떨어짐(엔드포인트만 남고 화면 0)',
    file: 'src/pages/admin/AdminInfluencerPoolPage.tsx',
    find: '            <OutreachResultPanel />',
    replace: '            {false && <OutreachResultPanel />}',
    test: 'src/tests/unit/ads-outreach-result-panel.test.tsx',
    why:
      '이 기능의 실패 모드는 "서버가 틀린다"가 아니라 **"사람이 못 넣는다"** 이다 — 실제로 ' +
      '엔드포인트만 있고 화면이 없어 라이브 email_status 가 0건이었다. 배선이 빠지면 그 상태로 되돌아간다.',
  },
  {
    name: 'CSV 파서가 열 순서를 강제함(첫 업로드가 통째로 invalid)',
    file: 'src/features/marketing/api/outreach-status-ingest.ts',
    find: '      email = cols.map(normEmail).find(Boolean) || null',
    replace: '      email = null',
    test: 'src/tests/unit/ads-outreach-status-ingest.test.ts',
    why:
      '메일 도구마다 열 구성이 다르고 우리는 대표가 쓰는 도구의 출력을 본 적이 없다. 순서를 강제하면 ' +
      '첫 파일이 통째로 무시되고, 그 왕복이 곧 "결과가 안 들어옴"이다.',
  },
  {
    name: '티스토리 수집만 되살아남(측정 안 될 행을 계속 쌓음)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: ".ADS_COLLECT_TISTORY_DISABLED !== 'false'",
    replace: ".ADS_COLLECT_TISTORY_DISABLED === 'true'",
    test: 'src/tests/unit/ads-tistory-enrich.test.ts',
    why:
      '2026-08-04 라이브 판정에서 실제로 이 반쪽 상태였다 — 측정 몫만 0 으로 했더니 ' +
      '`enrich tistory.tried 0` 인데 `collect spend_by.tistory 5 · found 17`. **영원히 측정 안 될 행을 ' +
      '회차당 5 서브리퀘스트 써서 쌓는** 상태로, 접기 전보다 나쁘다. 축은 둘 다 접거나 둘 다 켠다.',
  },
  {
    name: '티스토리가 조용히 되살아남(수율 3.0%)',
    file: 'src/features/marketing/api/influencer-tistory-performance.ts',
    find: 'export const TISTORY_ROOM = 0',
    replace: 'export const TISTORY_ROOM = 2',
    test: 'src/tests/unit/ads-tistory-enrich.test.ts',
    why:
      '2026-08-04 실측으로 접었다(측정 397 → 이메일 12 = 3.0%, 네이버 26.7%·유튜브 40.6%). 되살리려면 ' +
      '**수율이 왜 올랐는지 근거가 먼저**다. env(ADS_TISTORY_ROOM)로는 열려 있으니 코드 기본값은 0 이어야 한다.',
  },
  {
    name: '순환 축 억제가 되돌릴 수 없게 됨(탐침 회차 제거)',
    file: 'src/features/marketing/api/influencer-keyword-yield.ts',
    find: '  if (roundIndex % ROTATION_PROBE_EVERY === 0) return pool',
    replace: '  if (false) return pool',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '억제된 키워드는 더 이상 수집되지 않아 **증거가 영영 갱신되지 않는다** — 판정이 틀려도 스스로 ' +
      '뒤집힐 수 없다. 밴딧에서 탐색(exploration)을 없애는 것과 같고, 그러면 자동 조율이 아니라 영구 배제다.',
  },
  {
    name: '순환 풀이 비어 그 축이 통째로 멈춤',
    file: 'src/features/marketing/api/influencer-keyword-yield.ts',
    find: '  return kept.length ? kept : pool',
    replace: '  return kept',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '한 축의 키워드가 전부 저수율이면 풀이 빈 배열이 되어 그 축은 그 회차에 아무것도 안 돈다. ' +
      '고쳐야 할 건 키워드지 수집이 아니다(집중 축 커서 동결 → 커버리지 붕괴와 같은 클래스).',
  },
  {
    name: '순환 축이 표본 부족 키워드를 벌해 탐색이 죽음',
    file: 'src/features/marketing/api/influencer-keyword-yield.ts',
    find: '  if (m < ROTATION_EVIDENCE_MIN) return false',
    replace: '  if (false) return false',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '새 키워드는 nb_measured 0 이라 수율도 0 이다. 게이트가 없으면 **모든 신규 키워드가 첫 회차에 낙인**' +
      '찍혀 영원히 억제된다 — 자동 조율이 아니라 신규 축 차단기가 된다.',
  },
  {
    name: '순환 축 분모에 **안 훑은 행**이 들어감(백로그를 키워드 탓으로)',
    file: 'src/features/marketing/api/influencer-keyword-yield.ts',
    find: 'AND perf_checked_at IS NOT NULL THEN 1 ELSE 0 END) AS nb_measured',
    replace: 'THEN 1 ELSE 0 END) AS nb_measured',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '이 파일 상단이 경고한 바로 그 함정이다 — 네이버는 우리 측정 백로그 때문에 낮게 보인다. 분모를 ' +
      '**측정 완료**로 한정해야 "아직 안 훑은 키워드"가 낮게 나올 수가 없다. 이 조건이 빠지면 미측정 ' +
      '20,105행이 전부 분모에 들어가 **멀쩡한 키워드가 통째로 억제**된다.',
  },
  {
    name: '순환 풀이 억제를 안 부름(상수만 있고 배선 없음)',
    file: 'src/features/marketing/api/keyword-contact-yield.ts',
    find: '  const trim = (p: T[]) => suppressLowRotationYield(p, roundIndex)',
    replace: '  const trim = (p: T[]) => p',
    test: 'src/tests/unit/influencer-keyword-yield.test.ts',
    why:
      '정책 함수가 있어도 순환 풀이 안 부르면 네이버/일반은 그대로다. 유튜브 감점이 여기 안 닿는다는 것이 ' +
      '이 작업의 출발점이었다(방배동 맛집 0% 가 계속 돌던 이유).',
  },
  {
    name: '폭 분기 소실 — YT 쿼터 소진 회차가 예산 절반을 남기고 끝난다',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '  const roundCap = naverOnlyRound ? naverOnlyRoundCap(env) : keywordsPerRoundCap(env)',
    replace: '  const roundCap = keywordsPerRoundCap(env)',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '라이브 실측(2026-08-12 06:00): YT 쿼터 소진 후 회차가 `spent 29 / 56` 으로 끝났다 — 폭 9 에서 멈춰 ' +
      '**예산 27 을 남기고** 종료. 네이버 전용은 키워드당 ~3.2 라 56 이면 ~17개를 돌 수 있다. ' +
      '분기가 사라지면 하루의 상당 시간(YT 쿼터는 이른 시간에 소진) 동안 예산 절반이 그냥 남는다.',
  },
  {
    name: '네이버 전용 캡이 YT 캡보다 좁아짐(확장이 축소로 뒤집힘)',
    file: 'src/features/marketing/api/influencer-round-width.ts',
    find: '  return Math.max(COLLECT_KEYWORDS_PER_ROUND, COLLECT_KEYWORDS_PER_ROUND_NAVER_ONLY)',
    replace: '  return Math.min(COLLECT_KEYWORDS_PER_ROUND, COLLECT_KEYWORDS_PER_ROUND_NAVER_ONLY)',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      'env 오타나 상수 되돌림으로 네이버 전용 폭이 YT 폭보다 좁아지면 이 수리가 **반대로 작동**한다 — ' +
      '유휴 예산을 회수하려던 회차가 오히려 더 좁아진다. 에러가 없어 관측만으로는 안 보인다.',
  },
  {
    name: '계획 폭이 두 형상을 섞음 — 폭 확장이 스스로를 영구 차단(부트스트랩 교착)',
    file: 'src/features/marketing/api/influencer-keyword-order.ts',
    find: '  return planRoundWidth(sameShape.map(f => Number(f.processed) || 0), hardMax)',
    replace: '  const src = sameShape.length ? sameShape : recent\n  return planRoundWidth(src.map(f => Number(f.processed) || 0), hardMax)',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '**2026-08-13 라이브 판정에서 실제로 당한 결함**이다(그 폴백이 첫 구현이었다). 네이버 전용 회차를 넓히려면 ' +
      '네이버 전용 이력이 필요한데, 넓혀진 적이 없으니 그 이력이 생길 수 없다 → 영원히 안 넓혀진다. ' +
      '실측: 08-13 15:00 회차가 yt지출 0 인데 `planned 9 · spent 34/56`(예산 22 유휴)로 끝났다. ' +
      '이 레포가 반복해 만난 "실패할 수 없는 가드"의 거울상 = **발동할 수 없는 정책**이고, 에러가 없어 안 보인다.',
  },
  {
    name: '수집 폭 동결이 풀림(측정이 병목인데 백로그가 증가 반전)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    if (processedIds.size >= roundCap) break',
    replace: '',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '네이버 enrichMax 축소로 키워드당 비용이 ~10.4 → ~6 이 되면 루프가 **자동으로** 회차당 5 → 9개를 돈다. ' +
      '실측: 블로그 유입 3,895/일 vs 측정 4,184/일(여유 +289). 폭을 1.8배로 넓히면 유입 ~7,000 → ' +
      '백로그가 매일 +2,800 으로 **증가 반전**한다. 새 행은 이메일 1.3% 라 행 수만 늘고 발송 가능 리드는 안 는다.',
  },
  {
    name: '네이버 수집 시점 보강이 원래대로(예산 54% 재소모)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: 'enrichMax: NAVER_COLLECT_ENRICH_MAX',
    replace: 'enrichMax: 5',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '실측 `spend_by` 에서 네이버가 회차 예산의 54%(28/56)를 쓰는데 그 산출은 미측정 행 이메일 **1.3%** 다. ' +
      '키워드당 발굴 69명 중 5명(7%)만 보강하기 때문 — 보강 레인은 같은 사람들을 100% 커버해 25% 로 만든다. ' +
      '즉 어차피 할 일의 7%를 미리 하면서 예산 절반을 쓰는 중복이다.',
  },
  {
    name: '집중 축이 다시 앞머리 독점(일반 풀 커서 동결 — 커버리지 붕괴)',
    // ⚠️ 앵커가 두 번 이사했다: 600줄 래칫으로 이 파일에 추출(2026-08-04) → 병합이 1:1:1 에서
    //   **몫 비례**로 바뀜(2026-08-11). 지키는 불변식(비지 않은 축이 앞 5개 안)은 그대로다.
    file: 'src/features/marketing/api/influencer-keyword-order.ts',
    find: '      const key = (taken[i] + 0.5) / pools[i].length   // 몫이 클수록 촘촘히 배치된다',
    replace: '      const key = i === 0 ? -1 : (taken[i] + 0.5) / pools[i].length',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '회차는 `planned 16 → processed 5`(예산 56/56 소진)다. 집중 축을 앞머리에 두면 4개가 앞자리를 먹고 ' +
      '일반 풀엔 1개만 남는다. `prefixDone` 은 처리된 **앞부분만** 세므로 뒤 풀은 커서도 안 움직여 ' +
      '**같은 키워드를 무한 재실행**한다 — 실측: 활성 399 중 323개가 이틀째 미실행, 24h 실행 54개뿐.',
  },
  {
    name: '병합이 다시 1:1:1(잘림이 비대칭 — 큰 축만 깎임)',
    file: 'src/features/marketing/api/influencer-keyword-order.ts',
    find: '      const key = (taken[i] + 0.5) / pools[i].length   // 몫이 클수록 촘촘히 배치된다',
    replace: '      const key = taken[i] + 0.5',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '세 축을 한 개씩 번갈아 놓으면 회차가 예산에서 끊길 때 **작은 축은 몫을 다 지키고 큰 축만 깎인다.** ' +
      '라이브 실측(2026-08-11): 풀 집중 25·우선 358·일반 76 에서 계획 1/6/2 인데 예산 5 에서 잘려 ' +
      '우선이 6→2 로 무너졌다. 키워드 1개당 회전율이 설계(1.5:1:0.5) 대비 **7.3 : 1 : 3.2** — ' +
      '대표가 정한 축 우선순위가 코드에서 뒤집혀 본업 축(맛집·뷰티·숙소·공동구매, 전체의 78%)이 가장 느렸다.',
  },
  {
    name: '회복 중에도 순환 경보가 울림(밀린 무리가 줄어도 starved)',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '    if (Number.isFinite(now) && Number.isFinite(prev) && now < prev) {',
    replace: '    if (false) {',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '`oldestDays` 는 최악값 하나라 밀린 키워드가 차례를 기다리는 동안 계속 커진다 — 수리가 먹혀 ' +
      '밀린 무리를 갚는 며칠 내내 경보가 울린다. 실측: 7일+ 밀린 수 107 → 60(−44%) 인데 worstCycles 는 ' +
      '3.46 으로 올랐다. 매일 울리는 경보는 진짜 정지를 덮는다(이 레포가 반복해 겪은 병).',
  },
  {
    name: '순환 경보가 무조건 침묵(진짜 정지도 안 울림)',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '    if (Number.isFinite(now) && Number.isFinite(prev) && now < prev) {',
    replace: '    if (true) {',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '억제 조건이 무조건 참이 되면 밀린 무리가 **늘어도** 조용하다. 경보를 끄는 수리가 경보를 ' +
      '죽이는 것으로 넘어가지 않게 양방향으로 고정한다(직전 표본이 없을 때도 울려야 한다).',
  },
  {
    name: '슬롯 cron 이 캐리어 주기로 기록됨(하루 1회 작업이 매일 오탐)',
    file: 'src/worker/scheduled.ts',
    find: '  const slotCron = (expr: string) => (n: string, t: () => Promise<unknown>) => safeCron(n, t, expectedMaxAgeMinutes(expr) ?? undefined);',
    replace: '  const slotCron = (_expr: string) => (n: string, t: () => Promise<unknown>) => safeCron(n, t);',
    test: 'src/tests/unit/cron-slot-cadence.test.ts',
    why:
      '소비자 cron 은 5분 캐리어에 얹혀 `slotDue` 로 자기 시각에만 도는데, 하트비트엔 캐리어 식이 기록된다. ' +
      '경보는 기대치를 **40분**(5×2+30)으로 잡아 하루 1회 작업을 23시간 내내 stale 로 신고한다 — ' +
      '2026-08-13 실측 `cron 실패 24h 8건`이 **전부** 이 오탐이었다. 매일 울리는 경보는 진짜를 덮는다.',
  },
  {
    name: '여력 자동배치가 바쁜 트랙을 뺏음(고를 행이 있어도 갈아탐)',
    file: 'src/features/marketing/api/enrich-capacity.ts',
    find: '  if (i.selected > 0) return false                                            // 할 일이 있었다',
    replace: '  if (false) return false',
    test: 'src/tests/unit/ads-enrich-capacity.test.ts',
    why:
      '폴백 판정은 `selected === 0`(고를 행이 하나도 없음)일 때만이어야 한다. 이 가드가 죽으면 ' +
      '**가장 바쁠 때** 블로그를 버리고 링크인바이오로 갈아탄다 — 백로그가 클수록 더 자주 갈아타는 최악의 형태다.',
  },
  {
    name: '여력 자동배치 배선이 사라짐(블로그가 말라도 샤드가 논다)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: '      try { bio = await enrichPoolFromLinkInBio(DB, budget, bioMax) } catch (err) { note(err) }',
    replace: '      void bioMax',
    test: 'src/tests/unit/ads-enrich-capacity.test.ts',
    why:
      '측정 샤드 1~3번은 블로그 전용이라, 블로그 백로그가 마르면 **예산이 남는데 아무 일도 안 한다.** ' +
      '라이브(2026-08-12 20:35): 블로그 1,423(2시간 뒤 0) · 유튜브 667 미측정 · 측정 능력이 유입의 3.5배 — ' +
      '사람이 그때 설정을 바꿔 주지 않으면 능력의 3분의 2가 논다. 대표 지시 "여력 자동배치".',
  },
  {
    name: '앞자리 회전이 사라짐(뒤쪽 축 커서가 영구 동결)',
    file: 'src/features/marketing/api/influencer-keyword-order.ts',
    find: '    out.push(pools[lead][taken[lead]++])',
    replace: '    void lead',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '커서 전진은 `prefixDone`(처리된 **선행** 픽 수)인데 회차가 예산에서 잘린다(계획 16 → 처리 7). ' +
      '뒤쪽 축은 매번 잘려 prefixDone=0 → 커서가 영원히 제자리 → 다음 회차도 같은 키워드. ' +
      '라이브 실측: 앞자리를 집중→우선으로 바꾸자 움직이는 커서도 그대로 바뀌었다(집중 17 전진/우선 5 정지 ' +
      '→ 우선 5→51 전진/집중 1 정지). 우선 축 102개가 그 사이 15일간 순번을 못 받았다.',
  },
  {
    name: '회차 폭이 처리 능력을 무시(초과 계획 = 기아 장치)',
    file: 'src/features/marketing/api/influencer-keyword-order.ts',
    find: '  if (!seen.length) return cap                       // 증거 없음 → 종전 동작',
    replace: '  if (true) return cap',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '계획 16 · 처리 7 이면 9개가 매 회차 뽑혔다가 잘린다. 잘리는 자리의 축은 커서가 안 밀려 ' +
      '**다음 회차에 같은 키워드를 또 내놓는다** — 초과 계획은 여유가 아니라 기아를 만드는 장치였다. ' +
      '총 처리량은 어차피 예산이 상한이라 안 줄고, 줄어드는 건 "뽑아 놓고 버리는 수"뿐이다.',
  },
  {
    name: '티스토리가 블로거 뒤로 밀림(잔여를 다 뺏겨 영원히 0)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    // 🗺️ 2026-08-04 앵커 이사: 몫이 상수 → `tistoryRoom(env)` 가 되고 `if (tisRoom > 0)` 으로 감싸졌다.
    //   지키는 불변식(티스토리가 블로거보다 **먼저**)은 그대로라 항목을 지우지 않고 따라간다.
    find: '      try { tistory = await enrichTistoryActivity(DB, budget, tisRoom, slice) } catch (err) { note(err) }\n',
    replace: '',
    test: 'src/tests/unit/ads-tistory-enrich.test.ts',
    why:
      '블로거는 `naverRoomFromRemaining` 으로 **잔여 전부**를 가져간다. 티스토리가 뒤에 서면 남는 예산이 없어 ' +
      '측정이 0으로 고착된다 — 에러 없이 조용히. ⚠️ 첫 판정이 `indexOf(\'enrichTistoryActivity\')` 라 맨 위 ' +
      '**import 문**을 먼저 찾아 초록이 떴다(import 는 언제나 첫 번째다) → 호출부로 앵커를 옮겼다. ' +
      '(현재 기본 몫은 0 이라 이 순서는 `ADS_TISTORY_ROOM` 으로 되살렸을 때를 위한 보험이다.)',
  },
  {
    name: '네이버 오픈API 계측이 래퍼에서 사라짐(그 레인이 통째로 계측 밖)',
    file: 'src/features/marketing/api/fetch-with-err.ts',
    // ⚠️ 2026-08-04: 이 줄이 `noteNaverCall(url)` 단독에서 **게이트 분기**로 바뀌었다(90% 목표).
    //   옛 find 는 그대로 두면 "주입 대상을 못 찾음(낡은 지도)"로 잡힌다 — 실제로 그렇게 잡혔다.
    find: "  if (!noteNaverCall(url)) return { res: null, err: 'NaverQuota: 일일 목표(90%) 소진' }\n  try {",
    replace: '  try {',
    test: 'src/tests/unit/ads-naver-api-usage.test.ts',
    why:
      '유튜브·카카오는 일별 실사용을 세는데 네이버만 카운터가 없어 "한도 안"이 **추정**이었다. 래퍼에서 빠지면 ' +
      '그 레인 호출이 통째로 계측 밖이 되고, 숫자는 그럴듯하게 남아 **더 위험하다**(0이 아니라 과소계상). ' +
      '⚠️ 이 주입은 *주석 처리* 다 — 첫 판정이 문자열만 봐서 초록이 떴고, 그래서 검사가 주석을 지우고 본다.',
  },
  {
    name: '네이버 계측이 회차당 두 번 take(뒤가 0 — 조용한 과소계상)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '+ takeNaverCalls()',
    replace: '+ takeNaverCalls() + takeNaverCalls()',
    test: 'src/tests/unit/ads-naver-api-usage.test.ts',
    why:
      '`takeNaverCalls()` 는 **가져가며 비운다**. 두 번 부르면 두 번째가 항상 0이라 합계가 맞는 것처럼 보이지만, ' +
      '중간에 다른 코드가 끼면 그 사이 누적이 통째로 사라진다. 호출은 회차당 정확히 한 번이어야 한다.',
  },
  {
    name: 'B2B 레인이 네이버 누적을 안 비움(그 인보케이션 몫 유실)',
    file: 'src/features/marketing/api/company-collect.ts',
    find: '  await flushNaverCalls(DB, Date.now())',
    replace: '  // await flushNaverCalls(DB, Date.now())',
    test: 'src/tests/unit/ads-naver-api-usage.test.ts',
    why:
      '네이버 쿼터는 **앱 단위**라 B2B 몫도 같은 통에 들어가야 총계가 의미를 갖는다. 안 비우면 그 인보케이션 ' +
      '누적은 사라진다 — 아이솔레이트가 달라 인플루언서 레인이 걷어가지 못한다.',
  },
  {
    name: 'YT 성과 바닥이 남은 쿼터를 무시(무료 한도 초과)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: 'const floor = Math.min(YT_PERF_UNITS_DEFAULT, Math.max(0, YT_DAILY_QUOTA_UNITS - used))',
    replace: 'const floor = YT_PERF_UNITS_DEFAULT',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '바닥 2,000 을 무조건 보장하면 **검색 9,000(배정 90회) + 성과 2,000 = 11,000 > 10,000** 이 성립한다. ' +
      '초과의 대가는 청구서가 아니라 403 quotaExceeded — 그날 측정이 통째로 멎는다. 바닥보다 **총합**이 상위 불변식이다.',
  },
  {
    name: 'YT 영상 통계 루프가 저장 몫을 안 남김(쿼터 태우고 저장 0)',
    file: 'src/features/marketing/api/influencer-yt-performance.ts',
    find: 'allIds.length && budget.left > 1 && !outOfTime(budget)',
    replace: 'allIds.length && budget.left > 0 && !outOfTime(budget)',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '루프 뒤 `DB.batch(stmts)` 가 이 회차 측정 전량의 **유일한** 쓰기다. D1 도 서브리퀘스트라 마지막 칸까지 ' +
      '쓰면 batch 가 던지고 `.catch(() => null)` 이 삼킨다 → 채널콜·영상콜 쿼터를 다 태우고 저장 0, 스탬프도 없어 ' +
      '그 행들이 다음 회차에도 맨 앞(이 PR 이 잡으려던 재선택 churn 을 되레 만든다).',
  },
  {
    name: '경보 채널이 비어 있다는 사실이 화면에서 안 보임',
    file: 'src/worker-ads/health.routes.ts',
    find: "      discord: e.DISCORD_WEBHOOK_URL ? '설정됨' : '🔴 미설정 — 아래 경보가 전부 무음',",
    replace: "      discord: '',",
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      '유어애즈 경보는 전부 `if (env.DISCORD_WEBHOOK_URL && …)` 라 값이 없으면 흔적 없이 건너뛴다 — ' +
      '**경보가 무음이라는 사실 자체가 무음**이다. 2026-08-03 실측: ur-ads 에 미설정이라 시트 미러가 ' +
      '이틀 멈춘 동안 디스코드 알림 0건. 같은 시점 메인(ur-live)엔 설정돼 있어 머니 경보는 정상이었고, ' +
      '**두 워커의 env 가 갈렸다는 걸 밖에서 확인할 방법이 없었다.** 값 설정은 대표 몫이지만 ' +
      '비어 있음이 보이는 것까지는 코드의 몫이다.',
  },
  {
    name: '경보 실발사 확인 라우트가 결과를 삼킴(자기 존재 이유 상실)',
    file: 'src/worker-ads/health.routes.ts',
    find: '    return c.json({ ok: res.ok, status: res.status, ms: Date.now() - t0',
    replace: '    return c.json({ ok: true, ms: Date.now() - t0',
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      '이 라우트는 "설정됨"과 "실제로 도착함"을 가르려고 만든 것이다. Discord 상태를 안 돌려주고 ' +
      '`ok: true` 만 주면 **오타난 웹훅도 초록**이라 라우트 자체가 같은 병에 걸린다 — 그러면 ' +
      '대표는 채널이 살아 있다고 믿고 다음 장애를 또 놓친다.',
  },
  {
    name: '실발사 확인 응답에 웹훅 URL 을 실음(채널 탈취)',
    file: 'src/worker-ads/health.routes.ts',
    find: "hint: res.ok ? '전송됨 — 채널에 도착했는지 눈으로 확인' : '웹훅 URL/채널 확인 필요'",
    replace: 'webhook: url',
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      'Discord 웹훅 URL 은 그 자체가 자격증명이다 — 아는 사람은 누구나 그 채널에 글을 쓸 수 있다. ' +
      '진단 응답에 실으면 어드민 화면·로그·스크린샷을 타고 새어 나간다.',
  },
  {
    name: '어드민 위임이 경보 확인 결과를 삼킴(오타난 웹훅이 초록)',
    file: 'src/features/marketing/api/admin-ads-pool-ops.routes.ts',
    find: 'return c.json({ success: !!j?.ok, status: j?.status ?? null',
    replace: 'return c.json({ success: true, status: null',
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      'ur-ads 가 Discord HTTP 상태를 그대로 돌려주도록 만들어 놨는데, 위임이 그걸 뭉개면 ' +
      '**오타난 웹훅·삭제된 채널도 초록**으로 보인다. 그러면 대표는 채널이 살아 있다고 믿고 ' +
      '다음 장애를 또 놓친다 — 이 경로 전체의 존재 이유가 사라지는 형태.',
  },
  {
    name: '풀 페이지 첫 페인트가 키워드 224KB 를 다시 받음',
    file: 'src/pages/admin/AdminInfluencerPoolPage.tsx',
    find: 'useEffect(() => { loadStats() }, [loadStats])',
    replace: 'useEffect(() => { loadMeta() }, [loadMeta])',
    test: 'src/tests/unit/ads-pool-page-lazy-keywords.test.ts',
    why:
      '첫 로딩 310KB 중 224KB(72%)가 키워드인데, 그걸 쓰는 패널은 접혀 있어 열기 전엔 본문도 안 그린다. ' +
      '되돌아가면 대부분의 방문이 그 224KB 를 받아 파싱만 하고 버린다 — 대표가 "느리다"고 한 그 자리다.',
  },
  {
    name: '정비 폴링이 10초마다 키워드까지 다시 받음',
    file: 'src/pages/admin/AdminInfluencerPoolPage.tsx',
    find: 'setInterval(() => { void loadStats() }, 10_000)',
    replace: 'setInterval(() => { void loadMeta() }, 10_000)',
    test: 'src/tests/unit/ads-pool-page-lazy-keywords.test.ts',
    why:
      '정비는 몇 분씩 걸린다. 그동안 10초마다 224KB 를 다시 받으면 첫 페인트를 고쳐 놓고 ' +
      '**보고 있는 내내** 같은 비용을 문다. 진행 표시에 필요한 건 통계뿐이다.',
  },
  {
    name: '축 몫이 풀 크기를 무시(작은 전략 축이 7배 빨리 돌아 큰 축이 굶음)',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '  const w = [avail[0] * mult.focus, avail[1] * mult.priority, avail[2] * mult.general]',
    replace: '  const w = [mult.focus, mult.priority, mult.general]',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '가중치에서 풀 크기를 빼면 옛 규칙(고정 비율)으로 되돌아간다. 라이브에서 그 규칙이 만든 결과는 ' +
      '집중 19개가 4슬롯 · 우선 315개가 9슬롯 = **키워드당 7배** 였고, 숙소 19개 중 12개가 한 번도 못 돌았다. ' +
      '에러가 없어 안 보이고, 키워드를 더 넣을수록 조용히 나빠진다.',
  },
  {
    // 🔁 **2026-08-12 표적 교체(낡은 지도 수리)**: 옛 주입은 바닥 루프
    //   `for (const i of order) { if (left > 0 && avail[i] > 0) { out[i] = 1; left-- } }` 를 지웠다.
    //   그 바닥 자체가 회차 간 이월(carry)로 대체돼 **코드에서 사라졌으므로** 그 표적은 더 이상 없다
    //   (그대로 두면 `guard-mutations` 가 "주입 대상을 못 찾음"으로 빨간불 — 실제로 그렇게 잡혔다).
    //   같은 불변식("작은 축이 굶지 않는다")의 새 형태는 위 '축 이월' 주입 2건이 지킨다. 이 자리는
    //   같은 함수의 **다른 미보호 불변식**(③ 가용분 초과 금지)으로 돌려 커버리지를 줄이지 않는다.
    name: '가용분 초과 가드가 사라짐(같은 키워드를 한 회차에 두 번 픽)',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '      if (out[i] >= avail[i]) continue                       // ③ 가용분 초과 금지',
    replace: '',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '몫이 가용 키워드 수를 넘으면 커서가 `pool[(cursor+i) % len]` 로 감싸며 **같은 키워드를 한 배치에 ' +
      '두 번** 내놓는다 — 희소한 회차(폭 9)를 중복에 쓰고, 그 키워드의 성과 카운터도 이중 계상된다. ' +
      '풀이 작아지는 순간(은퇴·고갈)에 터지는 형태라 평소 테스트로는 안 보인다.',
  },
  {
    // 📉 유입 추세 배지(2026-08-19 대표 "점점 줄어드는지도 봐줘").
    name: '진행 중인 오늘을 추세에 포함(오후마다 멀쩡한 날이 "폭락"으로 보인다)',
    file: 'src/shared/ads/inflow-trend.ts',
    find: ".filter(x => !!x?.d && (!todayKst || x.d !== todayKst))",
    replace: ".filter(x => !!x?.d)",
    test: 'src/tests/unit/ads-inflow-trend.test.ts',
    why:
      '오늘 막대는 지금까지 쌓인 만큼만 있다(실측: 13:47 시점 누적이 하루치의 57%). 그걸 평균에 넣으면 ' +
      '**하락이 아닌 날도 하락 판정**이 나고, 그 배지를 보고 멀쩡한 시스템을 파게 된다.',
  },
  {
    name: '인플루언서 페이지가 todayKst 를 안 넘김(배지·진행중 표시가 통째로 죽음)',
    file: 'src/pages/admin/AdminInfluencerPoolPage.tsx',
    find: '<InflowTimeline byDay={byDay} label="이메일" todayKst={todayKst} />',
    replace: '<InflowTimeline byDay={byDay} label="이메일" />',
    test: 'src/tests/unit/ads-inflow-trend.test.ts',
    why:
      '순수 함수가 맞아도 화면에 안 걸리면 아무 일도 안 일어난다 — 이 레포의 상습 사고("계산해 놓고 ' +
      '안 쓰는 계측"). prop 하나가 빠지면 오늘 막대가 완성된 날처럼 보여 절반짜리 값이 추세로 읽힌다.',
  },
  {
    // 📖 검색 깊이 커서(2026-08-19 대표 "왜 줄어드는지 원인을 파악하고 해결해줘 영구적으로").
    name: '검색 URL 에서 start 가 빠짐(다시 매번 같은 상위 100건만 본다)',
    file: 'src/features/marketing/api/influencer-discovery.ts',
    find: '&sort=${sort}&start=${depth.start}`',
    replace: '&sort=${sort}`',
    test: 'src/tests/unit/ads-search-depth.test.ts',
    why:
      '이 파라미터 하나가 없어서 발굴량이 말랐다 — 회차당 found 는 555~793 로 멀쩡한데 신규율만 ' +
      '8.4%~38.6% 였다(찾아온 사람의 62~92% 가 이미 DB 에 있음). 조용히 사라져도 아무 에러가 안 난다.',
  },
  {
    name: '다음 커서를 저장하지 않음(영원히 1페이지에 머문다)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: 'nb_start = COALESCE(?, nb_start), last_run_at',
    replace: 'last_run_at',
    test: 'src/tests/unit/ads-search-depth.test.ts',
    why:
      '읽기만 하고 저장을 안 하면 커서가 항상 1 이라 수정 전과 **동일하게** 동작한다. 그리고 그 상태는 ' +
      '에러도 경보도 안 낸다 — 이 레포의 "계산해 놓고 안 쓰는" 사고 클래스 그대로다.',
  },
  {
    // 🚀 커서 시딩(2026-08-19, 배포 +2.5h 실측 후) — 커서만 넣으면 효과가 몇 주 뒤에 온다.
    name: '커서 시딩이 사라짐(효과가 키워드마다 약 6일씩 밀린다)',
    file: 'src/features/marketing/api/influencer-keyword-ddl.ts',
    find: "  'UPDATE ad_discovery_keywords SET nb_start = 101 WHERE COALESCE(nb_start, 1) = 1 AND COALESCE(saved_total, 0) >= 100',",
    replace: '',
    test: 'src/tests/unit/ads-search-depth.test.ts',
    why:
      '커서는 "다음에 쓸 값"이라 첫 sim 회차는 **여전히 1페이지**를 읽고 101 을 저장만 한다. 한 키워드가 ' +
      '다시 뽑히는 주기가 ~3일이고 sim 은 그 절반이라 두 번째 sim 회차가 약 6일 뒤다 — 실측으로 확인했다' +
      '(배포 직후 sim 회차 신규율 8.9% = 기준선 동일, 그 회차엔 커서만 7개 올랐다).',
  },
  {
    name: '시딩 가드가 사라짐(신규 키워드의 1페이지를 건너뛰고, 재적용 때 깊은 커서를 되돌린다)',
    file: 'src/features/marketing/api/influencer-keyword-ddl.ts',
    find: 'WHERE COALESCE(nb_start, 1) = 1 AND COALESCE(saved_total, 0) >= 100',
    replace: 'WHERE 1=1',
    test: 'src/tests/unit/ads-search-depth.test.ts',
    why:
      '가드 둘이 각각 다른 사고를 막는다: `saved_total>=100` 이 없으면 **갓 만든 키워드의 미개척지인 ' +
      '1페이지**를 건너뛰고, `nb_start=1` 이 없으면 DDL 재적용 때 **901 까지 파 놓은 커서를 101 로 되돌린다**.',
  },
]
/**
 * 🔒 **주입이 도는 동안 커밋을 막는 자물쇠** (2026-08-03 — 실제로 한 번 당한 뒤 추가).
 *
 * 이 스크립트는 소스에 **의도적 결함을 심었다 지운다**. 복원은 튼튼하지만(try/finally + 시그널 + exit),
 * 그 사이에 **다른 곳에서 `git add -A` 를 하면 결함이 그대로 스테이징된다.**
 * 실제로 그렇게 `Promise.all(tracked)`(무한 대기 — 그 PR 이 고치려던 바로 그 고장)가 커밋됐고,
 * CI 가 잡을 때까지 아무도 몰랐다. `git status` 의 낯선 변경이 유일한 신호였는데 그건 사람이 놓친다.
 *
 * `.git/` 안에 두므로 커밋 대상이 될 수 없다. pre-commit 훅이 이 파일을 보고 거절한다.
 */
const LOCK = path.join(ROOT, '.git', 'guard-mutations.lock')
function lockOn() { try { fs.writeFileSync(LOCK, `${process.pid} ${new Date().toISOString()}\n`) } catch { /* 최선 노력 */ } }
function lockOff() { try { fs.rmSync(LOCK, { force: true }) } catch { /* 최선 노력 */ } }

/** 복원해야 할 원본들 — 어떤 경로로 끝나도 되돌린다. */
const pending = new Map()
function restoreAll() {
  for (const [abs, src] of pending) { try { fs.writeFileSync(abs, src) } catch { /* 최선 노력 */ } }
  pending.clear()
  lockOff()   // 복원과 같은 자리에서 푼다 — 둘이 갈리면 자물쇠만 남아 커밋이 영영 막힌다
}
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException']) {
  process.on(sig, (e) => { restoreAll(); if (e instanceof Error) console.error(e); process.exit(1) })
}
process.on('exit', restoreAll)
lockOn()   // 여기서부터 소스에 손을 댄다 — pre-commit 이 이 자물쇠를 보고 커밋을 거절한다

function runTest(testPath) {
  try {
    execFileSync('npx', ['vitest', 'run', testPath], { cwd: ROOT, stdio: 'pipe', timeout: 180_000 })
    return true   // 통과
  } catch { return false }  // 실패(= 우리가 원하는 것)
}

if (MUTATIONS.length === 0) {
  console.error('❌ guard-mutations: 등록된 주입이 0건 — 통과가 아니라 실패다.')
  process.exit(1)
}

/**
 * 💬 주석을 공백으로 덮은 사본을 만든다 — **길이와 인덱스는 원본과 같게.**
 *
 * 2026-08-02 실측: `"0 20 * * SUN"` 주입이 `wrangler.toml` 의 **주석**에 걸렸다. 무료 한도로
 * 그 cron 을 배열에서 뺐는데, 뺀 이유를 적은 주석 안에 같은 문자열이 남아 있었기 때문이다.
 * 결과는 조용한 오진이었다 — 주석을 고쳐 봐야 동작이 안 바뀌니 테스트는 통과했고, 이 도구는
 * 그걸 *"가드가 헛돈다"* 로 보고했다. **진실은 "지도가 낡았다"** 였고, 둘은 조치가 정반대다
 * (전자는 테스트 픽스처를 고치고, 후자는 주입 좌표를 옮긴다).
 *
 * CLAUDE.md 가 `check-lock-table-symbols` 에 대해 적어 둔 함정 *"주석에만 남아도 통과"* 와
 * 같은 클래스다. 이 도구 자체가 그 함정에 빠졌으니 여기서 막는다.
 *
 * ⚠️ **못 하는 것**: 문자열 리터럴 안의 `#`·`/*` 를 주석으로 오인할 수 있다. 그래도 안전한 쪽으로
 *    틀린다 — 과잉 마스킹의 결과는 "낡은 지도"라는 **시끄러운 실패**지 조용한 통과가 아니다.
 */
function maskComments(src, file) {
  const ext = path.extname(file)
  const js = ['.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(ext)
  const hash = ['.toml', '.yml', '.yaml', '.sh', '.conf'].includes(ext)
  if (!js && !hash) return src

  // ⚠️ **정규식으로는 이 클래스를 못 가른다**(2026-08-02 실측). 첫 구현은
  //   `/\/\*[\s\S]*?\*\//` 로 블록 주석을 지웠는데, 어느 `//` 주석이 본문에 `` `/*` `` 라는
  //   **글자**를 담고 있어서 거기서부터 9줄을 통째로 삼켰다 — 그 안의 살아 있는 코드가
  //   "주석"이 되어 정상 주입이 "낡은 지도"로 오진됐다. 문자열 안의 `#`·`/*` 도 같은 문제다.
  //   ⇒ 왼쪽부터 상태를 들고 훑는다. 여는 기호는 **그때 상태가 code 일 때만** 의미가 있다.
  const out = src.split('')
  let i = 0
  const n = src.length
  let state = 'code' // code | line | block | sq | dq | tpl
  const blank = (k) => { if (out[k] !== '\n') out[k] = ' ' }
  while (i < n) {
    const c = src[i], d = src[i + 1]
    if (state === 'code') {
      if (js && c === '/' && d === '/') { state = 'line'; blank(i); blank(i + 1); i += 2; continue }
      if (js && c === '/' && d === '*') { state = 'block'; blank(i); blank(i + 1); i += 2; continue }
      if (hash && c === '#') { state = 'line'; blank(i); i += 1; continue }
      if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (js && c === '`') state = 'tpl'
      i += 1; continue
    }
    if (state === 'line') { if (c === '\n') state = 'code'; else blank(i); i += 1; continue }
    if (state === 'block') {
      if (c === '*' && d === '/') { blank(i); blank(i + 1); state = 'code'; i += 2; continue }
      blank(i); i += 1; continue
    }
    // 문자열 — 내용은 그대로 두고(주입 대상이 문자열인 경우가 많다) 이스케이프만 건너뛴다.
    if (c === '\\') { i += 2; continue }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) state = 'code'
    else if (state !== 'tpl' && c === '\n') state = 'code' // 닫히지 않은 따옴표로 파일 전체가 문자열이 되는 것 방지
    i += 1
  }
  return out.join('')
}

const problems = []

// 🧹 잔재 확인 전용 모드 — 주입은 건드리지 않고 "지금 트리에 남아 있나"만 본다(위 VERIFY_CLEAN 주석).
if (VERIFY_CLEAN) {
  const dirty = []
  for (const m of MUTATIONS) {
    const abs = path.join(ROOT, m.file)
    if (!fs.existsSync(abs)) continue // 파일 이동은 전수 모드가 "낡은 지도"로 따로 보고한다
    const s = fs.readFileSync(abs, 'utf8')
    // `find` 가 사라졌는데 `replace` 가 있으면 주입된 상태다. `find` 만 사라졌으면 코드가 옮겨간 것.
    if (!s.includes(m.find) && m.replace && s.includes(m.replace)) dirty.push(`${m.file} — ${m.name}`)
  }
  if (dirty.length) {
    console.error(`\n❌ 주입 잔재 ${dirty.length}건 — **커밋하지 말 것**\n`)
    for (const d of dirty) console.error(`   • ${d}`)
    console.error(`\n   복원: git checkout -- <위 파일들>\n`)
    process.exit(1)
  }
  console.log(`✅ 주입 잔재 0 — 작업트리 깨끗함 (${MUTATIONS.length}건 확인)`)
  process.exit(0)
}

console.log(`🧬 guard-mutations: ${MUTATIONS.length}개 주입 검증 (각각 소스를 잠깐 고쳤다가 되돌린다)\n`)

for (const m of MUTATIONS) {
  if (ONLY && !m.name.includes(ONLY)) continue
  const abs = path.join(ROOT, m.file)
  if (!fs.existsSync(abs)) { problems.push(`${m.name}: 파일 없음 — ${m.file} (코드가 옮겨갔다)`); continue }
  const src = fs.readFileSync(abs, 'utf8')
  // 🔑 세는 것도 고치는 것도 **주석 밖에서만** 한다. 주석을 고쳐 봐야 동작은 안 바뀌므로,
  //   주석에 걸린 주입은 "가드가 헛돈다"가 아니라 "지도가 낡았다"로 보고해야 맞다.
  const masked = maskComments(src, m.file)
  // 판정은 **매치가 코드에서 시작하는가**로 한다. 문자열 전체를 마스킹된 사본에서 찾으면,
  // 뒤쪽 주석을 앵커로 포함한 주입(`… : S2_REGIONS // 아무…`)을 거짓으로 "주석뿐"이라 부른다
  // — 실제로 그렇게 두 건을 오탐했다. 시작 위치만 보면 둘 다 정확히 갈린다.
  const inComment = (i) => masked[i] === ' ' && src[i] !== ' '
  const hits = []
  for (let i = src.indexOf(m.find); i !== -1; i = src.indexOf(m.find, i + 1)) hits.push(i)
  const live = hits.filter((i) => !inComment(i))
  const rawCount = hits.length
  const count = live.length
  if (count === 0) {
    problems.push(
      rawCount > 0
        ? `${m.name}: 주입 대상이 **주석에만** 있다 — ${m.file} 의 \`${m.find.slice(0, 50)}…\` (낡은 지도: 코드에서 사라졌고 설명만 남았다)`
        : `${m.name}: 주입 대상을 못 찾음 — ${m.file} 의 \`${m.find.slice(0, 50)}…\` (낡은 지도)`,
    )
    continue
  }
  if (count > 1) { problems.push(`${m.name}: 주입 대상이 ${count}곳 — 유일해야 한다(엉뚱한 곳을 고칠 수 있다)`); continue }
  // 주석에도 같은 문자열이 있을 수 있으므로 **코드 쪽 인덱스로** 바꾼다
  // (`String.replace` 는 첫 등장을 바꾸는데, 그게 주석일 수 있다).
  const at = live[0]

  pending.set(abs, src)
  let stillGreen
  try {
    fs.writeFileSync(abs, src.slice(0, at) + m.replace + src.slice(at + m.find.length))
    stillGreen = runTest(m.test)
  } finally {
    fs.writeFileSync(abs, src)
    pending.delete(abs)
  }
  if (stillGreen) problems.push(`${m.name}: 결함을 심었는데 \`${m.test}\` 가 **통과** — 이 가드는 아무것도 안 지킨다.\n      (${m.why})`)
  console.log(`   ${stillGreen ? '❌' : '✅'} ${m.name}`)
}

// 🔒 마지막 안전 확인 — 어떤 경로로든 소스가 바뀐 채 남지 않았는지.
for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file)
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes(m.replace) && m.replace && !fs.readFileSync(abs, 'utf8').includes(m.find)) {
    problems.push(`⚠️ 복원 실패 의심: ${m.file} — \`git diff\` 로 확인할 것`)
  }
}

if (problems.length) {
  console.error(`\n❌ guard-mutations: ${problems.length}건\n`)
  for (const p of problems) console.error(`   • ${p}`)
  console.error(`
   이 검사가 실패한다는 것은 **가드가 지키는 척만 하고 있다**는 뜻이다.
   조치: 그 테스트의 픽스처가 정말 그 경우를 담고 있는지 보라(오늘 세 번 다 픽스처 문제였다).
`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`\n✅ guard-mutations: ${MUTATIONS.length}개 주입 전부 빨간불 확인 — 가드가 실제로 실패할 수 있다.`)
