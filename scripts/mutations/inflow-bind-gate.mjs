/**
 * 🧬 주입 — **유입 귀속을 묶을 것이 없는데도 보내던 자리** (2026-10-07)
 *
 * 전부 **에러 없이 조용히** 되돌아간다. 요청이 하나(+CSRF 토큰까지 둘) 더 나갈 뿐이라
 * 라이브를 재 본 사람만 안다. 라이브 실측이 그 증거다(유입 기록 0인 계정의 `/map`):
 *   `+3834ms GET /api/csrf-token` → `+3908ms POST /api/acquisition/inflow/bind`
 */
const SRC = 'src/utils/affiliate-track.ts'
const APP = 'src/App.tsx'
const T = 'src/tests/unit/inflow-bind-gate-2026-10-07.test.ts'

export default [
  {
    name: '유입귀속 — 묶을 것이 없어도 보낸다 (종전 동작)',
    file: SRC,
    find: "    const sent = localStorage.getItem(INFLOW_SENT_KEY)\n    if (!sent) return",
    replace: "    const sent = localStorage.getItem(INFLOW_SENT_KEY) ?? ''",
    test: T,
    why:
      '정확히 종전 코드다. `?ref=` 로 들어온 적이 없는 사람에겐 묶을 행이 **애초에 없는데**, ' +
      '하드로드마다 POST 가 나가고 그걸 위해 CSRF 토큰까지 한 번 더 받는다.',
  },
  {
    name: '유입귀속 — 묶음 표시를 영구 플래그로 만든다',
    file: SRC,
    find: "    if (localStorage.getItem(INFLOW_BOUND_KEY) === sent) return",
    replace: "    if (localStorage.getItem(INFLOW_BOUND_KEY)) return",
    test: T,
    why:
      '한 번 묶으면 끝이라고 보면, 나중에 **다른 사람 링크**로 들어온 유입이 영영 안 묶인다 ' +
      '(그 행은 `user_id` NULL 로 남아 어드민 매칭 집계에서 사라진다). 그런데 흔한 경로에서는 ' +
      '증상이 전혀 안 보여서 이 실수는 조용히 산다.',
  },
  {
    name: '유입귀속 — 보내기 전에 묶었다고 적는다',
    file: SRC,
    find: "      .then(() => { try { localStorage.setItem(INFLOW_BOUND_KEY, sent) } catch { /* quota */ } })",
    replace: "      .finally(() => { try { localStorage.setItem(INFLOW_BOUND_KEY, sent) } catch { /* quota */ } })",
    test: T,
    why:
      '낙관적으로 적으면 **실패한 전송도 성공으로 기록**된다 — 오프라인에서 한 번 실패한 유입은 ' +
      '다시는 시도되지 않는다. fail-soft 의 재시도 성질이 조용히 사라진다.',
  },
  {
    name: '유입귀속 — 묶음 표시를 아예 안 적는다',
    file: SRC,
    find: "      .then(() => { try { localStorage.setItem(INFLOW_BOUND_KEY, sent) } catch { /* quota */ } })\n",
    replace: '',
    test: T,
    why:
      '게이트가 **영원히 안 닫힌다** — `?ref=` 로 한 번 들어온 사람은 그 뒤 모든 하드로드마다 ' +
      '다시 POST 한다(서버는 멱등이라 0행을 쓰고, 아무 에러도 안 난다).',
  },
  {
    name: '유입귀속 — 호출부를 끊는다',
    file: APP,
    find: '          bindInflowClicksIfLoggedIn(loggedIn)',
    replace: '          void bindInflowClicksIfLoggedIn',
    test: T,
    why:
      '함수는 멀쩡한데 아무도 안 부르면 유입이 **한 번도** 유저에 귀속되지 않는다. ' +
      '그래도 화면·빌드는 초록이다 — 이 레포가 반복해 당한 조용한 부재.',
  },
]
