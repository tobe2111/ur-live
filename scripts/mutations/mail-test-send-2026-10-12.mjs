/**
 * 🧬 주입 — 어드민 메일 발송 시험 (2026-10-12). 남용·거짓 실패 경로를 막는 자리들.
 */
const T = 'src/tests/unit/mail-test-send-2026-10-12.test.ts'
const F = 'src/features/admin/api/admin-system-monitoring.routes.ts'
export default [
  {
    name: '메일시험 — super_admin 확인이 빠진다',
    file: F,
    find: "    if (admin?.role !== 'super_admin') return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403)\n    const body = await c.req.json<{ user_id?: unknown }>()",
    replace: "    const body = await c.req.json<{ user_id?: unknown }>()",
    test: T,
    why: '일반 어드민이 아무 유저에게나 시험 메일을 보낼 수 있다.',
  },
  {
    name: '메일시험 — 수신 끔을 존중해 시험이 거짓 실패한다',
    file: F,
    find: '    }, { ignorePreference: true })',
    replace: '    })',
    test: T,
    why: '메일 수신을 꺼 둔 계정으로 시험하면 skipped 로 끝나 "메일이 안 된다"로 오판한다.',
  },
  {
    name: '메일시험 — 이메일 없는 유저도 보내려 한다',
    file: F,
    find: "    if (!user.email) return c.json({ success: false, error: '그 유저에 등록된 이메일이 없습니다' }, 400)\n",
    replace: '',
    test: T,
    why: '이메일 없는 유저에서 500(split of null)로 원인이 가려진다.',
  },
]
