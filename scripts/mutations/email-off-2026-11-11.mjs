/** 🧬 주입 — 서버 HTML 이메일 가리기 제외. 가드: src/tests/unit/email-off-2026-11-11.test.ts */
const T = 'src/tests/unit/email-off-2026-11-11.test.ts'
export default [
  { name: '이메일제외 — /faq 이메일 칸을 감싸지 않는다(다시 [email protected])', file: 'src/worker/utils/faq-first-screen.ts', find: '${emailOff(esc(value))}', replace: '${esc(value)}', test: T, why: '2026-11-11 대표 신고 — 앱 켜지기 전·크롤러에 이메일이 가려 보인다.' },
  { name: '이메일제외 — 표기가 틀린다(Cloudflare 가 못 알아본다)', file: 'src/worker/utils/email-off.ts', find: "export const EMAIL_OFF_OPEN = '<!--email_off-->'", replace: "export const EMAIL_OFF_OPEN = '<!-- email_off -->'", test: T, why: 'Cloudflare 는 정해진 표기만 존중한다.' },
  { name: '이메일제외 — CloudFront 경유 표시를 뺀다(시험 주소 측정이 평소 손님과 섞인다)', file: 'src/worker/utils/css-first-boot.ts', find: "  return /cloudfront/i.test(via || '') ? `A${c}` : c", replace: '  return c', test: T, why: '2주 비교의 근거가 사라진다.' },
  { name: '이메일제외 — 워커가 Via 를 안 넘긴다', file: 'src/worker/index.ts', find: "cf?.colo, c.req.header('via'));", replace: 'cf?.colo);', test: T, why: '표시 함수가 있어도 입력이 없으면 늘 평소 손님으로 잡힌다.' },
]
