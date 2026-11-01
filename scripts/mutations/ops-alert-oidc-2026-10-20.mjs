/**
 * 🧬 주입 — 봇 실패 → 대표 카톡 알림의 신원 확인 (2026-10-20)
 */
const T = 'src/tests/unit/ops-alert-oidc-2026-10-20.test.ts'
export default [
  {
    name: '운영알림 — 브랜치 검사를 지운다(아무 브랜치의 워크플로나 대표 카톡을 보낸다)',
    file: 'src/worker/utils/github-oidc.ts',
    find: "  if (c.ref !== (p.ref ?? 'refs/heads/main')) return false;",
    replace: '',
    test: T,
    why: '레포에 푸시 권한만 있으면 아무 브랜치에서 워크플로를 고쳐 대표에게 임의 카톡을 보낼 수 있다.',
  },
  {
    name: '운영알림 — 레포 검사를 지운다(남의 레포 워크플로가 알림을 보낸다)',
    file: 'src/worker/utils/github-oidc.ts',
    find: '  if (c.repository !== p.repository) return false;',
    replace: '',
    test: T,
    why: 'GitHub OIDC 토큰은 누구나 자기 레포에서 받을 수 있다. 레포를 안 보면 전 세계가 대표 카톡을 보낸다.',
  },
  {
    name: '운영알림 — 서명 검증 결과를 무시한다(위조 토큰 통과)',
    file: 'src/worker/utils/github-oidc.ts',
    find: '    if (!ok) return null;',
    replace: '    void ok;',
    test: T,
    why: '클레임만 맞추면 서명 없이 통과한다.',
  },
]
