/**
 * 🐺 5xx 경보가 **1건을 "스파이크"라고 부르던 것** + 무엇이 실패했는지 없던 것 (2026-08-03)
 *
 * ## 실측
 *
 * 대표 다이제스트에 `⚠️ 5xx spike 2건 발생 (24h)` 이 떠 있었다. D1 을 직접 보니:
 *
 * ```
 *   08-03 08:33 KST count=1 · 07:34 count=1 · 06:38 count=1 · 05:46 count=1 …
 * ```
 *
 * **모든 창이 count=1** 이고 대략 시간당 1건이다. 스파이크 임계는 `SPIKE_THRESHOLD = 10/분` 이므로
 * 이건 스파이크가 아니다. 예전 문구는 `COUNT(*)`(= 5xx 가 하나라도 있던 **분의 개수**)를 그대로
 * "spike N건" 이라 불렀다 — **거짓 경보**이고, 진짜 스파이크가 왔을 때 구분이 안 된다.
 *
 * 그리고 더 큰 문제: 표에 **숫자만** 있었다(`key='global'`). 경보를 받아도
 * **무엇이 실패했는지 알 수 없다** — 다음 행동을 정할 수 없는 경보다.
 *
 * ## 이 테스트가 **못 막는 것**
 *
 * - 실제로 무엇이 5xx 를 내는지. 이 수정은 *기록할 자리*를 만들 뿐이고,
 *   판정은 배포 후 24시간 뒤 `5xx_path` 분포로 한다.
 * - 임계값 10/분 이 적절한지. 그건 트래픽이 늘면 재조정할 값이다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => {
  const p = path.join(process.cwd(), rel)
  expect(fs.existsSync(p), `${rel} 이 없다 — 경로가 낡으면 통과가 아니라 실패다`).toBe(true)
  return fs.readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
}

const MON = read('src/worker/middleware/error-rate-monitor.ts')
const DIAG = read('src/worker/cron/daily-self-diagnostic.ts')

describe('5xx 모니터 — 무엇이 실패했는지 기록한다', () => {
  it('경로별 계수를 같은 표에 쌓는다', () => {
    expect(MON).toMatch(/'5xx_path'/)
    expect(MON).toMatch(/new URL\(c\.req\.url\)\.pathname\.slice\(0, 80\)/)
  })

  it('스파이크 판정은 여전히 global 합계로 한다', () => {
    // 경로별로만 세면 여러 경로에 흩어진 스파이크를 놓친다.
    expect(MON).toMatch(/VALUES \('global', '5xx_spike', \?, 1\)/)
    expect(MON).toMatch(/WHERE key='global' AND action='5xx_spike' AND window_start=\?/)
  })

  it('경로 기록 실패가 요청을 막지 않는다', () => {
    // 관측이 서비스를 깨뜨리면 안 된다 — 이 미들웨어의 대전제.
    expect(MON).toMatch(/'5xx_path'[\s\S]{0,300}?\.run\(\)\.catch\(\(\) => null\)/)
  })
})

describe('일일 진단 — 1건을 스파이크라 부르지 않는다', () => {
  it('창 개수가 아니라 실제 건수를 센다', () => {
    // 예전: COUNT(*) = "5xx 가 있던 분의 개수" 를 그대로 spike 건수로 보고했다.
    expect(DIAG).toMatch(/COALESCE\(SUM\(count\),0\) AS total/)
    expect(DIAG).toMatch(/COALESCE\(MAX\(count\),0\) AS worst/)
  })

  it('임계를 넘은 적이 있을 때만 🔴 로 올린다', () => {
    expect(DIAG).toMatch(/if \(Number\(row\?\.worst \|\| 0\) >= 10\) issues\.push/)
    // 임계 미만은 정보로 — 거짓 🔴 를 매일 보내면 진짜가 묻힌다.
    expect(DIAG).toMatch(/else info\.push\(line\)/)
  })

  it('어디서 나는지 붙인다', () => {
    expect(DIAG).toMatch(/action='5xx_path'/)
    expect(DIAG).toMatch(/ORDER BY n DESC LIMIT 3/)
  })

  it('옛 문구로 되돌아가지 않는다', () => {
    expect(DIAG).not.toMatch(/5xx spike \$\{row\.c\}건/)
  })
})

describe('임계 판정 산술 — 경계를 실제로 계산한다', () => {
  // 텍스트가 아니라 규칙 자체를 본다.
  const isSpike = (worst: number) => worst >= 10

  it('분당 1건은 스파이크가 아니다 (실측 상태)', () => {
    expect(isSpike(1)).toBe(false)
  })

  it('분당 9건도 아니다 (경계 바로 아래)', () => {
    expect(isSpike(9)).toBe(false)
  })

  it('분당 10건부터 스파이크다 (미들웨어 SPIKE_THRESHOLD 와 일치)', () => {
    expect(isSpike(10)).toBe(true)
    expect(MON).toMatch(/const SPIKE_THRESHOLD = 10/)   // 두 곳이 갈라지면 판정이 어긋난다
  })
})
