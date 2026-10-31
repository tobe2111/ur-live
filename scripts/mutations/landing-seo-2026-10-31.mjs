/**
 * 🧬 대외 랜딩 SEO·GEO(`/partners` · `/influencer`) — 되돌려-검증 주입 (2026-10-31).
 *
 * 규칙은 `src/tests/unit/landing-seo-2026-10-31.test.ts` 머리말. 여기서는 그 시험이
 * **실제로 실패할 수 있는가**를 본다.
 */
const T = 'src/tests/unit/landing-seo-2026-10-31.test.ts'

export default [
  {
    name: '🧭 [랜딩SEO] /partners FAQ 가 다시 화면 안에만 있다 (워커가 FAQ 를 안 고른다)',
    file: 'src/worker/utils/landing-seo.ts',
    find: `  if (path === '/partners') return PARTNER_FAQ`,
    replace: `  if (path === '/partners') return []`,
    test: T,
    why: '라이브 실측에서 질문 여덟 개가 화면 컴포넌트 안에만 있어 크롤러 본문·FAQPage 가 0건이었다.',
  },
  {
    name: '🧭 [랜딩SEO] /partners 입점 Service 노드가 빠진다',
    file: 'src/worker/utils/landing-seo.ts',
    find: `  if (path === '/partners') {\n    nodes.push({`,
    replace: `  if (path === '/none') {\n    nodes.push({`,
    test: T,
    why: '사장님용 서비스라는 구조화 신호(BusinessAudience)가 소비자 쇼핑 페이지와 갈리게 한다.',
  },
  {
    name: '🧭 [랜딩SEO] FAQPage 가 화면과 다른 배열을 읽는다 (내용-스키마 불일치)',
    file: 'src/worker/utils/landing-seo.ts',
    find: `    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question,`,
    replace: `    mainEntity: faq.slice(1).map((f) => ({ '@type': 'Question', name: f.question,`,
    test: T,
    why: '화면에 있는 Q&A 와 구조화 데이터가 다르면 구글은 정책 위반으로 본다.',
  },
  {
    name: '🧭 [랜딩SEO] PartnerFaq 가 접힌 답을 DOM 에서 지운다',
    file: 'src/pages/partners/PartnerFaq.tsx',
    find: `      <p className="pb-5 pr-8 text-[13px] lg:text-[17px] leading-[1.8] text-gray-600 dark:text-gray-300 max-w-[44em]">{a}</p>\n    </details>`,
    replace: `      {open && (<p className="pb-5 pr-8 text-[13px] lg:text-[17px] leading-[1.8] text-gray-600 dark:text-gray-300 max-w-[44em]">{a}</p>)}\n    </details>`,
    test: T,
    why: '종전 모양이다 — 렌더하는 크롤러도 접힌 답을 못 읽었다.',
  },
  {
    name: '🧭 [랜딩SEO] 크롤러에게만 화면에 없는 링크를 준다',
    file: 'src/worker/utils/landing-seo.ts',
    find: `  '/influencer': ['/', '/partners', '/creators'],`,
    replace: `  '/influencer': ['/', '/partners', '/creators', '/experience'],`,
    test: T,
    why: '화면에 없는 링크를 크롤러에게만 주는 것은 클로킹 쪽으로 기운다.',
  },
  {
    name: '🧭 [랜딩SEO] 소개 FAQ 가 사람을 신분으로 부른다',
    file: 'src/shared/landing-faq.ts',
    find: `    question: '팔로워가 적어도 할 수 있나요?',`,
    replace: `    question: '인플루언서가 아니어도 할 수 있나요?',`,
    test: T,
    why: '2026-08-26 대표 확정 — 사람을 신분이 아니라 행위(담기·소개)로 말한다.',
  },
  {
    name: '🧭 [랜딩SEO] 목록 아닌 표면에 시드 상품 줄이 샌다 (재조준한 단언이 여전히 잡는가)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: `  '/stays': (p) => p?.category === 'stay_voucher',\n}`,
    replace: `  '/stays': (p) => p?.category === 'stay_voucher',\n  '/gb-market': () => true,\n}`,
    test: 'src/tests/unit/list-surface-noscript-2026-10-12.test.ts',
    why: '2026-10-31 에 그 단언을 `<li>` 전체 → 시드 상품 이름으로 재조준했다(랜딩 헤더 링크가 `<li>` 라서). 느슨해지지 않았는지 본다.',
  },
  {
    name: '🧭 [랜딩SEO] 정직 고지가 다시 옛 실측일(liveMeasuredAt)을 쓴다',
    file: 'src/pages/partners/PartnerFaq.tsx',
    find: `유어딜은 초기 서비스입니다. {F.catalogMeasuredAt} 기준`,
    replace: `유어딜은 초기 서비스입니다. {F.liveMeasuredAt} 기준`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why: '2026-10-31 판매 중 이용권만 다시 셌다(165건). 옛 날짜를 붙이면 새 숫자에 다른 기준일이 붙는다.',
  },
  {
    name: '🧭 [랜딩SEO] 덱의 판매 중 이용권 수가 랜딩과 갈린다',
    file: 'docs/business/proposals/deck-common.mjs',
    find: `  activeVouchers: '165', realStores: '2',`,
    replace: `  activeVouchers: '359', realStores: '2',`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why: '사장님은 PDF 를 받고 사이트를 열어 본다. 숫자가 다르면 둘 다 신뢰를 잃는다.',
  },
  {
    name: '🧭 [랜딩SEO] 없는 업종 견적 주소가 다시 200 + index 로 나간다',
    file: 'src/shared/seo/known-routes.ts',
    find: `segs[1] === 'request') return categoryDef(segs[2]) != null`,
    replace: `segs[1] === 'request') return true`,
    test: 'src/tests/unit/life-request-404-2026-10-31.test.ts',
    why: '서치콘솔이 /life/request/<없는 키> 를 soft-404 로 잡았다 — 무한 thin URL 이다.',
  },
  {
    name: '🧭 [랜딩SEO] 없는 업종 판정이 실재 업종까지 404 로 만든다 (반대 방향)',
    file: 'src/shared/seo/known-routes.ts',
    find: `segs[1] === 'request') return categoryDef(segs[2]) != null`,
    replace: `segs[1] === 'request') return false`,
    test: 'src/tests/unit/life-request-404-2026-10-31.test.ts',
    why: '멀쩡한 업종 페이지가 404 가 되면 색인 복구가 수주다.',
  },
  {
    name: '🧭 [랜딩SEO] IndexNow 가 한 엔진이라도 거절하면 실패로 본다 (커서가 영원히 묶인다)',
    file: 'src/worker/cron/indexnow-submit.ts',
    find: `return { ok: results.some((r) => r.ok),`,
    replace: `return { ok: results.every((r) => r.ok),`,
    test: 'src/tests/unit/seo-mallproduct-crawler-img-indexnow-2026-10-14.test.ts',
    why: '규격상 참여 엔진끼리 공유되므로 한 곳만 받아도 전파된다. every 면 빙 429 하나로 네이버 제출까지 멎는다.',
  },
  {
    name: '🧭 [랜딩SEO] 봇 셸에서 파비콘 태그가 빠진다 (네이버 아이콘이 지구본)',
    file: 'src/worker/index.ts',
    find: `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" /><link rel="icon" type="image/png" sizes="96x96"`,
    replace: `<link rel="iconx" href="/favicon.ico" sizes="16x16 32x32 48x48" /><link rel="icon" type="image/png" sizes="96x96"`,
    test: 'src/tests/unit/bot-shell-favicon-2026-10-31.test.ts',
    why: '네이버는 로봇이 받은 문서의 아이콘 태그로 사이트 아이콘을 고른다. 봇 셸에 0개라 회색 지구본이었다.',
  },
]
