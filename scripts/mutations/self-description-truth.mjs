/**
 * 🪪 유어딜 자기소개의 사실성 — 주입 매니페스트 (2026-10-18 등록).
 * 가드: src/tests/unit/self-description-truth-2026-10-18.test.ts
 *
 * 이 결함은 **에러가 안 난다** — 문구가 틀려도 빌드·타입·화면이 멀쩡하다. 그래서 llms.txt 의
 * 첫 인용문이 "그룹 특가" 인 채로 AI 에게 배달됐다. 세 방향을 잠근다: 공동구매 문구의 귀환 ·
 * 주지 않는 보상의 귀환 · 제목/FAQ 가 다시 두 벌이 되는 것.
 */
export default [
  {
    name: 'AI 자기소개 첫 줄이 다시 그룹 특가라고 말한다',
    file: 'src/shared/seo/concept-content.ts',
    find: "  '유어딜(urdeal.kr)은 동네 가게의 할인 이용권을 앱에서 사고 매장에서 QR로 쓰는 로컬 딜 플랫폼입니다.',",
    replace: "  '유어딜(urdeal.kr)은 우리 동네 맛집·뷰티·숙소를 그룹 특가로 사는 로컬 커머스 플랫폼입니다.',",
    test: 'src/tests/unit/self-description-truth-2026-10-18.test.ts',
    why: '이 줄이 llms.txt 의 첫 인용문(`> …`)이다. 모여서 사는 구조가 없는데 AI 가 유어딜을 공동구매로 소개하게 된다.',
  },
  {
    name: '/introduce 검색 제목이 다시 공동구매',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "    title: '유어딜 소개 - 우리 동네 이용권 할인',",
    replace: "    title: '유어딜 소개 - 우리 동네 이용권 공동구매',",
    test: 'src/tests/unit/self-description-truth-2026-10-18.test.ts',
    why: '2026-10-15 `/pass` 310건 제목에서 같은 이유로 뺀 낱말이다.',
  },
  {
    name: '소개 화면에 친구 초대 보너스가 되살아난다',
    file: 'src/pages/IntroducePage.tsx',
    find: "title: '내 유어샵으로 소개', desc:",
    replace: "title: '친구 초대 보너스', desc:",
    test: 'src/tests/unit/self-description-truth-2026-10-18.test.ts',
    why: '2026-10-16 대표 *"0.5%는 안 주는 거야"*. 주지 않는 보상을 대외 랜딩이 약속하면 표시광고 문제다.',
  },
  {
    name: '인쇄판 소개서에 입점 수수료 0원이 되살아난다',
    file: 'src/pages/AboutPage.tsx',
    find: 'title="가입비·월 고정비 0원"',
    replace: 'title="입점 수수료 0원"',
    test: 'src/tests/unit/self-description-truth-2026-10-18.test.ts',
    why: '같은 페이지 표가 판매 수수료 10%/5% 를 말한다. 입점 제안 자리에 PDF 로 건네지는 문서다.',
  },
  {
    name: '/introduce SEO 가 다시 i18n 키로 표를 덮어쓴다',
    file: 'src/pages/IntroducePage.tsx',
    find: "<SEO title={CONSUMER_SURFACE_SEO['/introduce'].title}",
    replace: "<SEO title={t('introduce.seoTitle', { defaultValue: CONSUMER_SURFACE_SEO['/introduce'].title })}",
    test: 'src/tests/unit/self-description-truth-2026-10-18.test.ts',
    why: 'locale 값이 defaultValue 를 이겨, 서버 메타와 JS 가 그리는 제목이 서로 달랐다(두 벌).',
  },
  {
    name: '/introduce FAQ 가 없는 키를 고른다',
    file: 'src/pages/IntroducePage.tsx',
    find: "['faq.q10', 'faq.q13',",
    replace: "['faq.q99', 'faq.q13',",
    test: 'src/tests/unit/self-description-truth-2026-10-18.test.ts',
    why: '키가 사라지면 그 문답이 조용히 빠진다(filter 가 삼킨다) — 에러 없이 FAQ 가 줄어든다.',
  },
]
