import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { planInfluencerEnrich, naverRoomFromRemaining, frontStageDeadline, starvedLastRound, NAVER_FLOOR_PCT_DEFAULT } from '@/features/marketing/api/influencer-enrich-lane'
import { subreqCapKey } from '@/features/marketing/api/collect-budget'
import { sliceClause } from '@/features/marketing/api/influencer-performance'
import { resolveEnrichFanout } from '../../worker-ads/enrich.routes'
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
 * ⏱️ 2026-07-29 — **블로거 레인 시간 바닥**. 라이브 실측(배포가 없던 12:00 회차):
 *   `yt 14 · naver { selected 13, tried 0 } · spent 18/45 · deadline_hit true · elapsed 23.4s`
 *   예산이 27 남았는데 **벽시계**가 먼저 끝나, 맨 뒤에 선 블로거 레인이 13명을 선택만 하고 전부 버렸다.
 *   같은 날 10:00 회차는 elapsed 16.0s 라 13명을 다 쟀다 — 유튜브 지연에 따라 **동전 던지기**였고,
 *   하필 미측정 백로그의 88%(26,694명)가 블로거 쪽이다.
 *   ⚠️ 예산 배분으로는 못 고친다(`naverRoomFromRemaining` 이 이미 남은 예산을 넘겨주는데도 0명이었다).
 */
describe('frontStageDeadline — 앞 레인이 창을 다 먹지 못하게', () => {
  const T0 = 1_000_000

  it('🔒 기본 40% 바닥 — 앞 레인은 20초 창의 12초까지만', () => {
    expect(frontStageDeadline(T0, 20_000, 40)).toBe(T0 + 12_000)
  })

  it('🔒 바닥이 커질수록 앞 레인 몫이 줄어든다(단조)', () => {
    const at = (pct: number) => frontStageDeadline(T0, 20_000, pct) - T0
    expect(at(10)).toBeGreaterThan(at(40))
    expect(at(40)).toBeGreaterThan(at(80))
  })

  it('🔒 항상 원래 마감보다 이르다 — 늦추면 바닥이 사라진다', () => {
    for (const pct of [10, 40, 80]) expect(frontStageDeadline(T0, 20_000, pct)).toBeLessThan(T0 + 20_000)
  })

  it('🔒 이상값도 창 안에 머문다(설정 오타가 레인을 죽이지 않게)', () => {
    for (const pct of [-100, 0, 5, 95, 500, Number.NaN]) {
      const d = frontStageDeadline(T0, 20_000, pct)
      expect(d).toBeGreaterThan(T0)          // 0 이면 앞 레인이 통째로 굶는다
      expect(d).toBeLessThan(T0 + 20_000)    // 창을 넘으면 바닥이 없어진다
    }
    // 창 자체가 이상해도 과거 시각을 만들지 않는다.
    expect(frontStageDeadline(T0, Number.NaN, 40)).toBe(T0)
    expect(frontStageDeadline(T0, -5_000, 40)).toBe(T0)
  })
})

/**
 * 🔄 **선두 교대의 폴백** — `depth % 2` 하나로는 발화 못 하는 회차가 있다.
 *
 *   #885 는 "체인이 depth 2+ 로 돈다"를 전제로 홀수 라운드에 블로거를 앞세운다. 그런데 배포(13:38) 이후
 *   **14:00 틱 실측이 `depth: 0`** 이었고 `naver { selected 12, tried 0 }` 은 그대로였다.
 *   체인이 한 라운드에서 끊기면 depth 는 영원히 0 이고 `0 % 2 === 1` 은 항상 거짓이라, **교대가 한 번도
 *   안 일어난다.** 전제가 깨지면 처방도 같이 죽는 형태다 — 그래서 깊이와 무관한 신호를 하나 더 둔다.
 */
describe('starvedLastRound — 깊이와 무관한 교대 신호', () => {
  it('🔒 고를 사람은 있었는데 한 명도 못 쟀으면 굶은 것 — 라이브에서 반복해 찍힌 값', () => {
    expect(starvedLastRound({ naver: { selected: 12, tried: 0 } })).toBe(true)
    expect(starvedLastRound({ naver: { selected: 13, tried: 0 } })).toBe(true)
  })

  it('🔒 큐가 빈 것(selected 0)은 굶은 게 아니다 — 할 일 없는 레인에 선두를 주지 않는다', () => {
    expect(starvedLastRound({ naver: { selected: 0, tried: 0 } })).toBe(false)
  })

  it('🔒 한 명이라도 쟀으면 정상 — 창을 다 썼어도 뒤집지 않는다', () => {
    expect(starvedLastRound({ naver: { selected: 13, tried: 1 } })).toBe(false)
    expect(starvedLastRound({ naver: { selected: 13, tried: 13 } })).toBe(false)
  })

  it('🔒 스냅샷이 없거나 깨졌으면 기존 순서 유지(첫 배포·유실에 안전)', () => {
    for (const v of [null, undefined, {}, { naver: {} }]) expect(starvedLastRound(v as never)).toBe(false)
  })
})

