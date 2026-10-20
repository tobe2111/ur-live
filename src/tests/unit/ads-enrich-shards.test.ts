/**
 * 🍰 **측정 샤딩** — 갈래를 늘려 처리량을 올리되, 같은 사람을 두 번 재거나 YT 쿼터를 곱하지 않는다.
 *
 * ## 이 테스트가 지키는 사고 (2026-08-09 실측)
 * 측정이 하루 ~4,200 에 묶여 유입(6,000)을 못 따라가 백로그가 매일 +1,800 씩 늘고 있었다.
 * 한 회차는 이미 꽉 찼고(`spent 44/45`, 20행) 인보케이션당 서브리퀘스트가 천장이라,
 * 늘리는 길은 **갈래를 늘리는 것**뿐이다.
 *
 * 그런데 갈래를 늘릴 때 조용히 망가지는 방식이 둘 있고 **둘 다 에러를 안 낸다**:
 *   ① 레인 수와 `slice.k` 가 어긋남 → 두 레인이 같은 행을 집거나(중복) 일부가 영영 안 잡힘(누락)
 *   ② YT 가 `slice` 를 안 받는데 샤드마다 도는 것 → **YT 일 쿼터가 샤드 수만큼** 탄다(이미 초과 상태)
 *
 * ## 못 막는 것 (과신 금지)
 * - 실제 D1 쿼리가 슬라이스를 태우는지는 유닛이 못 본다(배선 존재만 소스로 확인).
 *   라이브 판정은 `ads_naver_crawl_block.blocked` 와 일별 측정 처리량으로 한다.
 * - 샤드를 늘렸을 때 **네이버가 차단하는지**는 여기서 못 잰다. 그건 값을 올리기 전 관측 조건이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALARM_LANES, ALARM_LANE_NAMES, ENRICH_SHARDS, lookupAlarmLane } from '@/worker-ads/lane-alarm-runners'
import { sliceClause } from '@/features/marketing/api/enrich-slice'

const enrichLanes = () => ALARM_LANE_NAMES.filter(n => n.startsWith('enrich-influencer'))

describe('측정 샤드 — 레인 수와 슬라이스가 어긋나지 않는다', () => {
  it('샤드 수만큼 레인이 등록된다', () => {
    expect(enrichLanes()).toHaveLength(ENRICH_SHARDS)
  })

  it('🔑 샤드 0 의 이름은 `enrich-influencer` 그대로 — 바꾸면 DO 인스턴스가 끊긴다', () => {
    expect(ALARM_LANE_NAMES).toContain('enrich-influencer')
    expect(lookupAlarmLane('enrich-influencer')).not.toBeNull()
  })

  it('🔴 슬라이스가 전 범위를 빠짐없이·겹침없이 덮는다(중복 측정 / 영구 누락 방지)', () => {
    const k = ENRICH_SHARDS
    if (k <= 1) { expect(sliceClause({ i: 0, k }).sql).toBe(''); return }
    // id 0..999 를 각 샤드에 배정 — 정확히 한 번씩 나와야 한다.
    const seen = new Map<number, number>()
    for (let i = 0; i < k; i++) {
      const { binds } = sliceClause({ i, k })
      expect(binds).toEqual([k, i])
      for (let id = 0; id < 1000; id++) if (id % k === i) seen.set(id, (seen.get(id) ?? 0) + 1)
    }
    expect(seen.size, '누락된 id 가 있다').toBe(1000)
    expect([...seen.values()].every(v => v === 1), '두 샤드가 같은 id 를 집는다').toBe(true)
  })

  it('✅ 롤백 경로 — 샤드 1 이면 조건이 안 붙어 오늘 이전과 완전히 같다', () => {
    expect(sliceClause({ i: 0, k: 1 }).sql).toBe('')
    expect(sliceClause(null).sql).toBe('')
  })

  /**
   * ⚠️ **위 검사들만으로는 부족하다 — 주입 실험이 증명했다.** `sliceClause` 는 순수 함수라
   * 아무리 검증해도 *레인이 그걸 실제로 넘기는지*는 안 본다. 러너에서 slice 인자를 `null` 로
   * 바꿔도 위 검사는 전부 **초록**이었다. 그러면 두 샤드가 같은 앞머리를 집어
   * **같은 사람을 두 번 재고 예산만 태운다**(늘린 만큼 그대로 손해).
   */
  it('🔴 러너가 slice 를 실제로 넘긴다 — 순수함수 검증만으로는 이걸 못 잡는다', () => {
    const src = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(src, 'slice 인자가 없으면 샤드가 전부 같은 행을 집는다')
      .toMatch(/runInfluencerEnrich\([^)]*k > 1 \? \{ i, k \} : null/)
  })
})

