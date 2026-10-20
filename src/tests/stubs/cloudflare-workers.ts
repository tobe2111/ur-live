/**
 * 🧪 **`cloudflare:workers` 스텁 (vitest 전용)** — 런타임 내장 모듈이라 번들러가 해석하지 못한다.
 *
 * ⚠️ **왜 필요한가**: 이 모듈을 import 하는 파일은 **그 파일뿐 아니라 그것을 import 하는 모든 파일까지**
 *   vitest 에서 통째로 로드 실패한다(`Failed to resolve import`). 그래서 이 레포의 DO 3개가 전부 무테스트였고,
 *   2026-08-02 에 `worker-ads/index.ts` 가 DO 를 re-export 하자 **엔트리 상수 하나를 읽던 기존 테스트
 *   (`ads-lane-cadence`)까지 같이 죽었다.** 실패가 DO 와 무관한 곳에서 터져 원인이 안 보인다.
 *
 * ⚠️ **이 스텁이 하는 일은 "해석되게 하는 것"뿐이다.** DO 의 실제 동작(스토리지·알람 예약)은 흉내내지
 *   않는다 — 그건 런타임 계약이라 유닛으로 확인할 수 없다. 그래서 알람 레인의 안전장치는 순수함수로
 *   갈라 두었다(`worker-ads/lane-alarm-policy.ts`). 이걸 붙였다고 DO 본체가 검증됐다고 여기지 말 것.
 *
 * 배선: `vitest.config.ts` 의 `resolve.alias['cloudflare:workers']`.
 */

/** 런타임 `DurableObject` 의 형태만 맞춘 껍데기 — 상속·필드 접근이 되게 하는 최소치. */
export class DurableObject<E = unknown> {
  constructor(public ctx: DurableObjectState, public env: E) {}
}

/** 런타임 top-level `env` — 스텁에선 항상 비어 있다(값에 의존하는 코드는 폴백을 가져야 한다). */
export const env: Record<string, unknown> = {}

export class WorkerEntrypoint<E = unknown> {
  constructor(public ctx: ExecutionContext, public env: E) {}
}