/**
 * 🔌 배선 잠금 — 순수함수만 테스트하면 "함수는 있는데 부르는 곳이 없는" 사고를 못 잡는다
 *   (같은 날 `isUnjudgedRound` 가 정확히 그랬다). 호출부를 소스로 확인한다.
 */
describe('배선 — 교대가 깊이와 굶주림 둘 다 본다', () => {
  const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-enrich-lane.ts'), 'utf8')

  /**
   * 🪦 **이 검사는 사실이 아닌 것을 지키고 있었다** (2026-08-03 라이브 실측으로 교체).
   *
   * 원래 문구는 *"두 신호를 OR 로 묶는다 — 어느 하나가 죽어도 교대가 산다"* 였고
   * `depth % 2 === 1 || starvedLastRound(prev)` 를 못 박았다. 그런데 **DO 알람으로 옮긴 뒤
   * `depth` 는 항상 0** 이다(`chain.rounds: 1, max_depth: 0` — 알람이 5분마다 라운드 하나씩 돌린다).
   * `0 % 2 === 1` 은 영원히 거짓이므로 **두 신호 중 하나는 이미 죽어 있었다.**
   * 즉 이 가드는 "보완 관계"를 지킨다고 적어 두고, 실제로는 **반쪽짜리 식을 고정**하고 있었다.
   *
   * ⇒ 깊이 대신 **직전 선두**(`led`)로 교대한다 — 알람이든 체인이든 스냅샷은 매 라운드 쓰이므로
   *   두 경로 모두에서 성립한다. 자기교정(굶주림)은 그대로 남아 교대를 이긴다.
   *
   * ⚠️ `depth % 2` 로 되돌리지 말 것 — 알람 경로에서 조용히 죽는다. 근거는 `pickNaverFirst` docblock.
   */
  it('🔒 교대는 깊이가 아니라 직전 선두를 본다 — 알람엔 depth 가 없다', () => {
    expect(src).toMatch(/const naverFirst = pickNaverFirst\(prev\)/)
    expect(src, 'depth 기반 교대는 알람에서 영원히 거짓이다').not.toMatch(/naverFirst = depth % 2 === 1/)
    // 교대가 성립하려면 이번 선두가 기록돼야 한다(다음 회차가 읽는다).
    expect(src).toMatch(/led: naverFirst \? 'naver' : 'front'/)
  })

  it('🔒 직전 스냅샷을 레인 시작 전에 읽는다 — 끝에서만 읽으면 선두 결정에 못 쓴다', () => {
    expect(src.indexOf('const prev = await readSnapshot(DB)')).toBeLessThan(src.indexOf('const naverFirst ='))
  })
})

/**
 * 📐 블로거 시간 바닥 비율 — 2026-07-29 16:00 A/B 실측이 만든 값.
 *
 * 인접한 두 깨끗한 회차(배포 겹침 없음)가 앞 단계 몫의 대가를 그대로 보여줬다:
 * ```
 *   15:00 블로거 선두 : yt  0 · naver{선택 22, 측정 22} · spent 44/45 · elapsed  8.3s
 *   16:00 유튜브 선두 : yt 14 · naver{선택 18, 측정  6} · spent 19/45 · elapsed 22.0s
 * ```
 * 유튜브 14채널의 대가로 **블로거 12명이 선택만 되고 버려졌다**. 백로그(블로거 27,324 · 증가 중)와
 * 측정 값어치(블로거는 이메일 수율 50~59%, 유튜브는 대개 이미 있는 값 갱신)가 이 배분을 뒤집는다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 라이브 적용 여부. `ADS_ENRICH_NAVER_FLOOR_PCT` 가 대시보드에
 *    설정돼 있으면 env 가 이깁니다 — 적용은 다음 회차의 `naver.tried` 로 확인할 것.
 */
