/**
 * 🔢 **D1 바인딩 한도 SSOT** — `IN (?,?,…)` 을 쪼갤 때 쓰는 유일한 자리.
 *
 * ## 왜 필요한가 (2026-10-26 라이브 실측)
 *
 * D1 은 **한 문장에 바인딩 100개**까지만 받는다. 101개를 보내면
 * `too many SQL variables … SQLITE_ERROR` 로 **문장 전체가 실패**한다. 실측:
 *
 * ```
 * 바인딩  99개 → OK      바인딩 100개 → OK      바인딩 101개 → ERR 7500 too many SQL variables
 * ```
 *
 * 🩸 **그런데 이 한도는 로컬 시험으로는 보이지 않는다.** 이 레포의 시험은 진짜 SQLite
 * (`node:sqlite`)로 도는데 거기 한도는 **32,766** 이다 — 즉 101개든 500개든 멀쩡히 통과한다.
 * 그래서 "진짜 DB 로 동작 판정" 을 해 놓고도 D1 에서만 깨지는 코드가 초록불을 받는다.
 * 그 자리를 실제로 밟았다: 내보낸 리드 도장(`stampExported`)이 청크당 **id 100개 + 도장 1 = 101개**
 * 를 보내 **라이브에서 한 건도 안 찍혔다**(두 번 받으면 같은 500행이 다시 나왔다). 게다가
 * 호출부가 `.catch(() => null)` 로 삼켜 **에러도 로그도 없었다** — 재 본 사람만 아는 종류다.
 *
 * ## 규칙
 *
 * 가변 길이 배열을 `IN (…)` 에 넣을 때는 **반드시 이 모듈로 쪼갠다.** 손으로 `i += 100` 을
 * 쓰면 같은 문장에 바인딩이 하나라도 더 붙는 날(도장 값·기간 두 개 …) 조용히 넘친다.
 * `extraBinds` 는 **그 문장의 나머지 바인딩 수**다 — 빠뜨리면 이 보호가 그대로 무효다.
 *
 * ⚠️ **이 모듈이 못 하는 것**: 호출부가 `extraBinds` 를 틀리게 세는 것 · 이 모듈을 안 거치는
 *    새 코드(그건 `d1-bind-limit-2026-10-26.test.ts` 의 배선 검사가 본다) · SQL 길이 한도.
 */

/** 한 문장이 받는 바인딩 최대 개수 — 라이브 D1 실측(100 OK / 101 ERR). 올리지 말 것. */
export const D1_MAX_BINDS = 100

/**
 * `IN (?,…)` 에 안전하게 들어갈 묶음으로 쪼갠다.
 *
 * @param extraBinds 같은 문장의 다른 바인딩 수(예: `SET exported_at = ?` 는 1, 기간 두 개는 2).
 * @returns 각 묶음의 길이가 `D1_MAX_BINDS - extraBinds` 이하인 배열들. 빈 입력이면 빈 배열.
 */
export function chunkForBinds<T>(items: readonly T[], extraBinds = 0): T[][] {
  // 🔴 1 미만으로 떨어지면 영원히 도는 루프가 된다 — 쪼갤 수 없는 요청은 던져서 알린다
  //    (조용히 1개씩 보내면 100행에 100왕복이라 더 나쁜 사고다).
  const size = D1_MAX_BINDS - Math.max(0, Math.trunc(extraBinds))
  if (size < 1) throw new Error(`[d1-binds] extraBinds=${extraBinds} 면 IN 목록에 넣을 자리가 없다`)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
