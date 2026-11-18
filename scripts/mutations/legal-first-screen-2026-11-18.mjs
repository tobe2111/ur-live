/** 🧬 주입 — 환불·약관 서버 첫 화면 (2026-11-18) */
const T = 'src/tests/unit/legal-first-screen-2026-11-18.test.tsx'
const B = 'src/worker/utils/legal-first-screen.ts'
export default [
  { name: '정책첫화면 — 워커 분기가 빠진다', file: 'src/worker/index.ts', find: "else if (legalPathOf(url.pathname)) { const legalFirst", replace: "else if (false && legalPathOf(url.pathname)) { const legalFirst", test: T, why: '서버가 그림을 안 그려 첫 그림이 다시 앱 부팅 뒤(1.5~4.0s)로 간다.' },
  { name: '정책첫화면 — 워커가 PC 에 네비를 안 그린다', file: 'src/worker/index.ts', find: "buildLegalFirstScreen(legalPathOf(url.pathname)!, urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')) ? undefined : url.pathname)", replace: 'buildLegalFirstScreen(legalPathOf(url.pathname)!, urdealLoaderHtml)', test: T, why: 'PC 에서 상단 네비가 마운트 때 끼어들어 본문이 밀린다.' },
  { name: '정책첫화면 — 첫 화면 CSS 자격에서 빠진다', file: 'src/worker/utils/css-first-boot.ts', find: '    || legalPathOf(pathname) !== null // ⚖️', replace: '    || false // ⚖️', test: T, why: '서버가 그린 첫 화면이 앱 CSS 를 기다려 안 보인다.' },
  { name: '정책첫화면 — 표면 CSS 이름이 갈린다', file: 'src/worker/utils/css-first-boot.ts', find: "if (legalPathOf(p) !== null) return 'legal'", replace: "if (legalPathOf(p) !== null) return 'legalX'", test: T, why: '생성기 표면과 이름이 달라 전체판(69KB)이 인라인된다.' },
  { name: '정책첫화면 — 서버가 환불 문구 하나를 손으로 바꾼다', file: B, find: 'const txt = (s: string) => emailOff(esc(s))', replace: "const txt = (s: string) => emailOff(esc(s.replace('전액', '전부')))", test: T, why: '정책 문구가 서버와 화면에서 갈린다(심사 화면이 마운트 때 바뀐다).' },
  { name: '정책첫화면 — 약관 첫 조항 칸에 클래스를 붙인다', file: B, find: "`<section class=\"${i > 0 ? C.sectionRest : ''}\">`", replace: '`<section class="${C.sectionRest}">`', test: T, why: '첫 조항 위에 구분선·여백이 생겼다가 마운트 때 사라진다(밀림).' },
  { name: '정책첫화면 — 환불 화면이 클래스를 손으로 적는다', file: 'src/pages/RefundPolicyPage.tsx', find: '<div className={REFUND_CLS.content}>', replace: '<div className="ur-content-medium px-5 pt-6">', test: T, why: '상수가 바뀌어도 화면이 안 따라와 서버와 갈린다.' },
  { name: '정책첫화면 — 약관 청크 preload 가 빠진다', file: 'scripts/generate-route-chunk-map.mjs', find: "  terms: ['src/pages/TermsOfServicePage.tsx'],", replace: '', test: T, why: '하드로드 때 약관 청크가 앱 부팅 뒤에야 출발한다.' },
]
