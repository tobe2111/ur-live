import { describe, it, expect } from 'vitest'
import { planInfluencerEnrich, naverRoomFromRemaining, ytPhaseDeadline, YT_CLOCK_SHARE } from '@/features/marketing/api/influencer-enrich-lane'
import { subreqCapKey } from '@/features/marketing/api/collect-budget'
import { ddlChecksum } from '@/features/marketing/api/ads-schema-guard'
import { AD_PERF_DDL } from '@/features/marketing/api/influencer-performance'

/**
 * 📝 2026-07-28 인플루언서 풀 보강 전용 레인의 불변식 잠금.
 *
 *   실측 배경: 보강 4종이 수집과 **같은 인보케이션**에 있어 발굴이 서브리퀘스트를 다 쓰고 나면
 *   전부 0 으로 반환됐다(`naver_enrich.tried:0` · `bio_enriched:0` 고착). 풀 37,414명 중
 *   네이버 블로거 27,864명은 활동성이 **한 번도** 측정된 적이 없었다(표본 1,000행 전부 미측정).
 *
 *   여기서 고정하는 것:
 *     ① 배분은 예산을 넘지 않는다 — 블로거 1건 = fetch 2 라, naverMax×2 + bioMax 가 예산을 넘으면
 *        라운드 끝의 대상들이 매번 헛돌고 도장도 못 찍는다(백로그가 안 줄어드는 조용한 실패).
 *     ② 예산이 아주 작아도 음수/NaN 이 안 나온다 — 학습 상한이 바닥까지 내려간 상태에서도 안전.
 *     ③ 학습 상한 키는 수집 레인과 **다르다** — 같으면 건당 비용이 다른 두 레인이 서로의 관측을
 *        덮어써 어느 쪽도 자기 한도를 학습 못 한다(2026-07-28 공유 키 사고와 같은 클래스).
 *     ④ 성과 컬럼 DDL 체크섬은 목록이 바뀌면 반드시 바뀐다 — 안 그러면 새 컬럼이 영원히 안 생긴다
 *        (ALTER 5회를 체크섬 1회 조회로 바꾼 뒤의 필수 안전장치).
 */
