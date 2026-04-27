/**
 * Fire-and-forget Promise 의 에러를 console 에 로그만 남기고 throw 하지 않는다.
 *
 * 사용:
 *   somePromise().catch(swallow('label'))
 *
 * Cloudflare Workers 의 stdout 은 wrangler tail / Logpush 로 수집되므로
 * 운영 중 silent failure 가 발생했을 때 로그에서 추적 가능.
 *
 * 결제/환불/포인트 같은 금융 연관 작업에서는 가능하면 await + try/catch 로 명시적 처리하고,
 * 부가 작업(알림 발송, 통계 누적, DDL bootstrap 등)에서만 사용한다.
 */
export const swallow = (label: string) => (err: unknown) => {
  console.error(`[swallow:${label}]`, err);
};
