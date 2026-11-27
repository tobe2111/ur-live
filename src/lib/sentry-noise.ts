/**
 * 🔇 2026-09-03 (대표 신고 — 콘솔 `429` + "무슨 에러야") — **Sentry 로 올릴 가치가 없는 이벤트 판정.**
 *
 * ■ 왜 만들었나 (실측)
 *   대표 콘솔에 둘이 같이 떴다:
 *     `…ingest.us.sentry.io/…/envelope/  429`            ← Sentry 가 우리 이벤트를 거절(쿼터/레이트리밋)
 *     `TypeError: Cannot read properties of undefined (reading 'startTime') at et.reportAllChanges`
 *   두 번째는 **`@sentry/react` 가 자기 번들 안에서 던지는 것**이다(브라우저 성능 항목이 비었을 때
 *   web-vitals 리포터가 마지막 entry 를 읽는다). 그런데 uncaught 라 **Sentry 자신이 그걸 다시 이벤트로
 *   올린다** — 쿼터를 스스로 태우는 고리다. 사용자 화면·결제엔 영향이 없다(idle 콜백 안이라 렌더 밖).
 *
 * ■ 왜 함수로 뺐나
 *   `beforeSend` 안에 인라인으로 두면 **테스트가 실제로 돌려 볼 수가 없다**(Sentry.init 이 필요).
 *   순수 함수면 이벤트 모양만 만들어 진짜로 판정을 돌릴 수 있다 — 이 레포가 반복해 당한
 *   "가드가 있는데 헛도는" 클래스를 피한다.
 *
 * ■ ⚠️ 좁게 판정한다
 *   메시지만으로 `startTime` 을 거르면 **우리 코드의 진짜 버그**까지 조용히 사라진다.
 *   그래서 [메시지 + 스택이 Sentry 자신의 web-vitals 리포터] **둘 다** 맞을 때만 버린다.
 */

/** 내장 브라우저(CefSharp) 껍데기가 내는 거절 문장. 숫자·메서드 이름은 매번 다르다(`Id:3, MethodName:update, ParamCount:4`). */
export const EMBEDDED_BROWSER_REJECTION = /Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/

type SentryLikeFrame = { function?: string; filename?: string; module?: string }
export type SentryLikeEvent = {
  message?: string
  environment?: string
  exception?: { values?: Array<{ type?: string; value?: string; stacktrace?: { frames?: SentryLikeFrame[] } }> }
}

/** 예외 이벤트의 사람이 읽는 텍스트. `event.message` 는 예외에선 보통 비어 있다(그래서 옛 필터가 헛돌았다). */
export function eventText(event: SentryLikeEvent): string {
  const first = event.exception?.values?.[0]
  return [event.message, first?.type, first?.value].filter(Boolean).join(': ')
}

/** Sentry 가 번들한 web-vitals 리포터가 던진 것인가 — 스택으로만 판정한다(메시지는 우리 코드도 낼 수 있다). */
function isSentryOwnVitalsFrame(event: SentryLikeEvent, rawStack: string): boolean {
  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
  const inFrames = frames.some((f) => /reportAllChanges|onHidden|whenIdle/.test(String(f.function ?? '')))
  return inFrames || /reportAllChanges/.test(rawStack)
}

/**
 * 버릴 이벤트면 true. `hint.originalException` 의 raw 스택도 함께 본다 —
 * 압축 번들에선 `frames` 가 비고 스택 문자열만 남는 경우가 있다(대표가 캡처한 형태가 그랬다).
 */
export function isNoiseEvent(event: SentryLikeEvent, originalException?: unknown): boolean {
  if (event.environment === 'development') return true

  const text = eventText(event)
  const rawStack = String((originalException as { stack?: string } | undefined)?.stack ?? '')

  // 🔇 Sentry 자신의 web-vitals 리포터가 던진 TypeError — 올리면 쿼터를 스스로 태운다.
  if (/reading '?startTime'?|undefined \(reading 'startTime'\)/.test(text) && isSentryOwnVitalsFrame(event, rawStack)) return true

  // 🔇 2026-11-27 (대표 신고 — Sentry `UnhandledRejection /ads`): 메일 보안 장치·링크 미리보기가 내장 브라우저(CefSharp)로
  //    페이지를 열 때 그 **껍데기가** 던지는 문장이다. Error 가 아니라 문자열이라 스택이 없고, 우리 코드엔 이 문장이 없다.
  //    ⚠️ 세 조각이 **다 맞을 때만** 버린다 — "Not Found" 만 보고 거르면 우리 404 처리의 진짜 버그가 같이 사라진다.
  if (EMBEDDED_BROWSER_REJECTION.test(text)) return true

  // ⬇️ 아래 둘은 2026-04-30 부터 있던 의도인데 `event.message` 만 봐서 **예외에는 한 번도 안 걸렸다**.
  //    이제 예외 텍스트까지 본다(원 의도대로 동작).
  if (/localStorage/.test(text)) return true
  if (/NetworkError/.test(text)) return true

  return false
}