describe('planInfluencerEnrich — 보강 라운드 대상 배분', () => {
  it('① 배분한 대상의 총 fetch 비용이 예산을 넘지 않는다', () => {
    for (const budget of [10, 20, 30, 45, 60, 100, 300, 400]) {
      const { bioMax, naverMax, ytMax } = planInfluencerEnrich(budget)
      const cost = bioMax * 1 + ytMax * 1 + naverMax * 2 // 링크인바이오 1 · YT 1 · 블로거 2(RSS+홈)
      expect(cost).toBeLessThanOrEqual(budget)
    }
  })

  it('② 예산이 바닥이어도 음수/NaN 없이 0 이상으로 수렴한다', () => {
    for (const budget of [0, 1, 4, 5, -10, Number.NaN]) {
      const p = planInfluencerEnrich(Number.isFinite(budget) ? budget : 0)
      for (const v of [p.bioMax, p.naverMax, p.ytMax]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('②-2 정상 예산에서는 세 레인 모두 실제로 배정된다(0 이면 그 백로그는 영원히 안 준다)', () => {
    const p = planInfluencerEnrich(45)
    expect(p.naverMax).toBeGreaterThan(3)
    expect(p.ytMax).toBeGreaterThan(3)   // 📈 YT 800개 표본의 94%가 성과 미측정 — 여기가 0 이면 그대로 굳는다
    expect(p.bioMax).toBeGreaterThan(0)
  })

  it('②-3 앞 레인이 안 쓴 예산은 블로거가 흡수한다(정적 배분보다 줄지 않는다)', () => {
    const { naverMax } = planInfluencerEnrich(45)
    // 실측 재현: bio 0 · yt 14 를 쓰고 31 이 남은 시점 → 정적 배분 10 에 묶이지 않는다.
    expect(naverRoomFromRemaining(31, naverMax)).toBeGreaterThan(naverMax)
    // 앞 레인이 예산을 다 썼으면 기존 동작으로 안전하게 되돌아간다(줄어들지 않음).
    for (const left of [0, 1, 2, 5, 45]) {
      expect(naverRoomFromRemaining(left, naverMax)).toBeGreaterThanOrEqual(naverMax)
    }
  })

  it('②-4 흡수분도 실제 잔여로 감당 가능하다 — 과배정이 예산을 넘지 않는다', () => {
    // 배정분(계획 0 가정)의 fetch 비용(건당 2)이 남은 예산을 넘으면 라운드 끝이 헛돌고 도장을 못 찍는다.
    for (const left of [0, 1, 2, 3, 7, 21, 31, 45, 200]) {
      expect(naverRoomFromRemaining(left, 0) * 2).toBeLessThanOrEqual(Math.max(0, left))
    }
  })

  it('②-5 잔여가 음수/NaN 이어도 0 이상으로 수렴한다', () => {
    for (const left of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const v = naverRoomFromRemaining(left, Number.NaN)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(30) // enrichNaverActivity 의 SELECT LIMIT 상한과 동일
    }
  })

  it('③ 학습 상한 키가 수집 레인과 분리돼 있다', () => {
    expect(subreqCapKey('influencer_enrich')).not.toBe(subreqCapKey('influencer'))
    expect(subreqCapKey('influencer_enrich')).toBe('ads_subreq_cap_influencer_enrich')
  })

  it('④ 성과 컬럼 DDL 목록이 바뀌면 체크섬도 바뀐다(컬럼 미생성 방지)', () => {
    expect(ddlChecksum(AD_PERF_DDL)).not.toBe(ddlChecksum([...AD_PERF_DDL, 'ALTER TABLE ad_influencer_leads ADD COLUMN x TEXT']))
    expect(AD_PERF_DDL).toContain('ALTER TABLE ad_influencer_leads ADD COLUMN last_post_at TEXT')
  })
})

/**
 * ⏱️ **벽시계 분배** — 예산은 나눴는데 시간은 아무도 안 나눴다 (2026-07-29 라이브 실측).
 *
 * 12:00 틱 마지막 라운드:
 * ```
 *   yt: 14 · naver: { selected: 13, tried: 0 } · spent 18/45 · elapsed 23.4s · deadline_hit: true
 * ```
 * YT 가 20초 창을 통째로 써서 블로거 단계는 **대상 13건을 고르고 첫 fetch 도 못 했다.**
 * 예산은 27이나 남아 있었다 — 막은 건 예산이 아니라 시간이다. 그 틱의 블로거 측정은 **0**,
 * 그런데 백로그 26,696건(네이버의 91%)이 전부 그 단계 뒤에 있다.
 *
 * ⚠️ 같은 사고가 파트너풀 레인에서 먼저 났고(`enrich-lane.ts` 2026-07-28 주석), 그 교훈이 이 레인엔
 *    반영되지 않았다. **레인을 건너 반복되는 실패**라 순수함수 + 배선 양쪽을 고정한다.
 */
describe('ytPhaseDeadline — 앞 레인이 창을 다 먹지 못하게', () => {
  it('기본 창(20s)에서 YT 는 일부만 받는다 — 나머지는 블로거 몫', () => {
    const t0 = 1_000_000
    const d = ytPhaseDeadline(t0, 20_000)
    expect(d).toBeGreaterThan(t0)
    expect(d).toBeLessThan(t0 + 20_000)          // 반드시 남긴다
    expect(20_000 - (d - t0)).toBeGreaterThanOrEqual(8_000) // 블로거가 쓸 만큼 남는다(건당 ~8s)
  })
  it('아주 짧은 창은 나누지 않는다 — 둘 다 굶는 것보다 하나라도 돌게', () => {
    expect(ytPhaseDeadline(0, 5_000)).toBe(5_000)
    expect(ytPhaseDeadline(0, 3_000)).toBe(3_000)
  })
  it('share 는 0.1~0.9 로 클램프 — 잘못된 값이 한쪽을 0으로 만들지 않는다', () => {
    expect(ytPhaseDeadline(0, 20_000, 5)).toBe(18_000)
    expect(ytPhaseDeadline(0, 20_000, -1)).toBe(2_000)
    expect(ytPhaseDeadline(0, 20_000, NaN)).toBe(Math.floor(20_000 * YT_CLOCK_SHARE))
  })
  it('이상값(음수·NaN 창)에 throw 하지 않는다', () => {
    expect(ytPhaseDeadline(0, -1)).toBe(0)
    expect(ytPhaseDeadline(0, NaN)).toBe(0)
  })
})

describe('🚧 배선 — 순수함수만 고치면 라이브는 그대로다', () => {
  it('YT 호출을 서브-데드라인으로 감싸고 finally 로 복원한다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/features/marketing/api/influencer-enrich-lane.ts', 'utf8')
    expect(src).toMatch(/budget\.deadline = ytPhaseDeadline\(started, deadlineMs\)/)
    // 복원이 없으면 블로거가 짧은 창을 물려받아 **증상이 더 나빠진다**(예외 경로 포함이라 finally 필수).
    expect(src).toMatch(/finally \{ budget\.deadline = fullDeadline \}/)
    // 블로거 호출이 YT 뒤에 온다는 전제 자체를 고정(순서가 바뀌면 이 분배는 의미가 없다).
    expect(src.indexOf('enrichYouTubePerformance(')).toBeLessThan(src.lastIndexOf('enrichNaverActivity('))
  })
})
