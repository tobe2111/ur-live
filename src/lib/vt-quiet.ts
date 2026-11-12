/**
 * 🔇 2026-11-12 (대표 Sentry 메일 — JAVASCRIPT-REACT-37 `InvalidStateError: Transition was aborted because of
 *   invalid state. Snapshot capture failed`, /stays/2970 · /stays/2983, Android Chrome).
 *
 * 브라우저가 화면 전환(View Transition)을 **건너뛰면**(사진을 못 찍음 · 탭이 가려짐 · 다른 전환과 겹침)
 * `ready` 약속이 거절된다. 우리는 `finished` 만 받고 있어서 `ready` 의 거절이 **아무도 안 받는 거절**
 * (unhandledrejection)이 되어 오류로 보고됐다. 이동 자체는 이미 끝났다 — 손님 화면엔 아무 일도 없다.
 *
 * ⇒ 전환을 시작한 곳은 전부 이 함수를 거친다: 세 약속(`ready`·`updateCallbackDone`·`finished`)에 빈 처리를 붙인다.
 *    ⚠️ 이동 콜백 안에서 난 **진짜 오류**를 삼키지 않으려면 이동 콜백 자체는 각 호출부가 지금처럼 try 로 감싼다
 *    (`updateCallbackDone` 의 거절은 콜백이 던진 것이고, 호출부의 폴백이 이미 처리한다).
 */
export type VtLike = { ready?: Promise<unknown>; updateCallbackDone?: Promise<unknown>; finished?: Promise<unknown> }

export function quietVt<T extends VtLike>(vt: T): T {
  const swallow = () => {}
  vt.ready?.catch(swallow)
  vt.updateCallbackDone?.catch(swallow)
  vt.finished?.catch(swallow)
  return vt
}
