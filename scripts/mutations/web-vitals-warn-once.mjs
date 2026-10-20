/**
 * 🧬 주입 — **성능 경고 중복** (2026-10-07)
 *
 * 되돌리면 전부 **조용히** 종전으로 간다. 기능은 그대로 돌고 Sentry 로 같은 경고가 N건 갈 뿐이라
 * 화면에서는 아무것도 안 보인다. 실제로 그렇게 살아 있었다 — 라이브 `/map` 한 번 열었을 때
 * `Slow LCP on app: 3524ms` 와 `4140ms` 가 둘 다 갔다(같은 한 번의 로드다).
 */
const SRC = 'src/lib/performance-monitor.ts'
const T = 'src/tests/unit/web-vitals-warn-once-2026-10-07.test.ts'

export default [
  {
    name: '성능경고 — LCP 를 entry 마다 쏜다 (종전 동작)',
    file: SRC,
    find: "          warnOnce('lcp', `Slow LCP on ${pageName}: ${lcp.renderTime}ms`)",
    replace: "          Sentry.captureMessage(`Slow LCP on ${pageName}: ${lcp.renderTime}ms`, 'warning')",
    test: T,
    why:
      '정확히 종전 코드다. LCP 는 더 큰 요소가 그려질 때마다 다시 발화하므로 느린 화면 한 번에 ' +
      '경고가 여러 건 가고, 그 안에 **최종값보다 작은 중간값**이 섞인다.',
  },
  {
    name: '성능경고 — CLS 를 시프트마다 쏜다 (넷 중 가장 심했던 자리)',
    file: SRC,
    find: "        warnOnce('cls', `High CLS on ${pageName}: ${clsValue}`)",
    replace: "        Sentry.captureMessage(`High CLS on ${pageName}: ${clsValue}`, 'warning')",
    test: T,
    why:
      '`clsValue` 는 누적이고 옵저버는 **레이아웃 시프트마다** 발화한다 ⇒ 0.1 을 한 번 넘기면 ' +
      '그 뒤 시프트 하나하나가 경고 1건이다. 시프트가 많은 화면일수록 더 많이 보낸다.',
  },
  {
    name: '성능경고 — INP 를 상호작용마다 쏜다',
    file: SRC,
    find: "          warnOnce('inp', `Slow INP on ${pageName}: ${Math.round(inpMax)}ms`)",
    replace: "          Sentry.captureMessage(`Slow INP on ${pageName}: ${Math.round(inpMax)}ms`, 'warning')",
    test: T,
    why:
      '`inpMax` 는 줄지 않으므로 한 번 200ms 를 넘기면 **이후 모든 배치**가 경고를 보낸다. ' +
      '스크롤·탭이 많은 지도 화면에서 특히 많이 쌓인다.',
  },
  {
    name: '성능경고 — flush 를 여러 번 할 수 있게 만든다',
    file: SRC,
    find: '      if (flushed) return\n      flushed = true',
    replace: '      flushed = true',
    test: T,
    why:
      '`pagehide` 와 `visibilitychange` 가 둘 다 오는 환경(그리고 10초 폴백까지)에서는 flush 가 ' +
      '두세 번 불린다. 가드가 없으면 같은 경고가 그만큼 복제된다 — 고치려던 것이 그대로 돌아온다.',
  },
  {
    name: '성능경고 — 10초 폴백을 없앤다',
    file: SRC,
    find: '    window.setTimeout(flush, 10000)',
    replace: '    // (폴백 없음)',
    test: T,
    why:
      '카카오 인앱·사파리는 `visibilitychange→hidden` 이 **안 온다**(형제 파일이 2026-09-02 에 ' +
      '실측으로 적어 둔 것 — 4일간 LCP 표본 0). 폴백이 없으면 그 환경에서 경고가 **영영 안 간다** ' +
      '— 중복을 고치려다 보고 자체를 잃는다.',
  },
  {
    name: '성능경고 — flush 뒤 옵저버를 안 끊는다',
    file: SRC,
    find: '      for (const o of observers) { try { o.disconnect() } catch { /* 이미 끊김 */ } }',
    replace: '      // (끊지 않음)',
    test: T,
    why:
      '보고를 끝낸 뒤에도 옵저버가 앱 수명 내내 콜백을 돌린다. 당장 경고가 더 가지는 않지만 ' +
      '(flush 가드가 막는다) 쓸 일 없는 측정이 계속 돌고, 다음 세션이 "여기에 한 건 더" 를 얹기 쉽다.',
  },
]
