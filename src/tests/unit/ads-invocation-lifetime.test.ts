/**
 * 🩸 **피호출자는 호출자보다 오래 못 산다** — 유어애즈 레인 수명 불변식 (2026-07-29 라이브 실측).
 *
 *   ## 무슨 일이 있었나
 *   드라이버를 "즉시 응답 + 라운드는 `waitUntil`" 로 바꿨다. 의도는 부모(`kick` 의 `await SELF.fetch`)를
 *   빨리 풀어 주는 것이었다. 결과는 **라운드가 0회**였다.
 *     · 11:00 틱: `ads:enrich-influencer-driver`(11:00:02, ok, result=null) · `ads:collect`(11:00:02,
 *       "started=true") — 둘 다 **즉시** 기록. 그런데 9분 뒤까지 `enrich_lane.last_run`=10:00:18,
 *       `run.last_run`=09:00:04 그대로. 시작만 하고 아무것도 안 끝났다.
 *     · 직전(구 코드) 10:00 틱은 최소 1라운드를 돌렸다 → 즉시 응답이 **일을 지운** 것이다.
 *   이유: 서비스 바인딩 피호출자의 수명은 호출자에 묶인다. 응답을 앞당기면 호출자의 `await` 이 먼저 풀리고,
 *   그 순간 피호출자의 `waitUntil` 작업이 취소된다. **응답을 빨리 할수록 더 빨리 죽는다.**
 *
 *   ## 이 파일이 고정하는 것
 *   "라운드 작업은 응답 **전에** 끝낸다." 다음 라운드 spawn 만 `waitUntil` 로 던진다(그건 ACK 만 기다린다).
 *
 *   ⚠️ 못 막는 것: spawn 된 다음 라운드가 **실제로 살아남는지**는 코드 모양으로 알 수 없다(플랫폼 수명 규칙).
 *   그건 하트비트의 `depth` 로 관측한다 — 다음 틱에 `depth`가 계속 0 이면 체인이 안 이어지는 것이고,
 *   그때 처방은 "cron 이 라운드를 직접 N번 kick"(루트가 수명을 쥔다)이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { capAfterAbandonedRun } from '@/features/marketing/api/collect-budget'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('레인 수명 — 작업은 응답 전에 끝낸다', () => {
  const enrich = read('src/worker-ads/enrich.routes.ts')

  it('dispatchRoundChain 이 라운드 전체를 waitUntil 로 떼어내고 즉시 응답하지 않는다', () => {
    const fn = /async function dispatchRoundChain\([\s\S]*?\n\}\n/.exec(enrich)?.[0] || ''
    expect(fn, 'dispatchRoundChain 을 못 찾았다 — 리네임됐다면 이 테스트도 갱신할 것').toBeTruthy()
    // 라운드 본체(local())는 반드시 await 된다.
    expect(fn).toMatch(/await\s+local\(\)/)
    // 🚫 회귀 형태: 작업 묶음을 통째로 waitUntil 에 넣고 곧장 응답하는 판(= 11:00 에 0라운드를 만든 코드).
    expect(fn).not.toMatch(/waitUntil\(\s*work\(\)\s*\)/)
    expect(fn).not.toMatch(/detached:\s*true/)
  })

  it('다음 라운드 spawn 만 waitUntil 로 던진다(응답을 막지 않는다)', () => {
    const fn = /async function dispatchRoundChain\([\s\S]*?\n\}\n/.exec(enrich)?.[0] || ''
    expect(fn).toMatch(/waitUntil\([\s\S]{0,200}SELF\.fetch/)
  })

  it('하트비트에 depth 를 실어 체인 생존을 밖에서 볼 수 있다', () => {
    // depth 가 없으면 "체인이 이어졌는가"를 라이브에서 판정할 방법이 없다(이 환경은 wss 로그가 막혀 있다).
    expect(enrich).toMatch(/depth:\s*r\.depth/)
  })

  it('collect-chain 도 수집을 끝낸 뒤 응답한다(같은 규칙)', () => {
    const chain = read('src/worker-ads/chain.routes.ts')
    const h = /chainRoutes\.post\('\/__ads\/collect-chain'[\s\S]*?\n\}\)\n/.exec(chain)?.[0] || ''
    expect(h).toBeTruthy()
    expect(h).toMatch(/await\s+runInfluencerAutoCollect\(/)
    expect(h).not.toMatch(/waitUntil\([\s\S]{0,120}runInfluencerAutoCollect/)
  })
})

/**
 * 🪦 **말없이 죽은 회차도 상한을 내린다.**
 *
 *   자기교정 루프가 `hitLimit`(잡히는 예외)에만 반응하면, 인보케이션째 사라지는 실패에서는
 *   상한이 **오히려 올라간다**(회복 +2). 그러면 다음 회차도 같은 자리에서 죽는다 — 닫힌 고리다.
 *   실측 11:00: `spent 40/40 · learned_cap 44 · limit_hit false` 인데 마감 기록이 없었다.
 */
describe('capAfterAbandonedRun — 유기된 회차의 하향', () => {
  it('직전 회차가 유기됐으면 상한을 내린다', () => {
    expect(capAfterAbandonedRun(44, 300, 60)).toBe(35) // floor(44 * 0.8)
  })

  it('바닥(SUBREQ_CAP_MIN) 아래로는 안 내려간다 — 수확 0 이 되면 학습 자체가 무의미', () => {
    expect(capAfterAbandonedRun(26, 300, 60)).toBe(25)
    expect(capAfterAbandonedRun(5, 300, 60)).toBe(25)
  })

  it('학습값이 없으면(0) 천장 기준으로 내린다 — 무근거로 천장을 그대로 쓰지 않는다', () => {
    expect(capAfterAbandonedRun(0, 300, 60)).toBe(48) // floor(60 * 0.8)
  })

  it('천장을 넘게 드리프트한 학습값도 천장 기준으로 깎는다', () => {
    expect(capAfterAbandonedRun(172, 300, 60)).toBe(48)
  })

  it('env 예산이 천장보다 작으면 그쪽이 기준이다', () => {
    expect(capAfterAbandonedRun(100, 40, 60)).toBe(32) // floor(40 * 0.8)
  })
})

/**
 * 🔒 유기 판정은 **CAS 를 이겼을 때만** 유효하다.
 *   졌다면(=다른 실행이 lease 보유) 그 값은 살아 있는 실행의 것이지 시체가 아니다.
 *   이 구분이 없으면 동시 실행이 서로를 "죽은 것"으로 신고해 상한이 계속 깎인다.
 */
describe('수집 엔진 — 유기 lease 판정의 배선', () => {
  const src = read('src/features/marketing/api/influencer-auto-collect.ts')

  it('CAS 승리(meta.changes)와 직전 값(>0)을 함께 본다', () => {
    expect(src).toMatch(/abandonedPrev\s*=\s*!!leaseR\?\.meta\?\.changes\s*&&\s*priorLease\s*>\s*0/)
  })

  it('직전 lease 읽기를 seed 와 같은 batch 로 묶는다 — 관측이 예산을 더 먹지 않게', () => {
    expect(src).toMatch(/DB\.batch<\{ value: string \}>\(\[[\s\S]{0,400}SELECT value FROM platform_settings/)
  })

  it('유기 판정이 이번 회차의 예산에 즉시 반영된다(다음 회차가 아니라)', () => {
    // 죽은 회차는 상한을 못 낮춘다 → 낮추는 일은 살아남은 쪽이 해야 한다.
    expect(src).toMatch(/abandonedPrev\s*\?\s*capAfterAbandonedRun\(storedCap/)
  })
})
