/**
 * 📏 D1 읽기 계량기 — **작업별 귀속** (cron 워커 전용).
 *
 * cron 인보케이션 하나가 `ctx.waitUntil(safeCron(...))` 로 작업 여러 개를 **동시에** 띄운다.
 * 그 작업들은 같은 `env` 를 클로저로 잡고 있어 DB 래퍼를 작업마다 따로 줄 수 없다 →
 * AsyncLocalStorage 로 "지금 어느 작업 안인가"를 쿼리 시점에 찾는다. `nodejs_compat` 이 제공한다.
 *
 * ⚠️ 이 파일은 `node:async_hooks` 를 import 하므로 **워커·Node 전용**이다. 클라이언트 번들이나
 *   `node:*` 를 외부화하지 않은 빌드(ur-ads)에서는 순수 래퍼(`d1-read-meter.ts`)만 쓸 것.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { withMeteredEnv, type ReadMeter } from './d1-read-meter'

const als = new AsyncLocalStorage<ReadMeter>()

/** env 의 D1 을 "현재 작업의 계량기"로 흘러가게 감싼다. 작업 밖에서 난 쿼리는 세지 않는다. */
export function installTaskMeteredEnv<E extends object>(env: E): E {
  return withMeteredEnv(env, () => als.getStore())
}

/**
 * 작업 하나를 `meter` 안에서 돌린다. 계량기를 **호출자가 먼저 만들어 넘기는** 이유: 작업이 던져도
 * 그때까지 읽은 양은 하트비트에 실려야 한다(실패한 작업이 제일 많이 읽는 경우가 흔하다).
 */
export function runInMeter<T>(meter: ReadMeter, fn: () => Promise<T>): Promise<T> {
  return als.run(meter, fn)
}

/** 지금 어느 작업 안인가(테스트·진단용). */
export function currentMeter(): ReadMeter | undefined {
  return als.getStore()
}
