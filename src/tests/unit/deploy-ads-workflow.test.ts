/**
 * 🚚 **ur-ads 배포가 조용히 안 나가는 것을 막는다** (2026-08-02 실사고).
 *
 * ## 무슨 일이 있었나
 * `#969`(레인 수 학습기)를 머지했는데 **ur-ads 워커에 안 올라갔다.** 실패 원문:
 * ```
 *   A request to the Cloudflare API (/accounts/***\/workers/services/ur-ads) failed.
 *   Rate limited. Please wait and consider throttling your request speed [code: 10429]
 * ```
 * 재시도는 있었지만 `sleep $((i*10))` = 10s·20s 라 **3번이 40초 안에 다 소진**됐다(15:03:29→15:03:51).
 * 레이트 리밋은 초 단위로 안 풀린다 — 재시도가 **있으나 마나**였다.
 *
 * 🔴 **대가가 조용하다.** 라이브는 멀쩡해 보이고 ur-ads 는 낡은 코드로 계속 돈다. 그날 머지 2건
 *   (`#971`·`#969`)의 ur-ads 코드가 배포되지 않은 채였고 아무도 몰랐다. 이 워크플로 주석이
 *   이미 경고했던 클래스(*"배포가 아예 안 돌아 ur-ads 가 조용히 낡은 코드로 계속 돌았다"*)의 재발이다.
 *
 * ## 그리고 더 나쁜 것 — **수리를 검증할 방법이 없었다**
 * `paths:` 에 이 워크플로 자신이 없어서, **이 파일을 고쳐도 배포가 안 돌았다.** 배포 경로가 깨졌을 때
 * 그 수리가 실제로 되는지 확인하려면 무관한 코드 변경을 기다려야 했다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: Cloudflare 가 실제로 몇 초 만에 리밋을 푸는지. 60·150·300 은
 *   추정이고, 다시 실패하면 로그의 시각 간격을 보고 늘려야 한다. 여기서 고정하는 건
 *   *"초 단위 재시도로는 안 된다"* 는 사실뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const WF = '.github/workflows/deploy-ads.yml'
const src = readFileSync(WF, 'utf8')

describe('ur-ads 배포 워크플로', () => {
  it('파일을 실제로 읽었다 — 경로가 낡으면 통과가 아니라 실패', () => {
    expect(src.length, `${WF} 가 비었거나 옮겨갔다`).toBeGreaterThan(500)
    expect(src).toContain('name: Deploy ur-ads Worker')
  })

  /**
   * 🔑 자기 자신을 경로에 넣지 않으면 **이 워크플로의 수리가 배포되지 않는다.**
   *   깨진 배포 경로를 고쳤는데 그 고침이 적용되지 않는, 자기참조적 사각지대다.
   */
  it('paths 에 자기 자신이 있다 — 없으면 배포 수리가 배포되지 않는다', () => {
    const pathsBlock = src.slice(src.indexOf('paths:'), src.indexOf('concurrency:'))
    expect(pathsBlock).toContain(WF)
  })

  it('ur-ads 번들이 끌어오는 코드 경로를 덮는다', () => {
    const pathsBlock = src.slice(src.indexOf('paths:'), src.indexOf('concurrency:'))
    for (const p of ['src/worker-ads/**', 'src/features/marketing/**', 'src/worker/**', 'wrangler-ads.toml']) {
      expect(pathsBlock, `${p} 가 빠지면 그 변경은 배포 없이 머지된다`).toContain(p)
    }
  })

  /**
   * 🔴 이 검사가 이 파일의 핵심이다. **초 단위 백오프는 10429 를 절대 못 넘긴다** —
   *   실측에서 3회 재시도가 40초 안에 전부 소진됐다.
   */
  it('레이트 리밋(10429)은 분 단위로 기다린다 — 초 단위면 재시도가 무의미하다', () => {
    expect(src, '10429 를 다른 일시 오류와 구분하지 않으면 짧은 백오프가 그대로 적용된다')
      .toMatch(/grep -qE '10429\|Rate limited'/)
    // 첫 재시도 대기가 분 단위인가.
    const m = src.match(/WAIT=\$\(\(\s*i == 1 \? (\d+)/)
    expect(m, '레이트 리밋 분기의 첫 대기값을 못 찾았다 — 코드가 옮겨갔다').not.toBeNull()
    expect(Number(m![1]), '첫 대기가 60초 미만이면 실측한 그 실패가 그대로 재현된다').toBeGreaterThanOrEqual(60)
  })

  it('재시도 횟수가 3회보다 많다', () => {
    const m = src.match(/MAX_RETRY=(\d+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(4)
  })

  /**
   * ⚠️ 백오프를 늘려 놓고 잡 타임아웃을 안 늘리면 **대기 도중 잡이 잘려** 재시도가 또 무의미해진다.
   *   (늘린 쪽만 고치고 만족하는, 이 레포가 반복해 만난 "반쪽 수리"를 여기서 막는다.)
   */
  /**
   * ⚠️ 타임아웃을 늘리면서 **이 스텝을 지우고 싶어진다**(대기가 둘이라 길어지므로). 지우면
   *   배포가 정각에 돌고 있는 isolate 를 죽여 그 회차 레인이 통째로 잘린다 — 2026-08-01 에
   *   `14:01:10` 에 레인 7개가 **같은 순간 같은 벽**에서 끊긴 게 그 사고다.
   */
  it('정각 회차 보호 대기가 남아 있다 — 배포가 도는 cron 을 죽인다', () => {
    expect(src).toContain('정각 회차 보호')
    expect(src, ':57~:03 창 판정이 사라지면 보호가 무의미하다').toMatch(/-ge 57 \]\s*\|\|\s*\[ "\$M" -le 3/)
  })

  it('잡 타임아웃이 최대 대기를 담는다', () => {
    const m = src.match(/timeout-minutes:\s*(\d+)/)
    expect(m).not.toBeNull()
    // 정각 보호 최대 6분 + 백오프 60+150+300=8.5분 + 설치·번들 → 20분 미만이면 잘린다.
    expect(Number(m![1]), '대기 총합보다 짧으면 타임아웃이 재시도를 삼킨다').toBeGreaterThanOrEqual(20)
  })
})
