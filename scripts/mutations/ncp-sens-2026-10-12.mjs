// 📨 2026-10-12 알림톡 네이버 클라우드 SENS 전환 — 대표 "이걸로 가자"
const T = 'src/tests/unit/ncp-sens-alimtalk-2026-10-12.test.ts'
export default [
  {
    name: 'SENS — 서명 원문 줄바꿈 누락',
    file: 'src/lib/ncp-sens.ts',
    find: 'return `${method} ${uri}\\n${timestamp}\\n${accessKey}`',
    replace: 'return `${method} ${uri}${timestamp}\\n${accessKey}`',
    test: T,
    why: '서명이 틀리면 SENS 가 401 — 알림톡이 한 통도 안 나간다.',
  },
  {
    name: 'SENS — 키가 있어도 보내지 않는다',
    file: 'src/lib/text-notice.ts',
    find: "  if (!sensConfigured(e)) return { ok: false, skipped: 'no_credentials' }",
    replace: "  if (true) return { ok: false, skipped: 'no_credentials' }",
    test: T,
    why: '키를 다 넣어도 알림톡이 한 통도 안 나간다 — 에러 없이.',
  },
  {
    name: 'SENS — 승인 전 템플릿도 보낸다',
    file: 'src/lib/text-notice.ts',
    find: '  if (!n.forceAlimtalk && !approved.has(n.tpl)) {',
    replace: '  if (!n.forceAlimtalk && false) {',
    test: T,
    why: '검수 전 템플릿을 보내면 전부 거절되고 비용·실패 기록만 쌓인다.',
  },
  {
    name: 'SENS — 접수 거절을 성공으로 본다',
    file: 'src/lib/ncp-sens.ts',
    find: "  if (status === 202 && m?.requestStatusCode === 'A000') return { success: true }",
    replace: "  if (status === 202) return { success: true }",
    test: T,
    why: '템플릿 불일치로 거절돼도 성공으로 기록돼 안 나간 걸 아무도 모른다.',
  },
]