describe('블로거 시간 바닥 기본값', () => {
  it('기본이 70% — 앞 단계는 창의 30%까지만', () => {
    expect(NAVER_FLOOR_PCT_DEFAULT).toBe(70)
    const t0 = 1_000_000
    expect(frontStageDeadline(t0, 20_000, NAVER_FLOOR_PCT_DEFAULT)).toBe(t0 + 6_000)
  })
  it('🔒 16:00 회귀 재현: 40% 였다면 앞 단계가 창의 60%(12s)를 먹는다', () => {
    const t0 = 1_000_000
    expect(frontStageDeadline(t0, 20_000, 40)).toBe(t0 + 12_000)   // 실제로 그래서 블로거가 8s 만 받았다
    // 새 기본값은 그 절반 — 블로거 몫이 8s → 14s 로 늘어난다.
    expect(frontStageDeadline(t0, 20_000, NAVER_FLOOR_PCT_DEFAULT) - t0).toBeLessThan(12_000)
  })
  it('바닥은 여전히 상한 80%에 걸린다 — 앞 단계를 통째로 굶기지 않는다', () => {
    const t0 = 1_000_000
    expect(frontStageDeadline(t0, 20_000, 99) - t0).toBe(4_000)   // 20% 는 남는다
  })
  it('레인이 상수를 실제로 쓴다 — 리터럴 40 이 남아 있으면 기본값 변경이 무의미하다', () => {
    const src = readFileSync('src/features/marketing/api/influencer-enrich-lane.ts', 'utf8')
    expect(src).toMatch(/ADS_ENRICH_NAVER_FLOOR_PCT[\s\S]{0,120}?NAVER_FLOOR_PCT_DEFAULT/)
    expect(src).not.toMatch(/ADS_ENRICH_NAVER_FLOOR_PCT[^\n]*\|\|\s*40\b/)
  })
})

/**
 * 🍰 **슬라이스 팬아웃** (2026-08-01 대표 "무료 선에서 가장 이상적으로, 유료 전환도 자연스럽게").
 *
 *   ## 왜 바꿨나 (실측)
 *   릴레이는 라운드 N+1이 N을 기다린다 → 12라운드를 계획하고도 **도달 depth 2(3라운드)** 에서 끝났다.
 *   그런데 같은 날 하트비트로 확인한 사실: `kick` 의 레인 디스패치는 **이미 병렬**이었다
 *   (정각 3틱 모두 [소요합계 > 벽시계 스팬] — 24.4s/6.0s · 27.5s/8.3s · 9.4s/5.8s).
 *   즉 무료 플랜에서도 자식은 겹쳐 돈다 ⇒ 라운드도 팬아웃할 수 있다.
 *
 *   ## 겹치면 안 되는 것
 *   이 큐의 SELECT 는 선점이 아니라 정렬+LIMIT 이라, 조각 없이 병렬로 돌리면 자식들이 **같은 사람을
 *   중복 측정**하고 예산만 태운다. `id % k = i` 가 그걸 막는 유일한 장치다.
 */
describe('sliceClause — 자식들이 서로 다른 행을 집는다', () => {
  it('🔒 k<=1 이면 조건이 없다 — 오늘과 완전히 같은 동작(롤백 = 값 하나)', () => {
    for (const s of [null, undefined, { i: 0, k: 1 }, { i: 3, k: 0 }]) {
      expect(sliceClause(s as never)).toEqual({ sql: '', binds: [] })
    }
  })

  it('🔒 k>1 이면 id % k = i — 바인딩 순서가 SQL 과 일치한다', () => {
    expect(sliceClause({ i: 2, k: 4 })).toEqual({ sql: ' AND id % ? = ?', binds: [4, 2] })
  })

  it('🔒 조각들이 전체를 빠짐없이·겹침없이 덮는다 — 이게 깨지면 누락이거나 중복이다', () => {
    const K = 4
    const owners = Array.from({ length: 100 }, (_, id) => {
      const hit = Array.from({ length: K }, (_, i) => sliceClause({ i, k: K }))
        .map((c, i) => (id % (c.binds[0] as number) === c.binds[1] ? i : -1)).filter(i => i >= 0)
      return hit
    })
    expect(owners.every(h => h.length === 1), '각 id 는 정확히 한 자식의 몫이어야 한다').toBe(true)
  })

  it('🐛 음수·초과 인덱스도 유효 범위로 접힌다(설정 오타가 조각을 통째로 비우지 않게)', () => {
    expect(sliceClause({ i: -1, k: 4 }).binds).toEqual([4, 3])
    expect(sliceClause({ i: 9, k: 4 }).binds).toEqual([4, 1])
  })
})

