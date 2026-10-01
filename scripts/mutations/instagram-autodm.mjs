/**
 * 💬 인스타 댓글 → 자동 DM (2026-10-01) — 주입 매니페스트.
 * 가드: src/tests/unit/instagram-autodm-2026-10-01.test.ts
 */
const TEST = 'src/tests/unit/instagram-autodm-2026-10-01.test.ts'
const SVC = 'src/features/instagram-autodm/api/autodm-service.ts'

export default [
  {
    name: '💬 자동 DM 이 우리 계정의 댓글에도 반응한다(무한 루프)',
    file: SVC,
    find: ' || ev.fromId === account.ig_user_id',
    replace: '',
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
    name: '💬 자동 DM 게이트(어드민 켜기)를 무시하고 보낸다',
    file: SVC,
    find: 'if (!account?.enabled) return',
    replace: 'if (false) return',
    test: TEST,
    why: '발송은 대표 결재(C) 대상이다 — 기본 OFF 가 깨지면 연결만 해도 DM 이 나간다.',
  },
  {
    name: '💬 앱 시크릿이 없어도 웹훅 서명이 통과한다',
    file: 'src/features/instagram-autodm/api/autodm-core.ts',
    find: 'if (!appSecret || !header) return false',
    replace: 'if (!header) return false',
    test: TEST,
    why: '시크릿 없이 통과시키면 누구나 가짜 웹훅으로 우리 계정에서 DM 을 보내게 할 수 있다.',
  },
]
