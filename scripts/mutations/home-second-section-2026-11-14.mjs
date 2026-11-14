/** 🧬 주입 — 홈 서버 첫 화면 둘째 섹션. 가드: src/tests/unit/home-second-section-ssr-2026-11-14.test.ts */
const T = 'src/tests/unit/home-second-section-ssr-2026-11-14.test.ts'
export default [
  { name: '홈둘째섹션 — 다시 안 그린다', file: 'src/worker/utils/home-first-screen.ts', find: '${stripBannerHtml(strip)}${homeSecondSectionHtml(sec2, bannersPayload)}', replace: '${stripBannerHtml(strip)}', test: T, why: '2026-11-14 대표 "밑 이용권들 불러오는게 늦어" — 카드가 앱 뒤 1.8~2.1s.' },
  { name: '홈둘째섹션 — inline 배너가 있어도 그린다(마운트 때 밀림)', file: 'src/worker/utils/home-first-screen.ts', find: '  if (inline > 0) return \'\'\n', replace: '', test: T, why: '화면은 띠 배너와 이 섹션 사이에 inline 을 그린다.' },
  { name: '홈둘째섹션 — 배너 시드 없이도 그린다', file: 'src/worker/utils/home-first-screen.ts', find: "if (!sec || sec.near || !sec.title || !bannersPayload) return ''", replace: "if (!sec || sec.near || !sec.title) return ''", test: T, why: 'inline 판정을 못 하면 그리지 않는다.' },
  { name: '홈둘째섹션 — 사진을 eager 로', file: 'src/worker/utils/home-first-screen.ts', find: 'products.map(p => cardHtml(p, false, undefined, true))', replace: 'products.map(p => cardHtml(p, true, undefined, true))', test: T, why: '화면 밖 사진이 첫 화면 사진과 회선을 나눈다.' },
]
