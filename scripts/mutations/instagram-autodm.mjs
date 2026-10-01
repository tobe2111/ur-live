/**
 * 💬 인스타 댓글 → 자동 DM (2026-10-01 · 같은 날 다중 계정) — 주입 매니페스트.
 * 가드: src/tests/unit/instagram-autodm-2026-10-01.test.ts
 */
const TEST = 'src/tests/unit/instagram-autodm-2026-10-01.test.ts'
const SVC = 'src/features/instagram-autodm/api/autodm-service.ts'
const STORE = 'src/features/instagram-autodm/api/autodm-store.ts'

export default [
  {
    name: '💬 자동 DM 이 그 계정이 단 댓글에도 반응한다(무한 루프)',
    file: SVC,
    find: 'if (ev.fromId === account.ig_user_id) { summary.skipped++; continue }',
    replace: 'if (false) { summary.skipped++; continue }',
    test: TEST,
    why: '공개 답글을 달면 그 답글이 다시 댓글 웹훅으로 돌아온다 — 거르지 않으면 내 답글에 내가 DM·답글을 계속 단다.',
  },
  {
    name: '💬 댓글 선점 없이 보낸다(웹훅 재전송에 DM 중복)',
    file: SVC,
    find: 'if (!claimed) { summary.skipped++; continue }',
    replace: '// claim 무시',
    test: TEST,
    why: '메타는 웹훅을 재전송한다. UNIQUE 선점이 없으면 같은 사람에게 같은 DM 이 두 번 간다.',
  },
  {
    name: '💬 계정 켜기(enabled)를 무시하고 보낸다',
    file: SVC,
    find: 'if (!account || !account.enabled || !account.access_token)',
    replace: 'if (!account || !account.access_token)',
    test: TEST,
    why: '발송은 대표 결재(C) 대상이다 — 기본 OFF 가 깨지면 연결만 해도 DM 이 나간다.',
  },
  {
    name: '💬 매장 계정 전체 스위치(sellers_enabled)를 무시한다',
    file: SVC,
    find: 'if (!sellersEnabled) { summary.skipped += evs.length; continue }',
    replace: 'if (false) { summary.skipped += evs.length; continue }',
    test: TEST,
    why: '메타 앱 심사 전에 매장들이 각자 켜면 그대로 나간다 — 대표가 열기 전까지 매장 발송은 0통이어야 한다.',
  },
  {
    name: '💬 앱 시크릿이 없어도 웹훅 서명이 통과한다',
    file: 'src/features/instagram-autodm/api/autodm-core.ts',
    find: 'if (!appSecret || !header) return false',
    replace: 'if (!header) return false',
    test: TEST,
    why: '시크릿 없이 통과시키면 누구나 가짜 웹훅으로 우리 계정에서 DM 을 보내게 할 수 있다.',
  },
  {
    name: '💬 다른 매장의 규칙 id 로 규칙을 고칠 수 있다(IDOR)',
    file: STORE,
    find: 'link_url = ?, public_reply = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?`)\n    .bind(r.name, r.keywords, r.match_mode, r.media_id, r.dm_text, r.link_url, r.public_reply, r.is_active ? 1 : 0, id, accountId)',
    replace: 'link_url = ?, public_reply = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)\n    .bind(r.name, r.keywords, r.match_mode, r.media_id, r.dm_text, r.link_url, r.public_reply, r.is_active ? 1 : 0, id)',
    test: TEST,
    why: '규칙 id 는 숫자라 추측된다 — 계정 조건이 빠지면 남의 가게 DM 문구를 바꿔 내 링크를 보내게 할 수 있다.',
  },
  {
    name: '💬 같은 인스타 계정을 다른 가게가 가로챈다',
    file: STORE,
    find: "if (holder && holder.owner_key !== input.owner_key) return { ok: false, error: 'taken' }",
    replace: '',
    test: TEST,
    why: '웹훅은 인스타 계정 ID 로 주인을 찾는다 — 두 곳에 붙으면 한 가게의 댓글이 다른 가게 규칙으로 처리된다.',
  },
  {
    name: '💬 인스타 로그인 state 서명이 안 맞아도 통과한다',
    file: 'src/features/instagram-autodm/api/autodm-oauth.ts',
    find: '  if (diff !== 0) return null\n  try {\n    const st = JSON.parse',
    replace: '  try {\n    const st = JSON.parse',
    test: TEST,
    why: 'state 에 어느 가게의 연결인지가 실려 있다 — 위조가 통하면 남의 가게에 내 인스타를 붙일 수 있다.',
  },
  {
    name: '💬 메타 signed_request 서명이 안 맞아도 통과한다(남의 계정 데이터 삭제)',
    file: 'src/features/instagram-autodm/api/autodm-oauth.ts',
    find: '  if (diff !== 0) return null\n  try {\n    const p = JSON.parse',
    replace: '  try {\n    const p = JSON.parse',
    test: TEST,
    why: '데이터 삭제 콜백은 공개 주소다 — 서명 없이 믿으면 누구나 user_id 만 넣어 남의 가게 규칙·기록을 지운다.',
  },
]