describe('resolveEnrichFanout — 무료에서 돌리는 노브', () => {
  it('🔒 기본 4 — 네이버 동시 연결 3K=12. 차단이 상한이지 처리량이 아니다', () => {
    expect(resolveEnrichFanout(undefined)).toBe(4)
    expect(resolveEnrichFanout('')).toBe(4)
  })

  it('🔒 상한 12 — 부모가 자식 수만큼 fetch 를 쓰므로, 여기서 다 쓰면 뒤에 선 레인이 굶는다', () => {
    expect(resolveEnrichFanout('99')).toBe(12)
    expect(resolveEnrichFanout('0')).toBe(4)   // 0/비숫자 → 기본값
    expect(resolveEnrichFanout('1')).toBe(1)   // 1 = 릴레이(롤백 경로)
  })
})

/**
 * 🔌 배선 잠금 — 순수함수만 테스트하면 "함수는 있는데 부르는 곳이 없는" 사고를 못 잡는다
 *   (같은 세션에 `isUnjudgedRound` 가 정확히 그랬다).
 */
describe('배선 — 드라이버가 조각을 실제로 넘긴다', () => {
  const routes = readFileSync(join(process.cwd(), 'src/worker-ads/enrich.routes.ts'), 'utf8')
  const lane = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-enrich-lane.ts'), 'utf8')

  it('🔒 최초 호출이면 자식 K개를 띄운다', () => {
    expect(routes).toMatch(/slice=\$\{i\}&k=\$\{K\}/)
    expect(routes).toMatch(/const K = resolveEnrichFanout\(/)
  })

  it('🔒 조각이 레인까지 전달된다 — 여기가 끊기면 자식들이 같은 사람을 중복 측정한다', () => {
    // ⚠️ 인자 안에 괄호가 있어(`Number.isFinite(d)`) `[^)]*` 로는 못 넘는다 — 실제로 여기서 한 번 틀렸다.
    expect(routes).toMatch(/runInfluencerEnrich\(c\.env,[\s\S]*?rounds, slice\)/)
    // 🔧 2026-08-04: 블로거 방 계산이 `naverRoomWithYtReserve`(YT 예약분 반영)로 바뀌었다.
    //   이 테스트가 지키는 건 방 계산식이 아니라 **`slice` 가 끝까지 전달되는가** 이므로 방 함수는
    //   이름을 느슨하게 두고 마지막 인자만 고정한다(방 정책은 `ads-enrich-yt-priority` 가 본다).
    // 2026-09-03: 재측정 주기 필터가 env 를 읽어야 해서 인자가 하나 늘었다. 불변식(=slice 가 레인까지
    //   전달된다)은 그대로고, env 는 있어도 되고 없어도 되게 둔다 — 그래야 다음 인자 추가에 또 안 깨진다.
    expect(lane).toMatch(/enrichNaverActivity\(DB, budget, naverRoom\w*\([^)]*\), slice(, env)?\)/)
  })

  /**
   * 🐛 실제로 밟을 뻔한 자리: 릴레이 URL 을 `?depth=` 로 무조건 이으면, 조각 파라미터가 이미 있는
   *   path 에서 물음표가 두 개가 된다 → 그 자식은 조각 없이 돌아 **중복 측정**한다(조용히).
   */
  it('🔒 릴레이 URL 이 기존 쿼리스트링을 깨지 않는다', () => {
    expect(routes).toMatch(/path\.includes\('\?'\) \? '&' : '\?'/)
  })
})

/**
 * 🔘 **수동 버튼도 팬아웃을 탄다** (2026-08-02).
 *
 *   그전엔 버튼이 단발 라운드(`/__ads/enrich-influencer`)를 불러서, 사람이 눌러도 **cron 이 하는 일의
 *   일부**만 돌았다. 실측(08-02 01:06 수동 실행)이 그 자리를 정확히 보여줬다:
 *     `naver measured 18 · spent 44/45 · elapsed 6.9s · deadline_hit false`
 *   한 라운드는 **7초에 예산으로 끝난다** — 시간이 아니라 예산이 상한이다. 남는 건 시간뿐이고
 *   그걸 쓰는 방법이 팬아웃이다(자식마다 자기 45 예산을 새로 받는다).
 *
 *   ⚠️ 이 측정이 앞선 판단 하나를 갱신한다: 같은 레인이 07-29 엔 `deadline_hit true · 20.3s` 였다.
 *   그때의 처방(시간 바닥·선두 교대)은 그 조건에서 옳았지만, **지금 묶는 것은 예산**이다.
 *   ⇒ 다음에 이 레인을 손볼 땐 `deadline_hit` 을 먼저 보고 어느 쪽이 상한인지 확정할 것.
 */
