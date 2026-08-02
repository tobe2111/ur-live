/**
 * 🚚 **배포가 조용히 안 나가는 것을 막는다** — 네 배포 워크플로 공통 (2026-08-02 실사고).
 *
 * ## 무슨 일이 있었나
 * `#969`(레인 수 학습기)를 머지했는데 **어디에도 안 올라갔다.** 두 워크플로가 같은 이유로 죽었다:
 * ```
 *   A request to the Cloudflare API (/accounts/***\/workers/services/ur-ads) failed.
 *   A request to the Cloudflare API (/accounts/***\/pages/projects/ur-live)   failed.
 *   Rate limited. Please wait and consider throttling your request speed [code: 10429]
 * ```
 * 재시도는 넷 다 있었지만 전부 `SLEEP=$((i*10))` = 10s·20s 라 **40초 안에 소진**됐다.
 * 레이트 리밋은 초 단위로 안 풀린다 — **재시도가 있으나 마나**였다.
 *
 * 🔴 **대가가 조용하다.** 라이브는 멀쩡해 보이고 낡은 코드가 계속 돈다. 실측:
 * - `Deploy ur-ads Worker` … 2건 실패(#971 · #969)
 * - `Deploy to Cloudflare Pages`(**소비자 사이트**) … **연속 4회 실패**(22:53 · 23:37 · 23:47 · 23:56 KST)
 *
 * ⚠️ **이 테스트가 못 보는 것**: Cloudflare 가 실제로 몇 초 만에 리밋을 푸는지. 60·150·300 은
 *   추정이고, 다시 실패하면 로그의 시각 간격을 보고 늘려야 한다. 여기서 고정하는 건
 *   *"초 단위 재시도로는 안 된다"* 는 사실과 **네 워크플로가 같이 움직인다**는 것뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/** 배포를 수행하는 워크플로 전부. 하나만 고치고 만족하면 나머지가 같은 이유로 죽는다. */
const DEPLOY_WORKFLOWS = [
  '.github/workflows/main.yml',             // 소비자 Pages (ur-live)
  '.github/workflows/deploy-ads.yml',       // 유어애즈 Worker (ur-ads)
  '.github/workflows/deploy-wholesale.yml', // 도매 Pages (ur-wholesale)
  '.github/workflows/worker-deploy.yml',    // cron Worker (ur-live)
] as const

const read = (p: string) => readFileSync(p, 'utf8')

