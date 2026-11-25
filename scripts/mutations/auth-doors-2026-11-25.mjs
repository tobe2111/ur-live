/** 🚪 2026-11-25 로그인·탈퇴 문 — 가드: src/tests/unit/auth-doors-2026-11-25.test.ts */
const T = 'src/tests/unit/auth-doors-2026-11-25.test.ts'

export default [
  {
    name: '[auth-doors] state 없는 카카오 콜백이 다시 로그인시킨다',
    file: 'src/features/auth/api/kakao.routes.ts',
    find: "      fireDiag('error', 'oauth_state_missing');\n      return c.redirect(`/?error=oauth_state_expired`);",
    replace: "      redirectTarget = safeRedirect(receivedState);",
    test: T,
    why: '남의 인가 코드를 붙인 주소 하나로 피해자를 공격자 계정에 로그인시킨다.',
  },
  {
    name: '[auth-doors] 같은 이메일 가입이 다시 "서버 오류" 로 보인다(서비스)',
    file: 'src/features/auth/services/KakaoAuthService.ts',
    find: "      if ((error as { code?: string })?.code === 'EMAIL_ALREADY_LINKED_TO_OTHER_METHOD') throw error;\n      console.error('[KakaoAuthService] DB error:', error);",
    replace: "      console.error('[KakaoAuthService] DB error:', error);",
    test: T,
    why: '다시 해도 같은 결과인데 "잠시 후 다시 시도" 라고 안내한다.',
  },
  {
    name: '[auth-doors] 같은 이메일 가입 안내 문구가 사라진다',
    file: 'src/App.tsx',
    find: "      email_already_linked: '",
    replace: "      email_already_linked_x: '",
    test: T,
    why: '손님에게 "로그인 중 오류가 발생했어요 (email_already_linked)" 로 보인다.',
  },
  {
    name: '[auth-doors] 탈퇴한 유저의 남은 로그인이 다시 쓰기를 한다',
    file: 'src/worker/middleware/auth.ts',
    find: "(async () => (await rejectDeletedUserWrite(c)) ?? next()) as Next",
    replace: "next",
    test: T,
    why: '탈퇴한(곧 지워질) 계정으로 이용권을 사거나 가게를 만든다.',
  },
  {
    name: '[auth-doors] 탈퇴 판정이 라이브에 없는 칸을 본다',
    file: 'src/worker/utils/deleted-user-guard.ts',
    find: "  if (row && isDeletedUserRow(row)) {",
    replace: "  if (row && (row as { deleted_at?: string }).deleted_at) {",
    test: T,
    why: '`users.deleted_at` 은 라이브에 없다 — 탈퇴한 유저를 영영 못 알아본다.',
  },
  {
    name: '[auth-doors] 탈퇴해도 남의 가게 자리가 남는다',
    file: 'src/worker/services/delete-account.service.ts',
    find: "    await db.prepare(\"UPDATE seller_operators SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL\").bind(userId).run().catch(() => null)\n",
    replace: '',
    test: T,
    why: '탈퇴한 사람이 남의 가게 대시보드에 계속 들어간다.',
  },
  {
    name: '[auth-doors] 카카오로 만든 에이전시 주인이 그대로 탈퇴된다',
    file: 'src/worker/utils/account-delete-blockers.ts',
    find: " || b.owned_agencies > 0",
    replace: '',
    test: T,
    why: '에이전시와 그 정산이 주인 없이 남는다(그 카카오 계정으로 다시 못 들어온다).',
  },
]
