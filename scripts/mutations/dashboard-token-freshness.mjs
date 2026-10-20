/**
 * 🔑 대시보드 토큰 신선도 (2026-09-23) 되돌려-검증 주입.
 * 가드: src/tests/unit/dashboard-token-freshness-2026-09-23.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/dashboard-token-freshness-2026-09-23.test.ts'

export default [
  {
    name: '🔑토큰신선도 만료 토큰을 그대로 붙여 보낸다 (401 일곱 개 복원)',
    file: 'src/lib/api.ts',
    // 앵커는 **대표의 401 일곱 개가 실제로 지나간 분기**(`/^\\/api\\/admin[-/]/`). 호출이 세 곳이라
    //   조건문까지 포함해야 유일하다.
    find: "    if (/^\\/api\\/admin[-/]/.test(url)) {\n      const token = await ensureFreshDashboardToken('admin');",
    replace: "    if (/^\\/api\\/admin[-/]/.test(url)) {\n      const token = localStorage.getItem('admin_token');",
    test: TEST,
    why: '대표 콘솔 실측의 본체 — 어드민 재방문 첫 화면이 [요청 7 → 401 7 → 갱신 → 재시도 7] 을 탄다. 화면은 결국 떠서 아무도 결함으로 신고하지 않는다.',
  },
  {
    name: '🔑토큰신선도 살아 있는 토큰까지 매번 갈아 끼운다 (refresh 폭주)',
    file: 'src/lib/dashboard-token.ts',
    find: '  if (expMs === null) return false\n  return expMs - now <= skewMs',
    replace: '  if (expMs === null) return false\n  return true',
    test: TEST,
    why: '요청마다 refresh 를 부르면 회전 토큰이 쉬지 않고 돌아 다른 탭이 stale 로 401 → 강제 로그아웃.',
  },
  {
    name: '🔑토큰신선도 디코드 불가 토큰도 갱신하려 든다 (레거시 세션 파괴)',
    file: 'src/lib/dashboard-token.ts',
    find: '  if (expMs === null) return false\n  return expMs - now <= skewMs',
    replace: '  if (expMs === null) return true\n  return expMs - now <= skewMs',
    test: TEST,
    why: '판단 불가를 "갱신하자" 로 읽으면 비-JWT 세션을 임의로 건드린다. 모르는 것은 401 흐름에 맡겨야 한다.',
  },
  {
    name: '🔑토큰신선도 refresh 요청 자신에도 사전 갱신을 건다 (자기를 기다림)',
    file: 'src/lib/api.ts',
    find: '    if (isDashboardRefreshUrl(url)) return config;',
    replace: '    void isDashboardRefreshUrl;',
    test: TEST,
    why: '갱신 호출이 인터셉터를 다시 타면 자기 자신을 기다리는 모양이 된다.',
  },
  {
    name: '🔑토큰신선도 훅이 자기 락으로 갱신한다 (회전 토큰 경합 복원)',
    file: 'src/hooks/useTokenAutoRefresh.ts',
    find: '  await ensureFreshDashboardToken(role, REFRESH_BEFORE_EXPIRY_MS)',
    replace: "  await axios.post(`/api/${role}/refresh`, { refreshToken: localStorage.getItem(`${role}_refresh_token`) }).catch(() => null)",
    test: TEST,
    why: '훅과 인터셉터가 같은 순간에 각자 갱신하면 진 쪽이 stale refresh 토큰으로 401 → 전 탭 로그아웃.',
  },
  {
    name: '🔑토큰신선도 갱신 실패를 삼키지 않는다 (401 흐름 우회)',
    file: 'src/lib/dashboard-refresh.ts',
    find: '  if (!refreshed) return token       // 실패 → 기존 401 흐름',
    replace: '  if (!refreshed) return null',
    test: TEST,
    why: '여기서 토큰을 지우면 401 응답 인터셉터의 탭 경합 가드(2026-07-04)를 통째로 우회한다.',
  },
  {
    name: '🔑토큰신선도 2026-07-04 무한재귀 가드 해제 (만료 토큰 루프)',
    file: 'src/hooks/useTokenAutoRefresh.ts',
    find: '          if (shouldRescheduleAfterAttempt(localStorage.getItem(`${role}_token`), Date.now())) schedule()',
    replace: '          schedule()',
    test: TEST,
    why: '실사고 재발 — 만료 토큰으로 마이크로태스크 무한재귀 → 메인스레드 100% 영구 정지.',
  },
  {
    name: '🔁승인재동기화 서버가 코드 없이 문구만 준다 (화면이 문구를 매칭하게 됨)',
    file: 'src/features/admin/api/admin-sellers.routes.ts',
    find: "code: 'ALREADY_APPROVED', error: '이미 승인된 판매자입니다'",
    replace: "error: '이미 승인된 판매자입니다'",
    test: TEST,
    why: '문구는 언제든 다듬어진다 — 그 순간 분기가 조용히 사라진다(에러도 테스트 실패도 없다).',
  },
  {
    name: '🔁승인재동기화 실패하면 목록을 안 불러온다 (낡은 줄이 남아 또 누름)',
    file: 'src/pages/AdminSellerApprovalPage.tsx',
    find: "      else toast.error('승인 실패')\n    } finally { setActingId(null); load() }",
    replace: "      else toast.error('승인 실패')\n    } finally { setActingId(null) }",
    test: TEST,
    why: '대표 콘솔의 400 이 정확히 이것 — 이미 승인된 매장이 화면에 남아 있어 다시 눌렀다.',
  },
  {
    name: '🔑토큰신선도 알림 분기가 저장된 토큰을 그대로 붙인다 (대시보드 상시 호출)',
    file: 'src/lib/api.ts',
    find: "      const role = pickDashboardRole(['agency', 'admin', 'seller']);\n      if (role) {\n        const token = await ensureFreshDashboardToken(role);\n        if (token) { config.headers['Authorization'] = `Bearer ${token}`; return config; }\n      }\n      // fallthrough to Firebase",
    replace: "      const adminToken = localStorage.getItem('admin_token');\n      if (adminToken) { config.headers['Authorization'] = `Bearer ${adminToken}`; return config; }\n      // fallthrough to Firebase",
    test: TEST,
    why: '알림 벨은 모든 대시보드 화면에서 돈다 — 여기가 새면 401 왕복이 화면마다 되살아난다.',
  },
  {
    name: '🔑토큰신선도 역할 선택이 만료까지 걸러낸다 (갱신 가능한 세션을 비로그인 취급)',
    file: 'src/lib/api.ts',
    find: '      if (localStorage.getItem(dashboardTokenKeys(role).token)) return role;',
    replace: '      const t = localStorage.getItem(dashboardTokenKeys(role).token);\n      if (t && (JSON.parse(atob(t.split(".")[1])).exp * 1000) > Date.now()) return role;',
    test: TEST,
    why: '"만료됐으니 없는 것" 으로 읽으면 갱신하면 되는 세션이 소비자 쿠키 경로로 떨어져 403/401 이 된다.',
  },
]
