/**
 * 📏 D1 읽기 계량기 — **작업별 귀속** (cron 워커 전용).
 *
 * cron 인보케이션 하나가 `ctx.waitUntil(safeCron(...))` 로 작업 여러 개를 **동시에** 띄운다.
 * 그 작업들은 같은 `env` 를 클로저로 잡고 있어 DB 래퍼를 작업마다 따로 줄 수 없다 →
 * AsyncLocalStorage 로 "지금 어느 작업 안인가"를 쿼리 시점에 찾는다. `nodejs_compat` 이 제공한다.
 *
 * ⚠️ **`node:async_hooks` 를 정적으로 import 하지 않는다** (2026-09-02 ur-wholesale Pages 프리뷰 빌드 실패).
 *   같은 워커 번들이 Pages 프로젝트 셋(ur-live · ur-wholesale · cron Workers)에 실리는데, Pages 의 배포 단계
 *   번들러는 프로젝트에 `nodejs_compat` 이 없으면 `node:` 정적 import 에서 죽는다. 그래서 **런타임에 문자열로**
 *   불러오고, 없으면 계량을 끈다(귀속 없이 0 — 기능은 그대로). cron 은 Workers 프로젝트(nodejs_compat)에서만 돈다.
 * ⚠️ 이 파일은 워커·Node 전용이다. 클라이언트 번들에서는 쓰지 않는다.
 */
import { withMeteredEnv, type ReadMeter } from './d1-read-meter'

interface AlsLike<T> { run<R>(store: T, fn: () => R): R; getStore(): T | undefined }
/** undefined = 아직 안 해봄 · null = 이 런타임엔 없음(계량 끔) */
let als: AlsLike<ReadMeter> | null | undefined

/** 인보케이션 첫머리에서 한 번. 실패해도 던지지 않는다 — 계량이 cron 을 막으면 안 된다. */
export async function initTaskMeter(): Promise<boolean> {
  if (als !== undefined) return als !== null
  try {
    const spec = 'node:async_hooks' // 문자열 변수 — 번들러가 정적으로 풀지 않게(위 헤더)
    const mod = await import(/* @vite-ignore */ spec) as { AsyncLocalStorage?: new () => AlsLike<ReadMeter> }
    als = mod?.AsyncLocalStorage ? new mod.AsyncLocalStorage() : null
  } catch {
    als = null
  }
  return als !== null
}

/** env 의 D1 을 "현재 작업의 계량기"로 흘러가게 감싼다. 작업 밖에서 난 쿼리는 세지 않는다. */
export function installTaskMeteredEnv<E extends object>(env: E): E {
  return withMeteredEnv(env, () => als?.getStore())
}

/**
 * 작업 하나를 `meter` 안에서 돌린다. 계량기를 **호출자가 먼저 만들어 넘기는** 이유: 작업이 던져도
 * 그때까지 읽은 양은 하트비트에 실려야 한다(실패한 작업이 제일 많이 읽는 경우가 흔하다).
 * ALS 가 없는 런타임이면 그냥 돌린다(계량 0).
 */
export function runInMeter<T>(meter: ReadMeter, fn: () => Promise<T>): Promise<T> {
  return als ? als.run(meter, fn) : fn()
}

/** 지금 어느 작업 안인가(테스트·진단용). */
export function currentMeter(): ReadMeter | undefined {
  return als?.getStore()
}