describe('배포 워크플로 — 레이트 리밋 백오프', () => {
  it('네 워크플로를 실제로 읽었다 — 경로가 낡으면 통과가 아니라 실패', () => {
    expect(DEPLOY_WORKFLOWS.length).toBe(4)
    for (const p of DEPLOY_WORKFLOWS) expect(read(p).length, `${p} 가 비었거나 옮겨갔다`).toBeGreaterThan(500)
  })

  /**
   * 🔴 이 검사가 이 파일의 핵심이다. **초 단위 백오프는 10429 를 절대 못 넘긴다.**
   *   그리고 **넷 전부**여야 한다 — 한 곳만 고치면 다음엔 다른 곳이 같은 이유로 죽는다.
   */
  it.each(DEPLOY_WORKFLOWS)('%s — 10429 를 구분하고 분 단위로 기다린다', (wf) => {
    const src = read(wf)
    expect(src, '10429 를 다른 일시 오류와 구분하지 않으면 짧은 백오프가 그대로 적용된다')
      .toMatch(/grep -qE '10429\|Rate limited'/)
    const m = src.match(/(?:SLEEP|WAIT)=\$\(\(\s*i == 1 \? (\d+)/)
    expect(m, '레이트 리밋 분기의 첫 대기값을 못 찾았다 — 코드가 옮겨갔다').not.toBeNull()
    expect(Number(m![1]), '첫 대기가 60초 미만이면 실측한 그 실패가 그대로 재현된다').toBeGreaterThanOrEqual(60)
  })

  it.each(DEPLOY_WORKFLOWS)('%s — 재시도가 3회보다 많다', (wf) => {
    const m = read(wf).match(/MAX_RETRY=(\d+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(4)
  })

  /**
   * ⚠️ 백오프를 늘려 놓고 잡 타임아웃을 안 늘리면 **대기 도중 잡이 잘려** 재시도가 또 무의미해진다.
   *   (늘린 쪽만 고치고 만족하는 "반쪽 수리"를 여기서 막는다.)
   */
  it.each(DEPLOY_WORKFLOWS)('%s — 잡 타임아웃이 최대 대기(≈8.5분)를 담는다', (wf) => {
    const m = read(wf).match(/timeout-minutes:\s*(\d+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1]), '대기 총합보다 짧으면 타임아웃이 재시도를 삼킨다').toBeGreaterThanOrEqual(25)
  })

  /**
   * 🔑 자기 자신을 경로에 넣지 않으면 **그 워크플로의 수리가 배포되지 않는다.**
   *   깨진 배포 경로를 고쳤는데 그 고침이 적용되지 않는, 자기참조적 사각지대다.
   *   (`main.yml` 은 경로 필터가 없어 모든 push 에 돌므로 해당 없음.)
   */
  it.each(['.github/workflows/deploy-ads.yml', '.github/workflows/worker-deploy.yml'])(
    '%s — paths 에 자기 자신이 있다', (wf) => {
      const src = read(wf)
      const block = src.slice(src.indexOf('paths:'), src.indexOf('concurrency:'))
      expect(block, '자기 자신이 없으면 이 워크플로의 수리가 배포되지 않는다').toContain(wf)
    })
})

/**
 * 🚨 **실패를 대표가 보는 곳에 남긴다** (2026-08-03 신설).
 *
 * 재시도를 고쳐도 **언젠가는 실패한다.** 그때 신호가 Actions 탭 안에만 있으면 오늘과 똑같아진다 —
 * 라이브가 뒤처진 채로 아무도 모른다(실측: 소비자 사이트 4개 머지분, 발견은 D1 을 직접 뒤져서).
 * ⇒ 실패한 배포 잡이 **스스로** 어드민 벨 + `cron_failures` 에 남긴다.
 *
 * 🔑 왜 "번들 나이 감시" 가 아닌가: 워커가 자기 `build_age_min` 을 보는 방식은
 *   *"배포가 실패했다"* 와 *"아무도 머지를 안 했다"* 를 **구분하지 못한다**(조용한 날마다 오경보).
 *   실패한 잡 자신은 그 구분이 필요 없다 — **자기가 실패했다는 걸 안다.** 오탐 0.
 */
describe('배포 실패 알림 — 조용한 실패 차단', () => {
  it.each(DEPLOY_WORKFLOWS)('%s — 실패 시 어드민에 기록하는 스텝이 있다', (wf) => {
    const src = read(wf)
    expect(src, '실패 알림 스텝이 없으면 실패가 Actions 탭 안에만 남는다')
      .toContain('scripts/report-deploy-failure.sh')
    expect(src, 'if: failure() 가 없으면 성공 때도 울리거나 실패 때 안 울린다').toMatch(/if: failure\(\)/)
    expect(src, 'continue-on-error 가 없으면 관측 실패가 배포 결과를 바꾼다')
      .toMatch(/continue-on-error: true/)
  })

  /**
   * ⚠️ **관측이 배포 결과를 바꾸면 본말전도다.** 스크립트가 실패로 끝나면 `continue-on-error` 가
   *   있어도 잡 로그가 지저분해지고, 없으면 잡 상태까지 바뀐다. 그래서 **항상 exit 0**.
   */
  it('알림 스크립트는 어떤 경우에도 exit 0 — 배포 결과를 바꾸지 않는다', () => {
    const s = read('scripts/report-deploy-failure.sh')
    expect(s.length).toBeGreaterThan(500)
    expect(s, '자격 없을 때 조용히 넘어가야 한다').toMatch(/exit 0/)
    expect(s, 'set -e 는 중간 실패로 비정상 종료를 만든다').not.toMatch(/^set -e\b/m)
    // 대표가 실제로 보는 두 곳에 남는가.
    expect(s).toContain('cron_failures')
    expect(s).toContain('dashboard_notifications')
  })
})

describe('ur-ads 배포 워크플로 — 고유 불변식', () => {
  const WF = '.github/workflows/deploy-ads.yml'

  it('ur-ads 번들이 끌어오는 코드 경로를 덮는다', () => {
    const src = read(WF)
    const block = src.slice(src.indexOf('paths:'), src.indexOf('concurrency:'))
    for (const p of ['src/worker-ads/**', 'src/features/marketing/**', 'src/worker/**', 'wrangler-ads.toml']) {
      expect(block, `${p} 가 빠지면 그 변경은 배포 없이 머지된다`).toContain(p)
    }
  })

  /**
   * ⚠️ 타임아웃을 늘리면서 **이 스텝을 지우고 싶어진다**(대기가 둘이라 길어지므로). 지우면
   *   배포가 정각에 돌고 있는 isolate 를 죽여 그 회차 레인이 통째로 잘린다 — 2026-08-01 에
   *   `14:01:10` 에 레인 7개가 **같은 순간 같은 벽**에서 끊긴 게 그 사고다.
   */
  it('정각 회차 보호 대기가 남아 있다 — 배포가 도는 cron 을 죽인다', () => {
    const src = read(WF)
    expect(src).toContain('정각 회차 보호')
    expect(src, ':57~:03 창 판정이 사라지면 보호가 무의미하다').toMatch(/-ge 57 \]\s*\|\|\s*\[ "\$M" -le 3/)
  })
})
