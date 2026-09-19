/**
 * 🎟️ 이용권 상세 주소 이전 `/group-buy/:id` → `/pass/:id` — 주입 매니페스트 (2026-09-16 등록).
 * 가드: src/tests/unit/pass-route-migration.test.ts
 *
 * 주소 이전이 이 레포에서 위험한 이유는 **접두사를 공유하는 형제 라우트** 때문이다.
 * `/group-buy/` 밑에는 상세(`:id`)만 있는 게 아니라 **Toss 결제 복귀 화면**(`confirm-payment`)이
 * 같이 산다. 일괄 치환은 그 둘을 구분하지 못하고, 문자열이라 타입도 빌드도 통과한다.
 */
export default [
  {
    name: '이용권 상세 301 이 결제 확인 화면까지 삼킨다(결제 복귀가 없는 주소로 튕긴다)',
    file: 'src/shared/seo/consumer-redirects.ts',
    find: 'const GROUP_BUY_DETAIL = /^\\/group-buy\\/(\\d+)\\/?$/',
    replace: 'const GROUP_BUY_DETAIL = /^\\/group-buy\\/([^/]+)\\/?$/',
    test: 'src/tests/unit/pass-route-migration.test.ts',
    why:
      '**숫자 id 만** 잡아야 한다. `[^/]+` 로 넓히면 같은 접두사를 쓰는 ' +
      '**`/group-buy/confirm-payment`(Toss 결제 복귀 화면)** 까지 301 되어 `/pass/confirm-payment`' +
      '(없는 라우트)로 튕긴다 — **돈이 빠져나간 직후**에 터지므로 사용자는 결제가 됐는지조차 모른다. ' +
      '🐛 원안(2026-08-16)이 같은 실수를 **실제로 저질렀다**: 치환 패턴에 `confirm-payment` 예외를 ' +
      '빼먹어 `FLOW_CONFIG.group_buy_toss.successPath` 가 존재하지 않는 경로가 됐고 빌드는 통과했다.',
  },
  {
    name: '옛 주소 폴백 라우트를 지운다(앱 안에서 옛 링크를 누르면 갈 곳이 없다)',
    file: 'src/App.tsx',
    find: '<Route path="/group-buy/:id" element={<PathRedirect base="/pass" />} />',
    replace: '{/* removed */}',
    test: 'src/tests/unit/pass-route-migration.test.ts',
    why:
      '서버 301 은 **하드로드에만** 걸린다. SPA 내부 이동은 서버를 안 타므로 이 라우트가 없으면 ' +
      '카톡으로 받은 옛 주소를 앱 안에서 다시 누를 때 **404 화면**이 뜬다 — 밖에서 오는 트래픽만 ' +
      '테스트하면 안 보이는 구멍이다.',
  },
  {
    name: '`pass` 를 예약어에서 뺀다(몰 슬러그가 이용권 상세를 통째로 가린다)',
    file: 'src/shared/mall/slug.ts',
    find: "'partners', 'partnership', 'pass', 'pay', 'payment', 'points', 'privacy',",
    replace: "'partners', 'partnership', 'pay', 'payment', 'points', 'privacy',",
    test: 'src/tests/unit/pass-route-migration.test.ts',
    why:
      '예약 안 하면 누가 그 슬러그로 몰을 만드는 순간 `urdeal.kr/pass` 가 그 가게를 가리키고 ' +
      '**이용권 상세가 통째로 사라진다.** 우리 배포와 무관하게, 운영자 신청 한 건으로 일어난다.',
  },
  {
    name: '서버 첫 화면 분기에서 정본을 뺀다(`/pass/:id` 하드로드가 조용히 로더로 돌아간다)',
    file: 'src/worker/index.ts',
    find: "(url.pathname.startsWith('/pass/') || url.pathname.startsWith('/group-buy/'))",
    replace: "url.pathname.startsWith('/group-buy/')",
    test: 'src/tests/unit/pass-route-migration.test.ts',
    why:
      '09-15·09-16 에 워커가 상세의 `#root` 에 [빵부스러기 + 히어로]를 직접 그리게 됐는데 그 분기는 ' +
      'pathname **문자열**로 가른다(`/vouchers/:id` 가 같은 DETAIL 슬롯이라 regex 로 못 가른다). ' +
      '정본을 빼면 에러도 빈 화면도 없이 **종전 로더로 돌아갈 뿐**이라 아무도 신고하지 않는다 — ' +
      '이 레포가 반복해 당한 "실패가 아니라 조용한 부재".',
  },
  {
    name: 'sitemap 이 옛 주소를 제출한다(색인 신호가 301 한 홉에 낭비된다)',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: 'loc: `/pass/${g.id}`,',
    replace: 'loc: `/group-buy/${g.id}`,',
    test: 'src/tests/unit/pass-route-migration.test.ts',
    why:
      'sitemap 은 "이 URL 을 색인해 달라" 는 선언이다. 301 되는 주소를 제출하면 크롤 예산이 한 홉씩 ' +
      '낭비되고, 이 레포는 그 클래스로 이미 네 번 넘어졌다(`check-sitemap-routes` 가 그 수습).',
  },
  {
    name: '예약어 목록은 그대로 두고 **해석기만** pass 를 무시하게 한다(목록 검사가 헛돈다)',
    file: 'src/shared/mall/resolve.ts',
    find: 'const RESERVED_SLUG_SET = new Set(RESERVED_SLUGS)',
    replace: "const RESERVED_SLUG_SET = new Set(RESERVED_SLUGS.filter(x => x !== 'pass'))",
    test: 'src/tests/unit/pass-route-migration.test.ts',
    why:
      '목록에 이름이 **있는데도** 런타임 판정이 그 목록을 안 보는 경우 — `RESERVED_SLUGS` 를 세는 ' +
      '단언은 초록인 채로 `urdeal.kr/pass` 가 남의 가게가 된다. 2026-09-16 에 실제로 주입해 보고 ' +
      '목록 검사만으로는 안 잡힌다는 것을 확인한 뒤 런타임 호출 검사를 추가했다(R1).',
  },
]
