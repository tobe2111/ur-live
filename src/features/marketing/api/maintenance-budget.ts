/**
 * 🧮 정비 레인 D1 연산 예산 (2026-07-28 — 자동 정비 무음 정지 근본수리)
 *
 *   **배경(실측)**: Cloudflare 는 D1 쿼리도 인보케이션 서브리퀘스트 한도에 넣는다(#784 확증).
 *   이 계정의 실효 상한은 학습값 `ads_subreq_cap` = 29 수준(무료 플랜 50 한도 − 오버헤드).
 *   그런데 야간 정비 파이프라인은 한 인보케이션에서 **수백~수천 쿼리**를 쓰도록 작성돼 있었다
 *   (중복통합 그룹당 3쿼리 × 150그룹 × 4패스 + 3.6만 행 전수 페이징 …).
 *   → 매 실행이 한도에서 죽고, 모든 D1 호출이 `.catch(() => null)` 이라 **예외조차 신호가 되지 못해**
 *     마지막의 결과 스탬프 쓰기까지 실패 → 어드민 화면엔 "아무것도 안 돈" 상태로만 보였다.
 *
 *   ⇒ 예산을 세는 래퍼로 DB 를 감싼다. 소진되면 **throw 하지 않고 빈 결과를 돌려준다** —
 *     기존 호출부가 예외를 전부 삼키는 구조라 예외는 신호가 못 되지만, "행 0개"는 이미 모든 루프가
 *     정상 종료 조건으로 다루기 때문이다. 대신 `exhausted` 플래그로 호출부가 **"끝난 것"과
 *     "예산이 떨어진 것"을 구분**할 수 있게 한다(이 구분이 없으면 커서가 0 으로 리셋돼 영원히 제자리).
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { isSubrequestLimitError } from './collect-budget'

/** 한 인보케이션의 D1 연산 예산. `used` 는 실제 소비량(학습 상한 갱신 입력). */
export interface OpBudget {
  left: number
  used: number
  /** 예산이 떨어져 no-op 을 반환한 적이 있는가 — "완료"와 구분하는 유일한 신호. */
  exhausted?: boolean
  /** 플랫폼 한도 예외를 실제로 관측했는가(학습 하향 트리거). */
  limitHit?: boolean
}

/** 예산 객체 생성. */
export const newOpBudget = (left: number): OpBudget => ({ left: Math.max(0, left), used: 0 })

const EMPTY_META = { changes: 0, duration: 0, last_row_id: 0, rows_read: 0, rows_written: 0, changed_db: false }
const EMPTY_RUN = { success: true, results: [], meta: EMPTY_META }
const EMPTY_ALL = { success: true, results: [], meta: EMPTY_META }

/** 래퍼 statement → 실제 statement (batch 언랩용). */
const REAL = new WeakMap<object, D1PreparedStatement>()

/**
 * 예산을 소비하는 D1 래퍼. 소진 후의 모든 쿼리는 **빈 결과 no-op**(DB 무접촉).
 *   - `prepare().bind().run()/all()/first()/raw()` 각 1 연산
 *   - `batch([...])` 1 연산(문장 수 무관 — 플랫폼도 1 서브리퀘스트로 센다)
 *   - 한도 예외를 만나면 `limitHit` 표시 + 잔여 예산 0(그 인보케이션은 더 못 쓴다)
 */
export function budgetedDb(DB: D1Database, budget: OpBudget): D1Database {
  const spend = (): boolean => {
    if (budget.left <= 0) { budget.exhausted = true; return false }
    budget.left--; budget.used++
    return true
  }
  const guard = async <T>(run: () => Promise<T>, empty: T): Promise<T> => {
    if (!spend()) return empty
    try {
      return await run()
    } catch (e) {
      const msg = (e as Error)?.message
      if (isSubrequestLimitError(msg)) {
        budget.limitHit = true; budget.exhausted = true; budget.left = 0
        return empty
      }
      throw e // 그 외 오류는 기존 호출부의 catch 로 — 동작 불변
    }
  }
  const wrap = (real: D1PreparedStatement): D1PreparedStatement => {
    const w = {
      bind: (...values: unknown[]) => wrap((real.bind as (...v: unknown[]) => D1PreparedStatement)(...values)),
      first: (col?: string) => guard(() => (col === undefined ? real.first() : real.first(col)), null),
      run: () => guard(() => real.run(), EMPTY_RUN),
      all: () => guard(() => real.all(), EMPTY_ALL),
      raw: () => guard(() => real.raw(), [] as unknown[]),
    } as unknown as D1PreparedStatement
    REAL.set(w as unknown as object, real)
    return w
  }
  return {
    prepare: (sql: string) => wrap(DB.prepare(sql)),
    batch: (stmts: D1PreparedStatement[]) =>
      guard(() => DB.batch(stmts.map(s => REAL.get(s as unknown as object) || s)), [] as unknown[]),
    exec: (q: string) => DB.exec(q),
    dump: () => DB.dump(),
  } as unknown as D1Database
}
