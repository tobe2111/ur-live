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
    find: `  '/influencer': ['/', '/partners'],`,
    replace: `  '/influencer': ['/', '/partners', '/creators'],`,
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
]
