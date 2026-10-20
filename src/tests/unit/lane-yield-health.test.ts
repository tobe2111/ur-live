/**
 * 🩺 **수확 0 이 지속되는 레인을 드러낸다** — 계약 (2026-08-02 라이브 실측 후 신설).
 *
 * ## 실측이 말한 것
 * ```
 *   collect-hira    총 60회 실행 · total_saved 0 · diag.error "네트워크 오류: timeout"
 *   collect(인허가)  총 27회 실행 · total_saved 0 · diag.error "API: HTTP 500"
 *   하트비트:       ads:collect-hira  ok=true  ms=25750       ← 초록이다
 * ```
 * 60회를 돌아 한 건도 못 캤는데 **어디서도 빨간불이 아니다.** 하트비트는 "예외 없이 끝났는가"만 보고,
 * 레인은 실패를 `diag.error` 에 얌전히 적고 정상 종료한다. 그리고 죽은 레인도 살아 있는 레인과
 * **똑같이 회차 순번을 나눠 갖는다** — 대표 우선업종 레인이 그만큼 밀린다.
 *
 * ## 🛡️ 이 시험이 제일 신경 쓰는 것: **오경보를 안 내는 것**
 * `saved === 0` 만으로 울리면 **풀 포화**(발굴은 되는데 전부 중복)를 고장으로 오인한다.
 * `collect-health-alert` 가 2026-07-23 에 정확히 그 오경보로 판정식을 고쳤다 — 그 교훈을 승계해
 * **`found` 까지 0** 일 때만 본다. 두 곳이 다른 규칙을 쓰면 한쪽은 반드시 틀린다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 화면 렌더(문자열 배선만 본다). 라이브 판정은 어드민 매장 화면의 경고 박스 출현으로.
 * - **레인을 끄지 않는다** — 일시 장애와 영구 장애를 이 신호만으로는 못 가른다. 판단은 사람이 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { judgeLaneYield, judgeLanes, DEAD_AFTER_RUNS } from '@/features/marketing/api/lane-yield-health'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('완전 무수확 — 여러 번 돌고도 누적 저장이 0', () => {
  it('🔒 라이브의 실제 모양(hira 60회·0건·timeout)을 잡는다', () => {
    const v = judgeLaneYield('collect-hira', {
      found: 0, saved: 0, total_runs: 60, total_saved: 0,
      diag: { configured: true, error: 'API: 네트워크 오류: The operation was aborted due to timeout' },
    })
    expect(v, '이 상태를 못 잡으면 이 파일은 존재 이유가 없다').toBeTruthy()
    expect(v!.severity).toBe('dead')
    expect(v!.message, '오류 원문을 그대로 옮겨야 사람이 판단할 수 있다').toContain('timeout')
    expect(v!.message).toContain('60회')
  })

  it('🔒 갓 켠 레인은 안 울린다 — 첫 회차부터 빨간불이면 정상 상태를 사고로 오인한다', () => {
    expect(judgeLaneYield('x', { total_runs: DEAD_AFTER_RUNS - 1, total_saved: 0, found: 0 })).toBeNull()
  })

  it('누적이 있으면 완전 무수확이 아니다', () => {
    expect(judgeLaneYield('x', { total_runs: 100, total_saved: 5, found: 3 })).toBeNull()
  })
})

describe('🛡️ 오경보 방지 — 풀 포화를 고장으로 부르지 않는다', () => {
  it('🔒 발굴은 되는데 저장이 0 = **정상**(전부 중복). 절대 울리면 안 된다', () => {
    expect(judgeLaneYield('x', { found: 200, saved: 0, total_runs: 50, total_saved: 9999 })).toBeNull()
  })

  it('🔒 발굴 O + **오류도 함께 있는** 회차도 조용하다 — 한 페이지가 실패해도 수확이 있으면 고장이 아니다', () => {
    // ⚠️ 이 픽스처가 이 시험의 **핵심**이다. `diag.error` 가 없는 픽스처만 두면 `found === 0` 조건을
    //   통째로 지워도 초록불이 뜬다(첫 작성이 실제로 그랬다 — 주입 검증이 잡았다).
    //   "가드가 막는다고 주장하는 그 경우"가 픽스처에 실재해야 한다.
    expect(judgeLaneYield('x', {
      found: 200, saved: 0, total_runs: 50, total_saved: 9999,
      diag: { configured: true, error: 'HTTP 500 (page 3)' },
    }), 'found>0 인데 오류만 보고 울리면 풀 포화가 매번 고장으로 신고된다').toBeNull()
  })

  it('발굴까지 0 이고 오류가 있으면 경고(치명 아님)', () => {
    const v = judgeLaneYield('x', { found: 0, saved: 0, total_runs: 50, total_saved: 9999, diag: { error: 'HTTP 500' } })
    expect(v?.severity).toBe('warn')
  })

  it('발굴 0 이지만 오류가 없으면 조용하다 — 그냥 그 회차에 새 게 없었을 수 있다', () => {
    expect(judgeLaneYield('x', { found: 0, saved: 0, total_runs: 50, total_saved: 9999 })).toBeNull()
  })

  it('🔒 미설정(키 없음)은 이 판정의 대상이 아니다 — 고장이 아니라 "안 켰다"이고 다른 화면이 말한다', () => {
    expect(judgeLaneYield('x', { total_runs: 99, total_saved: 0, found: 0, diag: { configured: false } })).toBeNull()
  })

  it('스냅샷이 없으면(아직 한 번도 안 돎) 조용하다', () => {
    expect(judgeLaneYield('x', null)).toBeNull()
    expect(judgeLaneYield('x', undefined)).toBeNull()
  })
})

describe('여러 레인 — 건강한 것은 결과에 없다', () => {
  it('불건강한 것만 돌려준다', () => {
    const out = judgeLanes([
      { lane: 'a', stat: { total_runs: 60, total_saved: 0, found: 0 } },
      { lane: 'b', stat: { total_runs: 60, total_saved: 500, found: 12 } },
      { lane: 'c', stat: null },
    ])
    expect(out.map(v => v.lane)).toEqual(['a'])
  })
})

describe('배선 — 판정만 있고 안 보이면 없는 기능이다', () => {
  const ROUTES = SRC('src/features/marketing/api/store-prospects.routes.ts')
  const PAGE = SRC('src/pages/admin/AdminStoreProspectsPage.tsx')

  it('🔒 `/stats` 가 네 레인을 모두 판정해 실어 보낸다', () => {
    expect(ROUTES).toMatch(/laneHealth: judgeLanes\(\[/)
    for (const lane of ['collect-localdata', 'collect-neis', 'collect-hira', 'collect-store-kakao']) {
      expect(ROUTES, `${lane} 이 판정 대상에서 빠졌다`).toContain(`lane: '${lane}'`)
    }
  })

  it('🔒 **파트너 풀도 같은 판정기를 쓴다** — 죽은 레인은 그쪽에 더 많다(franchise·nara 실측)', () => {
    const PARTNER = SRC('src/features/marketing/api/partner-pool.routes.ts')
    expect(PARTNER).toMatch(/laneHealth: judgeLanes\(\[/)
    for (const lane of ['collect-franchise', 'collect-nara-contract', 'collect-commerce']) {
      expect(PARTNER, `${lane} 이 판정 대상에서 빠졌다`).toContain(`lane: '${lane}'`)
    }
  })

  it('🔒 화면이 그 값을 읽어 띄운다 — 응답에만 있고 화면에 없으면 아무도 못 본다', () => {
    expect(PAGE).toMatch(/setLaneHealth\(r\.data\.laneHealth \|\| \[\]\)/)
    expect(PAGE).toMatch(/laneHealth\.length > 0 &&/)
    expect(PAGE, '레인 이름이 보여야 어느 레인인지 안다').toMatch(/\{h\.lane\}/)
  })

  it('🔒 "끄는 건 사람이 결정한다"가 화면에 남아 있다 — 자동 비활성으로 오해하면 안 된다', () => {
    expect(PAGE).toMatch(/게이트를 끄는 것을 검토/)
  })
})
