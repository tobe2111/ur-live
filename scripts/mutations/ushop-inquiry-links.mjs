/**
 * 🧾 2026-09-28 (대표 확정 **B안**) 유어샵 하단 유입 링크 — 주입 매니페스트.
 *
 * 지키는 것 다섯: **손님에게만 · 목록 뒤 · B안(판·색 없음) · 실재하는 라우트 · 대표 원문 문구**.
 * 아래 결함을 심으면 `ushop-inquiry-links-2026-09-28.test.ts` 가 빨간불이어야 한다.
 */
const TEST = 'src/tests/unit/ushop-inquiry-links-2026-09-28.test.ts'
const SRC = 'src/pages/curator-page/ShopInquiryLinks.tsx'
const PAGE = 'src/pages/CuratorPage.tsx'

export default [
  {
    name: '유입링크 — 주인에게도 그린다 (2026-06-19 에 치운 바로 그 이유)',
    file: PAGE,
    find: '{!isOwner && <ShopInquiryLinks />}',
    replace: '<ShopInquiryLinks />',
    test: TEST,
    why:
      '대표가 `AskUserQuestion` 에서 "손님에게만 (주인은 숨김)" 을 골랐다. 주인에게 "사장님 입점 신청" 을 ' +
      '권하는 화면이 되고, 2026-06-19 에 하단 CTA 를 치운 이유 중 하나가 정확히 "주인에게도 떴다" 였다.',
  },
  {
    name: '유입링크 — 부품이 소유권을 스스로 캔다',
    file: SRC,
    find: "import { ChevronRight } from 'lucide-react'",
    replace: "import { ChevronRight } from 'lucide-react'\nconst isOwner = !!localStorage.getItem('seller_token')",
    test: TEST,
    why:
      '`check-linkshop-ownership` ③ — 순수 뷰 자식은 prop 구동이어야 한다. 부품이 토큰을 직접 읽기 ' +
      '시작하면 소유권 신호가 두 벌이 되고, 그게 2026-07-07 "내 가게인데 방문자로 보임" 의 원인이었다.',
  },
  {
    name: '유입링크 — 목록보다 위로 올라간다 (상품을 민다)',
    file: PAGE,
    find: '        {!isOwner && <ShopInquiryLinks />}',
    replace: '',
    test: TEST,
    why:
      '이 블록이 상품 위로 가면 2026-06-19 에 대표가 물린 바로 그 모양(손님이 상품보다 문의를 먼저 ' +
      '보는 화면)이 된다. 목록이 끝난 뒤라 바닥까지 내려간 사람만 본다는 것이 B안의 전제다.',
  },
  {
    name: '유입링크 — C안(파란 버튼)으로 되돌아간다',
    file: SRC,
    find: 'className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-gray-500 dark:text-gray-400 active:opacity-70"',
    replace: 'className="inline-flex items-center gap-0.5 self-start text-[12.5px] font-semibold bg-brand text-white active:opacity-70"',
    test: TEST,
    why:
      '대표가 B(조용한 링크)를 골랐다. 파란 버튼 셋이면 이 화면의 유일한 강조색이 **상품이 아니라 문의** 로 ' +
      '가서 🎫 표면 규칙 ②("강조색 하나, 자리 셋")를 어긴다 — 유어샵의 주인공은 진열대다.',
  },
  {
    name: '유입링크 — 죽은 라우트로 보낸다',
    file: SRC,
    find: "{ to: '/partnership', label: '제휴 및 협업 문의' }",
    replace: "{ to: '/contact', label: '제휴 및 협업 문의' }",
    test: TEST,
    why:
      '`/contact` 는 이 레포에 없다. 에러가 안 나고 404 화면만 떠서 아무도 신고하지 않는 클래스다 ' +
      '(sitemap 이 죽은 URL 을 제출하던 것과 같은 모양).',
  },
  {
    name: '유입링크 — SPA 이동을 통짜 새로고침으로 바꾼다',
    file: SRC,
    find: '        <Link\n          key={to}\n          to={to}',
    replace: '        <a\n          key={to}\n          href={to}',
    test: TEST,
    why: '`<a href>` 로 나가면 앱을 통째로 다시 받는다(도매 로그인 SPA 이동 가드와 같은 이유).',
  },
  {
    name: '유입링크 — 대표가 고른 문구를 규칙대로 "고쳐" 버린다',
    file: SRC,
    find: "{ to: '/influencer', label: '인플루언서 참여하기' }",
    replace: "{ to: '/influencer', label: '소개하고 수익 받기' }",
    test: TEST,
    why:
      '⚠️ 이 주입은 **규칙을 지키는 변경**이 빨간불이 되는, 이 매니페스트에서 유일하게 뒤집힌 항목이다. ' +
      'CLAUDE.md 는 사람 지칭 "인플루언서" 를 금지하지만, 그 충돌을 문구 표로 보고했고 **대표가 원문을 ' +
      '골랐다**(2026-09-28 `AskUserQuestion`). 다음 세션이 규칙만 보고 조용히 바꾸는 것을 막는다 — ' +
      '바꾸려면 규칙이 아니라 대표에게 물을 것.',
  },
]