describe('YT 쿼터 — 샤드를 늘려도 유튜브 호출은 안 곱해진다', () => {
  const runnerSrc = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
  const laneSrc = readFileSync('src/features/marketing/api/influencer-enrich-lane.ts', 'utf8')
  /** 주석 제거 — 주석에만 남은 이름이 배선으로 오인되는 걸 막는다(이 레포가 여러 번 밟은 함정). */
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('🔴 샤드 1+ 는 naverOnly 로 돈다 — 안 그러면 YT 쿼터가 샤드 수만큼 탄다', () => {
    expect(code(runnerSrc)).toMatch(/naverOnly:\s*i\s*>\s*0/)
  })

  it('🔴 naverOnly 가 앞 레인(bio+YT)을 실제로 건너뛴다(플래그만 있고 안 쓰면 무의미)', () => {
    const c = code(laneSrc)
    expect(c).toMatch(/if \(opts\?\.naverOnly\) \{[\s\S]{0,120}runNaver\(/)
    // 그 분기 안에서 runFront 를 부르면 건너뛰는 게 아니다.
    // ⚠️ 2026-08-12: 길이 상한(`{0,200}`)을 뒀다가 **가드가 헛돌았다** — 여력 자동배치 폴백이 붙어
    //   분기가 200자를 넘자 매치가 실패해 `branch = ''` 이 되고, 결함을 심어도 초록이 떴다
    //   (`check-guard-mutations` 가 잡았다). 상한을 없애고 **분기 끝까지** 본다.
    const branch = c.match(/if \(opts\?\.naverOnly\) \{([\s\S]*?)\n  \} else if/)?.[1]
    expect(branch, '분기를 못 찾음 — 이 검사가 통째로 무의미해진다(리네임됐다면 여기도 갱신할 것)').toBeTruthy()
    expect(branch, 'naverOnly 인데 앞 레인을 돈다').not.toMatch(/runFront\(/)
  })

  it('샤드 0 은 종전대로 앞 레인을 맡는다 — YT 가 통째로 멈추면 안 된다', async () => {
    expect(lookupAlarmLane('enrich-influencer')).not.toBeNull()
    // 샤드 0 의 naverOnly 는 거짓이어야 한다(i > 0 규칙이 그걸 보장 — 위 검사와 짝).
    expect(ENRICH_SHARDS).toBeGreaterThanOrEqual(1)
  })
})

/**
 * 🔌 **킬스위치는 러너 안에 산다** (2026-08-09 발견·수리 — "이사 중 유실" 클래스).
 *
 *   `ADS_INFLUENCER_ENRICH_DISABLED` 게이트가 **cron 폴백 호출부에만** 있었다. 알람 이관(2026-08-02)
 *   후 라이브는 알람 러너가 모는데 러너엔 게이트가 없어 — **스위치를 켜도 아무 일도 안 일어나는
 *   죽은 손잡이**였다. 2차 이관 규약("게이트는 러너 안", §12)이 이 레인만 빠져 있던 것.
 *   행동 검사인 이유: 게이트가 없으면 run() 이 enrich 레인을 import 해 env.DB 접근으로 throw 한다 —
 *   소스 정규식과 달리 "게이트가 실제로 먼저 돈다"까지 확인된다.
 */
describe('킬스위치 — 알람 러너 안에서도 산다', () => {
  it('🔌 ADS_INFLUENCER_ENRICH_DISABLED=true 면 모든 샤드가 skipped 로 즉시 반환한다', async () => {
    for (const n of enrichLanes()) {
      const lane = lookupAlarmLane(n)
      expect(lane, n).not.toBeNull()
      const out = await lane!.run({ ADS_INFLUENCER_ENRICH_DISABLED: 'true' } as never)
      expect(out, `${n} 이 킬스위치를 무시한다`).toEqual({ skipped: 'disabled' })
    }
  })
})
