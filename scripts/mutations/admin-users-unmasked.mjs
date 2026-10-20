/**
 * 🧬 주입 — 어드민 유저 목록 원문 노출 (2026-10-14 대표).
 */
const TEST = 'src/tests/unit/admin-users-unmasked-2026-10-14.test.ts'
const FILE = 'src/features/admin/api/admin-users.routes.ts'

export default [
  {
    name: '👁️ 유저 목록에 마스킹이 돌아온다',
    file: FILE,
    find: '      data: users,',
    replace: "      data: users.map(u => ({ ...u, email: maskEmail(u.email as string | null) })),",
    test: TEST,
    why: '대표가 원문을 보라고 했다. 마스킹이 돌아오면 CS 가 목록에서 연락처를 못 본다.',
  },
  {
    name: '👁️ 마스킹을 걷으면서 열람 감사 로그까지 지운다',
    file: FILE,
    find: "action: 'read_user_list'",
    replace: "action: 'read_users'",
    test: TEST,
    why: '원문 노출의 대가로 남긴 장치다. 이게 없으면 대량 열람을 알 방법이 없다.',
  },
  {
    name: '👁️ 깊은 페이지네이션 알림이 사라진다',
    file: FILE,
    find: 'if (offset >= 2000) {',
    replace: 'if (false) {',
    test: TEST,
    why: '스크래핑 신호다. 마스킹이 없는 지금 더 중요해졌다.',
  },
]
