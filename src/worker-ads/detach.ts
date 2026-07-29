/**
 * 🚀 **즉시 응답 디스패치** — 부모 cron 이 레인 하나하나를 기다리지 않게 (2026-07-29).
 *
 * ## 라이브가 보여준 것 (하트비트 사다리)
 * 한 시각에 찍힌 `ads:*` 하트비트를 오래된 순으로 세우면 **완벽한 계단**이 나온다:
 *
 *   11:00 (이번 시간)  enrich-company · enrich-influencer-driver
 *   10:00 (1시간 전)   match-registry · collect-store-kakao · collect-maker · reclassify-company
 *   09:00 (2시간 전)   enrich-prospects · collect-neis · collect-hira · collect-localdata(백필)
 *   08:00 (3시간 전)   collect-storeinfo
 *   05:00 (6시간 전)   collect-company · sweep-kakao-phone
 *
 * 우연이 아니다. 부모 `scheduled()` 는 매시간 ~15개 레인을 `kick()` 하는데, `kick` 은
 * `await env.SELF.fetch(path)` 다 — **레인이 일을 다 끝내고 응답할 때까지 부모가 살아 있어야 한다.**
 * 레인 하나가 20초씩이면 목록 뒷부분은 부모 수명 안에 **디스패치조차 되지 않는다.**
 * 그래서 뒤로 갈수록 "마지막 실행"이 오래된 계단이 생긴다 — `collect-company` 는 **6시간째** 안 돌았다.
 *
 * 결정적 근거: 11:00 에 돈 두 레인은 정확히 **즉시 응답으로 바뀐 레인**(#863)이다. 같은 처방을 나머지에.
 *
 * ## 계약
 * - **cron 만 detach 한다**(`?detach=1`). 어드민 수동 버튼은 그대로 동기 실행 — 눌렀는데 결과가 안 뜨면
 *   그건 UX 후퇴다. 즉 "누가 불렀나"를 URL 이 말하게 하고, 코드가 추측하지 않는다.
 * - `executionCtx` 가 없으면(로컬/테스트) **동기 실행** — 동작 동일.
 * - 작업 실패는 각 러너가 자기 `stats.diag.error` 로 남긴다(이미 그렇게 돼 있다). 여기서 삼켜도
 *   관측이 사라지지 않는 이유다. ⚠️ 그래도 삼킨 예외를 **완전히 버리진 않는다** — 콘솔로 흘린다.
 */

/** 이 요청을 백그라운드로 돌려야 하나 — cron 이 `?detach=1` 로 명시했을 때만. */
export function wantsDetach(c: { req: { query: (k: string) => string | undefined } }): boolean {
  return c.req.query('detach') === '1'
}

/**
 * 작업을 실행하되, cron 이 요청했으면 **응답을 먼저 돌려주고** 자기 인보케이션의 `waitUntil` 에서 계속한다.
 *
 * @returns 동기 실행이면 작업 결과, detach 면 `undefined`(호출부가 `{detached:true}` 로 응답)
 */
export async function runDetachable<T>(
  c: { req: { query: (k: string) => string | undefined }; executionCtx?: { waitUntil: (p: Promise<unknown>) => void } },
  work: () => Promise<T>,
): Promise<{ detached: true } | { detached: false; result: T }> {
  if (wantsDetach(c) && c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(work().catch((err) => {
      // 관측은 각 러너의 stats.diag 가 담당한다. 여기선 삼킨 사실만 남긴다(조용한 소멸 방지).
      try { console.error('[ads:detached] lane threw', (err as Error)?.name, String((err as Error)?.message || '').slice(0, 200)) } catch { /* noop */ }
    }))
    return { detached: true }
  }
  return { detached: false, result: await work() }
}
