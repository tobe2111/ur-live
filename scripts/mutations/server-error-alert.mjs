/**
 * 🔔 서버 5xx 자동 알림 (2026-09-21, 대표 "자동 알림 켜줘") — 주입 매니페스트.
 * 가드: src/tests/unit/server-error-alert-2026-09-21.test.ts
 *
 * 여기서 지키는 것은 **알림이 장애를 키우지 않는 것**이다. 알림 코드의 결함은 평소엔 보이지 않다가
 * 정작 장애가 난 순간에만 드러난다 — 깨뜨려 보지 않으면 알 수 없는 종류다.
 */
const T = 'src/tests/unit/server-error-alert-2026-09-21.test.ts'

export default [
  {
    name: '🌊 5xx 알림의 폭주 방지가 사라진다 (장애를 알리려다 D1 을 같이 죽인다)',
    file: 'src/worker/utils/server-error-alert.ts',
    find: '  if (!due(lastLogged, jobName, ERROR_ALERT_WINDOW_MS, now)) return',
    replace: '  void due(lastLogged, jobName, ERROR_ALERT_WINDOW_MS, now)',
    test: T,
    why: '5xx 는 나기 시작하면 초당 수십 건이다. 창이 없으면 그만큼 D1 쓰기가 나가 장애가 커진다.',
  },
  {
    name: '🔔 4xx 까지 장애로 적는다 (사용자 입력이 알림함을 덮는다)',
    file: 'src/worker/utils/safe-error.ts',
    find: '  if (status >= 500) {',
    replace: '  if (status >= 400) {',
    test: T,
    why: '400/401/404 는 정상 동작이다. 그걸 장애로 적으면 진짜 500 이 그 안에 묻힌다.',
  },
  {
    name: '🔔 알림 기록 실패가 요청으로 새어 나간다',
    file: 'src/worker/utils/server-error-alert.ts',
    find: '  } catch {\n    return // 표가 없거나 D1 이 아플 때 — 벨까지 시도하면 같은 이유로 또 실패한다\n  }',
    replace: '  } finally { void 0 }',
    test: T,
    why: '표가 없는 환경(또는 D1 장애)에서 알림이 던지면, 이미 5xx 인 요청을 알림이 한 번 더 깨뜨린다.',
  },
]
