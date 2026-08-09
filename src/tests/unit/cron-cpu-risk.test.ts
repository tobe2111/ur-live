/**
 * ⏱️ **CPU 한도 근접을 죽기 전에 알린다** — 계약 (2026-08-02 라이브 실측 후 신설).
 *
 * ## 왜 이게 필요한가
 * 08-02 01:00 KST 에 레인 셋이 `Worker exceeded CPU time limit` 로 죽었다(26,027 / 26,039 / 26,563 ms).
 * 그 셋은 고쳤다. 그런데 같은 틱에서 **인플루언서 자동수집(`ads:collect`)이 15,425ms** 로 돌고 있었다 —
 * 죽는 지점의 **59%**. 살아 있으니 화면 어디에도 경고가 없다. 데이터가 늘면 같은 벽에 닿을 텐데
 * **죽어야 알게 된다.**
 *
 * 이 레포가 반복해 만난 실패의 변종이다: *부재는 침묵과 다르게 생겼다* 는 이미 배웠는데,
 * 여기서는 **임박이 정상과 똑같이 생겼다.**
 *
 * ## 기준의 출처 (추측이 아니다)
 * - `CPU_WALL_MS = 26_000` — 실측 사망 3건의 최솟값(26,027)을 내림한 값
 * - `CPU_WARN_MS = 15_000` — 벽의 약 58%. **18,000 으로 잡았다가 이 시험이 잡아냈다** — 정작 만든 이유였던
 *   `ads:collect`(15,425ms)가 그 아래라 조용히 통과했다. 목표를 못 잡는 임계값은 임계값이 아니다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 벽시계는 CPU 가 아니다. 외부가 느린 회차는 CPU 여유가 있어도 warn 이 뜬다(그건 오탐이라기보다
 *   '알아둘 값' 이다 — 그 회차도 죽을 자리 가까이 있었다).
 * - 짧은 벽시계인데 CPU 를 태우는 경우는 **못 잡는다**. 워커 런타임이 CPU 실측치를 안 준다.
 */
import { describe, it, expect } from 'vitest'
import { cpuRisk, CPU_WALL_MS, CPU_WARN_MS } from '@/worker/utils/cron-heartbeat'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('cpuRisk — 실측 사망 지점에서 유도한 기준', () => {
  it('🔒 기준이 실측을 벗어나지 않는다 — 벽은 사망 최솟값 이하, 경고선은 성공 최장 아래', () => {
    expect(CPU_WALL_MS, '실측 사망 최솟값 26,027 을 넘으면 danger 를 놓친다').toBeLessThanOrEqual(26_027)
    expect(CPU_WARN_MS, '성공 최장 21,026 보다 높으면 그 레인을 못 잡는다').toBeLessThan(21_026)
    expect(CPU_WARN_MS, '너무 낮으면 정상 레인이 전부 warn 이 되어 신호가 죽는다').toBeGreaterThan(10_000)
  })

  it('실측값으로 갈린다', () => {
    expect(cpuRisk(26_027), '실제로 죽은 값').toBe('danger')  // collect-commerce
    expect(cpuRisk(26_563), '실제로 죽은 값').toBe('danger')  // collect-nps
    expect(cpuRisk(21_026), '살아남았지만 위험 구간').toBe('warn')    // reclassify-company
    expect(cpuRisk(15_425), '인플루언서 수집 — 이걸 잡으려고 만들었다').toBe('warn')
    expect(cpuRisk(8_316), '여유 있음').toBeNull()   // collect-store-kakao
    expect(cpuRisk(2_374), '여유 있음').toBeNull()   // social-maintenance
  })

  it('판단 불가는 **경보하지 않는다** — 모르면 조용한 편이 오탐보다 낫다', () => {
    expect(cpuRisk(null)).toBeNull()
    expect(cpuRisk(undefined)).toBeNull()
    expect(cpuRisk(0)).toBeNull()
    expect(cpuRisk(-1)).toBeNull()
    expect(cpuRisk(NaN)).toBeNull()
  })

  /**
   * 🔁 **2026-08-09 재작성** — 이 함수는 살아 있지만 **의미가 바뀌었다.**
   *   `ms` 는 워커에서 **I/O 시간**이다(`Date.now()` 가 CPU 구간엔 멈춘다) ⇒ CPU 위험이 아니다.
   *   라이브가 반대로 찍는 걸 확인했다: `d1-backup` 146,975ms 는 멀쩡한데 `danger`,
   *   `collect-commerce` 는 13,921ms 에 **죽었는데** `null`. 같은 레인이 13.8초에 죽고 80.7초에 살았다.
   *   ⇒ 위험 판정은 `cpuRiskFromDeaths`(실제 사망 기록)로 옮겼고, 이 함수는 **`io_slow`**
   *     (= 느리다, 외부 API 지연 신호)로 남는다. 아래 위 케이스들은 그 새 의미에서 여전히 유효하다.
   */
  it('🔗 목록에 실린다 — 다만 이름이 io_slow 다(CPU 위험은 사망 기록이 판정한다)', () => {
    const SRC = readFileSync(resolve(process.cwd(), 'src/worker/utils/cron-heartbeat.ts'), 'utf8')
    expect(SRC, 'ms 기반 값은 io_slow 로 실린다').toMatch(/io_slow: cpuRisk\(ms\)/)
    expect(SRC, 'CPU 위험은 사망 기록에서').toMatch(/cpu_risk: cpuRiskFromDeaths\(/)
    expect(SRC, '타입에도 있어야 소비처가 쓴다').toMatch(/cpu_risk\?: 'warn' \| 'danger' \| null/)
  })
})