/**
 * 🩸 **수동 경로는 자식을 `await` 해야 한다** — 안 그러면 버튼이 **0건**을 처리한다(08-02 라이브 실측).
 *
 *   드라이버를 그냥 부르면 `{fanout:4}` 를 즉시 돌려주는데, 그 순간 어드민 요청이 끝나면서
 *   ur-ads 의 `waitUntil` 자식이 통째로 취소된다 — **서비스 바인딩 피호출자는 호출자보다 오래 못 산다**
 *   (`dispatchRoundChain` docblock 이 이미 적어 둔 규칙인데, #930 에서 내가 어겼다).
 *   실측: 킥 후 30초 뒤 `nb_unmeasured` 변화 **0**. 직전 단발 경로는 한 번에 22 감소.
 *
 *   ⚠️ **cron 은 안 죽는다** — 부모 scheduled 가 다른 레인을 kick 하느라 살아 있기 때문이다.
 *     같은 코드가 호출자에 따라 다르게 죽으므로, cron 에서 확인했다고 버튼도 된다고 볼 수 없다.
 */
describe('수동 보강 버튼 — 드라이버(팬아웃) 경로', () => {
  const ops = readFileSync(join(process.cwd(), 'src/features/marketing/api/admin-ads-pool-ops.routes.ts'), 'utf8')
  const routes = readFileSync(join(process.cwd(), 'src/worker-ads/enrich.routes.ts'), 'utf8')

  it('🔒 기본 경로가 드라이버다 — 단발을 부르면 버튼이 1/K 만 돈다', () => {
    expect(ops).toMatch(/'\/__ads\/enrich-influencer-driver\?sync=1'/)
  })

  it('🔒 단발 경로는 ?single=1 로만 — 디버깅용으로 남기되 기본이 되면 안 된다', () => {
    expect(ops).toMatch(/const single = c\.req\.query\('single'\) === '1'/)
    expect(ops).toMatch(/single \? `\/__ads\/enrich-influencer\?depth=\$\{depth\}` : '\/__ads\/enrich-influencer-driver\?sync=1'/)
  })

  it('🔒 팬아웃 개수를 응답에 실어 준다 — 그때는 stats 가 없어서 화면이 할 말이 없어진다', () => {
    expect(ops).toMatch(/fanout: j\.fanout/)
  })

  it('🩸 sync 면 자식을 await 한다 — waitUntil 로만 띄우면 응답 직후 전부 취소된다', () => {
    expect(routes).toMatch(/if \(syncFanout\) \{[\s\S]{0,200}await Promise\.all\(kids/)
  })

  it('🔒 sync 자식에게도 sync 를 물려준다 — 어차피 취소될 릴레이를 낳지 않게', () => {
    expect(routes).toMatch(/\$\{syncFanout \? '&sync=1' : ''\}/)
    expect(routes).toMatch(/if \(!sync && !error && depth \+ 1 < rounds/)
  })

  it('🔒 cron 경로(sync 없음)는 그대로 waitUntil — 거긴 부모가 살아 있다', () => {
    expect(routes).toMatch(/for \(const p of kids\) c\.executionCtx!\.waitUntil\(/)
  })

  /**
   * 🧱 **무료 플랜 CPU 벽** — 배포 후 실측(2026-08-02): 수동 경로는 502·처리 0.
   *   `sync` 든 `single` 이든 같다. cron 은 같은 라운드를 8.4초에 끝낸다.
   *   ⇒ 크로스워커 바인딩은 피호출자 CPU 를 **호출자 몫**에서 쓴다. 이 버튼은 구조적으로 못 돈다.
   *   실패를 날 502 로 흘리면 다음 세션이 원인 불명으로 또 판다 — 사실과 대안을 말해야 한다.
   *   ⚠️ 못 막는 것: 벽 자체는 코드로 못 본다. 유료 전환하면 `sync` 가 그대로 살아난다(구조 유지).
   */
  it('🧱 ur-ads 가 JSON 이 아닌 응답(CPU 로 끊김)이면 안내로 바꾼다 — 날 502 금지', () => {
    expect(ops).toMatch(/blocked: 'cpu-budget'/)
    expect(ops).toMatch(/if \(!j\) return planWall\(/)
    expect(ops).toMatch(/매시간 cron 이 계속 돌고 있습니다/)
  })
})
