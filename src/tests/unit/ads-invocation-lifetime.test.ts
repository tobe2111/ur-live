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
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { capAfterAbandonedRun, nextSubreqCap, ENRICH_DEADLINE_MS_DEFAULT, resolveEnrichDeadlineMs,
  budgetedTimeoutMs, FETCH_TIMEOUT_FLOOR_MS, canStartBudgetedItem } from '@/features/marketing/api/collect-budget'
import { frontStageDeadline, NAVER_FLOOR_PCT_DEFAULT } from '@/features/marketing/api/influencer-enrich-lane'
import { interleavePicks } from '@/features/marketing/api/influencer-keyword-rotation'
import { isSelfBlogLink, cleanSelfLinks } from '@/features/marketing/api/influencer-self-link'

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
 * ⏱️ **집었으면 마감 안에 끝낼 수 있어야 한다** (2026-08-02 라이브 실측).
 *
 * `FETCH_TIMEOUT_FLOOR_MS` 주석은 *"호출부의 마감 가드가 이미 '집을지 말지'를 정한다"* 를 **전제**로
 * 바닥값을 준다. 그런데 네이버 보강 워커 루프는 마감을 *이미 지났을 때만* 멈춰서 그 전제가 거짓이었다.
 * 잔여 50ms 에 집은 항목이 바닥값 1.5s 를 받아 마감을 넘겨 달리다 실패했다.
 *
 * 실측(08-02 03:00 회차): `tried 9 / measured 6 / failed 3` — **실패 3 = 동시성 3**(워커마다 마지막 1건).
 * 그 리드는 데이터 없이 `perf_checked_at` 도장을 받아 22,000 깊이 큐 뒤로 밀리고 `nb_unmeasured`
 * 에서도 빠졌다 — **측정된 적 없는데 미측정으로 세어지지도 않는다.**
 */
describe('⏱️ 마감 직전에 집지 않는다 — 확정 실패 + 가짜 도장 차단', () => {
  const D = 1_000_000   // 임의 마감 시각

  it('바닥값을 줄 수 있을 때만 집는다', () => {
    expect(canStartBudgetedItem(D, D - FETCH_TIMEOUT_FLOOR_MS)).toBe(true)      // 딱 바닥
    expect(canStartBudgetedItem(D, D - FETCH_TIMEOUT_FLOOR_MS - 1)).toBe(true)  // 여유
    expect(canStartBudgetedItem(D, D - FETCH_TIMEOUT_FLOOR_MS + 1)).toBe(false) // 부족
    expect(canStartBudgetedItem(D, D)).toBe(false)                              // 마감 도달
    expect(canStartBudgetedItem(D, D + 5_000)).toBe(false)                      // 이미 지남
  })

  it('마감이 없으면(무제한) 항상 집는다 — fail-soft', () => {
    expect(canStartBudgetedItem(undefined, Date.now())).toBe(true)
  })

  /**
   * 🔒 **이게 이 describe 의 핵심 불변식이다.** 위 둘은 상수 비교라 통과하기 쉽지만, 이건 두 함수의
   * 관계를 고정한다 — "집기로 했으면, 그 항목에 주는 타임아웃이 마감을 넘지 않는다."
   * 이게 깨지면 바닥값이 다시 마감을 넘어 달리고 `failed` 가 오염된다.
   */
  it('🔒 집기로 한 순간에는 건당 타임아웃이 절대 마감을 넘지 않는다', () => {
    for (const remaining of [1_500, 1_501, 2_000, 5_000, 7_999, 8_000, 20_000]) {
      const now = D - remaining
      expect(canStartBudgetedItem(D, now), `remaining=${remaining}`).toBe(true)
      expect(budgetedTimeoutMs(D, 8_000, now), `remaining=${remaining}`).toBeLessThanOrEqual(remaining)
    }
  })

  it('🚧 배선 — 네이버 워커 루프가 실제로 이 가드를 쓴다', () => {
    const perf = read('src/features/marketing/api/influencer-performance.ts')
    const worker = /const worker = async \(\): Promise<void> => \{[\s\S]*?\n  \}/.exec(perf)?.[0] || ''
    expect(worker, '워커 루프를 못 찾았다 — 리네임됐다면 이 테스트도 갱신할 것').toBeTruthy()
    expect(worker).toMatch(/canStartBudgetedItem\(budget\.deadline\)/)
    // 🚫 회귀 형태: 마감을 '이미 지났을 때만' 멈추는 옛 판으로 되돌아가면 같은 사고가 난다.
    expect(worker).not.toMatch(/budget\.deadline && Date\.now\(\) >= budget\.deadline/)
  })

  it('🚧 안 집은 행은 셀 수 있어야 한다 — 안 그러면 "마감에 걸린 정도"가 안 보인다', () => {
    const perf = read('src/features/marketing/api/influencer-performance.ts')
    expect(perf).toMatch(/window_skipped/)
  })
})

/**
 * 🪦 **말없이 죽은 회차도 상한을 내린다.**
 *
 *   자기교정 루프가 `hitLimit`(잡히는 예외)에만 반응하면, 인보케이션째 사라지는 실패에서는
 *   상한이 **오히려 올라간다**(회복 +2). 그러면 다음 회차도 같은 자리에서 죽는다 — 닫힌 고리다.
 *   실측 11:00: `spent 40/40 · learned_cap 44 · limit_hit false` 인데 마감 기록이 없었다.
 */
describe('capAfterAbandonedRun — 유기된 회차의 하향(가산)', () => {
  it('직전 회차가 유기됐으면 상한을 내린다 — **가산** −4', () => {
    expect(capAfterAbandonedRun(44, 300, 60)).toBe(40)
  })

  it('바닥(SUBREQ_CAP_MIN) 아래로는 안 내려간다 — 수확 0 이 되면 학습 자체가 무의미', () => {
    expect(capAfterAbandonedRun(26, 300, 60)).toBe(25)
    expect(capAfterAbandonedRun(5, 300, 60)).toBe(25)
  })

  it('학습값이 없으면(0) 천장 기준으로 내린다 — 무근거로 천장을 그대로 쓰지 않는다', () => {
    expect(capAfterAbandonedRun(0, 300, 60)).toBe(56)
  })

  it('천장을 넘게 드리프트한 학습값도 천장 기준으로 깎는다', () => {
    expect(capAfterAbandonedRun(172, 300, 60)).toBe(56)
  })

  it('env 예산이 천장보다 작으면 그쪽이 기준이다', () => {
    expect(capAfterAbandonedRun(100, 40, 60)).toBe(36)
  })

  /**
   * 🩹 **2026-07-29 실측이 만든 검사** — 하향이 승수(×0.8)일 때 라이브에서 벌어진 일:
   *   | 시각 | learned_cap | limit_hit |
   *   |---|---|---|
   *   | 09:00 | 44 | false |
   *   | 12:00 | 36 | false |
   *   | 13:00 | 32 | false |
   *   | 14:00 | **27** | false |
   *   한도를 한 번도 안 봤는데 5시간에 **−39%**. 원인: lease 반납은 D1 쓰기이고 `.catch(() => null)` 이라
   *   **예산이 바닥난 회차에선 조용히 실패**한다 — 하필 상한에 닿았을 때 항상 그렇다. 그래서 '유기' 오탐이
   *   상시가 됐고, 거기에 −20% 를 곱했다. 회복은 +2 라 절대 못 따라잡는다(44 에서 −8.8 vs +2).
   *   ⇒ 불확실한 신호에는 **가산 하향**. 조건이 지속돼도 자유낙하가 아니라 회차당 순 −2 다.
   */
  it('🔒 오탐이 상시여도 자유낙하하지 않는다 — 회복(+2)과 같은 축의 하향', () => {
    // 하향 −4 와 회복 +2 가 매 회차 함께 걸리면 순 −2. 승수였다면 같은 5회차에 44 → 27 이었다.
    let cap = 44
    for (let i = 0; i < 5; i++) cap = Math.min(60, capAfterAbandonedRun(cap, 300, 60) + 2)
    expect(cap).toBe(34)          // 44 − 2×5 = 34 (선형)
    expect(cap).toBeGreaterThan(27) // 승수 시절의 5회차 실측값보다 확실히 높다
  })

  it('🔒 확실한 신호(한도 충돌)의 하향은 여전히 승수다 — 두 신호를 같은 축으로 뭉개지 않는다', () => {
    expect(nextSubreqCap(45, true, 44, 300, 60)).toBe(36) // floor(45 * 0.8)
  })
})

/**
 * 🔒 유기 판정은 **CAS 를 이겼을 때만** 유효하다.
 *   졌다면(=다른 실행이 lease 보유) 그 값은 살아 있는 실행의 것이지 시체가 아니다.
 *   이 구분이 없으면 동시 실행이 서로를 "죽은 것"으로 신고해 상한이 계속 깎인다.
 */
describe('수집 엔진 — 유기 lease 판정의 배선', () => {
  const src = read('src/features/marketing/api/influencer-auto-collect.ts')
  const lease = read('src/features/marketing/api/collect-lease.ts')

  it('CAS 승리와 직전 값(>0)을 함께 본다 — 졌으면 그 lease 는 살아 있는 실행의 것이다', () => {
    expect(lease).toMatch(/abandoned:\s*acquired\s*&&\s*prior\s*>\s*0/)
  })

  it('직전 lease 읽기를 seed 와 같은 batch 로 묶는다 — 관측이 예산을 더 먹지 않게', () => {
    expect(lease).toMatch(/DB\.batch<\{ value: string \}>\(\[[\s\S]{0,400}SELECT value FROM platform_settings/)
  })

  it('유기 판정이 이번 회차의 예산에 즉시 반영된다(다음 회차가 아니라)', () => {
    // 죽은 회차는 상한을 못 낮춘다 → 낮추는 일은 살아남은 쪽이 해야 한다.
    expect(src).toMatch(/abandonedPrev\s*\?\s*capAfterAbandonedRun\(storedCap/)
  })
})

/**
 * 💸 **재조우 보강 스킵** — 버려질 fetch 를 쏘지 않는다.
 *
 *   저장은 빈 칸만 COALESCE 백필한다 → 이미 연락처가 있는 리드를 보강하면 결과가 통째로 버려진다.
 *   이 레인의 병목이 정확히 그 fetch 예산이라(실측 `spent 40/40`), 풀이 커질수록(38,813) 낭비가 커진다.
 *
 *   ⚠️ 못 막는 것: 실제로 몇 건이 스킵되는지는 라이브 값이다. 여기서는 **배선과 회계**만 고정한다.
 */
describe('재조우 보강 스킵 — 배선과 예산 회계', () => {
  const disc = read('src/features/marketing/api/influencer-discovery.ts')
  const known = read('src/features/marketing/api/influencer-known-contacts.ts')
  const col = read('src/features/marketing/api/influencer-auto-collect.ts')

  it('YT·네이버 보강 대상이 훅을 거친다', () => {
    expect((disc.match(/filterUncontacted\(opts\.alreadyContacted/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('훅이 없거나 실패하면 보강을 그대로 진행한다 — 최적화가 수집을 막으면 안 된다', () => {
    const fn = /async function filterUncontacted[\s\S]*?\n\}/.exec(disc)?.[0] || ''
    expect(fn).toMatch(/if\s*\(!hook[\s\S]{0,40}return rows/)
    expect(fn).toMatch(/catch\s*\{\s*return rows\s*\}/)
  })

  it('🧾 조회도 예산에서 뺀다 — D1 도 서브리퀘스트다(#784 의 비대칭을 다시 만들지 않는다)', () => {
    expect(known).toMatch(/budget\.left\s*-=\s*1/)
    // 예산이 바닥이면 조회조차 하지 않는다(마감 기록용 여유를 잡아먹지 않게).
    expect(known).toMatch(/budget\.left\s*<=\s*1/)
  })

  it('연락처가 **비어 있는** 재조우는 스킵하지 않는다 — 그건 백필이 실제로 채운다', () => {
    expect(known).toMatch(/COALESCE\(email,''\)\s*<>\s*''/)
    expect(known).toMatch(/COALESCE\(instagram,''\)\s*<>\s*''/)
  })

  /**
   * 🔗 라이브 표본 200건: `hasContact=1` 네이버 블로거의 **58%** 가 자기 blog.naver.com 주소만 갖고 있다
   *   (이메일 77 · 인스타 9 · 외부링크 1 · 자기링크만 117). 그걸 '연락처'로 세면 이 훅이
   *   **영영 보강 안 되는 리드**를 만든다 — `COALESCE` 백필은 빈 칸만 채우는데 links 가 차 있기 때문.
   */
  it('네이버 블로거의 자기 blog.naver.com 링크는 연락처로 세지 않는다 — 오염을 고착시키지 않게', () => {
    expect(known).toMatch(/links NOT LIKE '%blog\.naver\.com%'/)
    expect(known).toMatch(/platform === 'naver_blog'\s*\n?\s*\?/)
  })

  it('수집 엔진이 훅을 만들어 발굴에 넘긴다', () => {
    expect(col).toMatch(/makeAlreadyContacted\(DB,\s*POOL_ACCOUNT_ID,\s*budget\)/)
    expect((col.match(/alreadyContacted\s*\}/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

/**
 * 🏘️ **카페 수확을 블로그에 합산하지 않는다** — 결정하는 자리에 숫자를 놓기 위해 (2026-07-29).
 *
 *   카페는 성격이 다르다. 라이브 표본 200건에서 **연락 가능 2건**(이메일 0 · 인스타 0 · 외부링크 2)이고
 *   보강 경로도 없다(`enrichNaverActivity` 는 `platform='naver_blog'` 만 본다). 즉 연락 불가인데
 *   키워드마다 예산을 쓴다. 끌지 말지는 **수집 정책(대표 결정)** 이지만, 그 판단에 필요한 수치가
 *   `diag.naver` 에 합산돼 **블로그 성과처럼 보이던 것**은 결함이다.
 *
 *   ⚠️ 이 테스트는 카페를 끄지 않는다 — 기본값은 그대로다(`ADS_COLLECT_CAFE_ENABLED`).
 */
describe('수집 진단 — 카페는 따로 센다', () => {
  const col = read('src/features/marketing/api/influencer-auto-collect.ts')

  it('카페 저장 결과가 diag.cafe 로 간다(diag.naver 합산 금지)', () => {
    const block = /discoverNaverCafes\([\s\S]{0,600}?catch/.exec(col)?.[0] || ''
    expect(block, 'discoverNaverCafes 호출부를 못 찾았다').toBeTruthy()
    expect(block).toMatch(/diag\.cafe\.found/)
    expect(block).toMatch(/diag\.cafe\.saved/)
    expect(block).not.toMatch(/diag\.naver\.(found|saved)/)
  })

  it('diag 초기값에 cafe 가 있다 — 없으면 런타임에 undefined 증가로 조용히 NaN 이 된다', () => {
    expect(col).toMatch(/cafe:\s*\{\s*found:\s*0,\s*saved:\s*0\s*\}/)
  })
})

/**
 * ⏱️ **마지막 레인이 시계를 굶지 않는다** (2026-07-29 12:00 실측).
 *
 *   실측: `spent 18 / budget_total 45` · `deadline_hit: true` · `elapsed 23.4s` ·
 *   `naver { selected: 13, tried: 0 }` — **예산의 60%를 남긴 채 시계로 끝났고**, 13건을 뽑아 놓고
 *   한 건도 못 돌렸다. 순서가 bio → yt → **naver(마지막)** 인데 yt 가 20초를 다 썼기 때문이다.
 *
 *   앞선 세션이 같은 자리에서 **예산** 굶주림을 고쳤다(`naverRoomFromRemaining`). 구속 자원이
 *   예산에서 시계로 옮겨갔을 뿐 병은 같다 — **순서가 고정되면 마지막 레인은 무엇이 구속하든 굶는다.**
 */
describe('보강 레인 — 앞 레인 사전 마감(블로거 시간 바닥)', () => {
  const lane = read('src/features/marketing/api/influencer-enrich-lane.ts')

  it('바닥 비율만큼을 블로거 몫으로 남긴다', () => {
    expect(frontStageDeadline(1_000, 20_000, 40)).toBe(13_000) // 앞 레인은 60% 까지
    expect(frontStageDeadline(0, 20_000, 50)).toBe(10_000)
  })

  it('비율은 10~80 으로 클램프되고 비정상 입력은 기본값이 된다', () => {
    expect(frontStageDeadline(0, 20_000, 0)).toBe(18_000)    // <10 → 10
    expect(frontStageDeadline(0, 20_000, 99)).toBe(4_000)    // >80 → 80
    // ⚠️ 기본값을 **숫자로 박지 않는다**(2026-07-29): 원래 `.toBe(12_000) // NaN → 40` 이었는데,
    //    실측(16:00 A/B — 유튜브 선두 회차에서 블로거 선택 18 중 시도 6)으로 기본값을 40 → 70 으로
    //    조율하자 *동작은 의도대로인데 테스트만* 깨졌다. 고정할 것은 특정 숫자가 아니라
    //    **"비정상 입력이면 기본값으로 떨어진다"** 는 계약이다.
    expect(frontStageDeadline(0, 20_000, Number.NaN)).toBe(frontStageDeadline(0, 20_000, NAVER_FLOOR_PCT_DEFAULT))
    expect(frontStageDeadline(0, Number.NaN, 40)).toBe(0)
  })

  it('앞 레인에 사전 마감을 씌우고 블로거 직전에 푼다 — 복원이 빠지면 블로거도 갇힌다', () => {
    expect(lane).toMatch(/budget\.deadline = frontStageDeadline\(started, deadlineMs, naverFloorPct\)/)
    expect(lane).toMatch(/budget\.deadline = started \+ deadlineMs/)
  })

  /**
   * 🧨 여기 있던 "복원이 블로거 호출 **앞**에 온다" 검사는 **삭제했다**(2026-07-29, CI 가 잡음).
   *
   *   파일 전체에서 두 문자열의 **인덱스 대소**로 순서를 봤는데, 선두 교대를 넣으며 블로거 호출이
   *   `runNaver()` 헬퍼 안으로 들어가 **분기보다 위**에 정의되자 그 전제가 깨졌다(13,666 < 14,676).
   *   불변식 자체는 살아 있고 — 짝수 라운드에서 상한→복원→블로거 순서 — 아래 '선두 교대' describe 의
   *   `짝수 라운드는 종전대로…` 가 **else 분기 안에서** 더 정확히 본다.
   *
   *   교훈(오늘 두 번째): 불변식을 **텍스트 위치**로 쓰면 리팩토링이 전제를 깬다. 지켜야 할 것은
   *   *사실*(어느 분기에서 무엇이 먼저 도는가)이지 파일 안의 좌표가 아니다.
   */
})

/**
 * 🕳️ **깊이는 하트비트로 못 본다** — 같은 이름에 부모가 나중에 쓰기 때문(12:00 실측 `result: null`).
 *   판정 창은 레인 스냅샷이어야 한다.
 */
describe('self-chain 깊이 관측 — 이름을 다투지 않는 곳에 싣는다', () => {
  const lane = read('src/features/marketing/api/influencer-enrich-lane.ts')
  const routes = read('src/worker-ads/enrich.routes.ts')

  it('레인 스냅샷이 depth 를 싣는다', () => {
    expect(lane).toMatch(/depth\?:\s*number/)
    expect(lane).toMatch(/budget_total:\s*budgetTotal,\s*depth/)
  })

  it('드라이버가 쿼리의 depth 를 레인으로 넘긴다', () => {
    expect(routes).toMatch(/runInfluencerEnrich\(c\.env,\s*Number\.isFinite\(d\)/)
  })
})

/**
 * 🔀 **커서 픽이 꼬리에 몰려 영영 안 돌던 것** (2026-07-29 12:00 실측).
 *
 *   `picks { planned: 16, processed: 2, from_yt: 2, from_cursor: 0 }` — 예산으로 2개만 돌았고 둘 다 YT 픽.
 *   배열이 `[...ytPicks, ...cursorPicks]` 였기 때문이다. 그런데 커서 전진은 `prefixDone`(처리된 **선행
 *   구간** 길이)으로 계산하므로, 커서 픽이 한 번도 처리되지 않으면 `nextCursor = cursor + 0` —
 *   **커서가 영원히 제자리**다. 활성 키워드 330개 중 매 회차 같은 소수만 돈다.
 *
 *   오늘 세 번째 같은 병이다(보강 레인의 시계 · 그 전엔 예산 · 여기선 순번).
 *   **줄을 세우면 꼬리가 굶는다 — 자원이 무엇이든.**
 */
describe('키워드 픽 — 커서가 순번을 받는다', () => {
  const col = read('src/features/marketing/api/influencer-auto-collect.ts')

  it('YT 픽과 커서 픽을 번갈아 놓는다 — 2개만 돌아도 커서가 1개는 받는다', () => {
    expect(interleavePicks(['y1', 'y2', 'y3'], ['c1', 'c2', 'c3'], 6)).toEqual(['y1', 'c1', 'y2', 'c2', 'y3', 'c3'])
    expect(interleavePicks(['y1', 'y2', 'y3'], ['c1', 'c2', 'c3'], 2)).toEqual(['y1', 'c1'])
  })

  it('한쪽이 비어도 나머지로 채운다(총량 유지)', () => {
    expect(interleavePicks([], ['c1', 'c2'], 5)).toEqual(['c1', 'c2'])
    expect(interleavePicks(['y1', 'y2'], [], 5)).toEqual(['y1', 'y2'])
  })

  it('상대 순서를 보존한다 — prefixDone 이 선행 구간을 세므로 뒤섞으면 커서 계산이 깨진다', () => {
    const r = interleavePicks(['y1', 'y2'], ['c1', 'c2'], 4)
    expect(r.filter(x => x.startsWith('y'))).toEqual(['y1', 'y2'])
    expect(r.filter(x => x.startsWith('c'))).toEqual(['c1', 'c2'])
  })

  it('total 이 비정상이어도 안전하다', () => {
    expect(interleavePicks(['y1'], ['c1'], 0)).toEqual([])
    expect(interleavePicks(['y1'], ['c1'], Number.NaN)).toEqual([])
  })

  it('호출부가 번갈아 배치를 쓴다(concat 회귀 금지)', () => {
    expect(col).toMatch(/interleavePicks\(ytPicks,/)
    expect(col).not.toMatch(/\[\.\.\.ytPicks,\s*\.\.\.picks\.filter/)
  })

  /**
   * ⚠️ 짝이 되는 변경 — 순서만 바꾸면 커서 픽이 희소한 YT 쿼터를 가져가 성과가중 선택이 희석된다.
   *   위치 기반(`ytUsed < batch` 단독)은 "앞에서 batch 개"라는 뜻이라 배치 순서와 쿼터 배분이 얽혀 있었다.
   */
  it('YT 슬롯은 멤버십으로 준다 — 순서와 쿼터 배분을 분리한다', () => {
    expect(col).toMatch(/const ytSlot = ytIds\.has\(k\.id\) && ytUsed < batch/)
    // 위치 단독 게이트가 되살아나면 희석이 재발한다.
    expect(col).not.toMatch(/!quotaHit && ytUsed < batch &&/)
  })
})

/**
 * 🧹 **자기링크 정리** — 노이즈가 진짜 연락처의 자리를 막던 것 (2026-07-29 대표 승인).
 *
 *   실측(`platform=naver_blog&hasContact=1`, total **1,029**): 표본 200건 중 `links` 보유 198,
 *   그중 **197건이 자기링크뿐**(외부 1). **117건(58%)** 은 이메일도 인스타도 없이 links 만 차 있었다 —
 *   '연락처 보유'로 집계되는데 실제 연락 수단이 없고, `COALESCE(links, ?)` 백필이 **영영 막힌** 상태다.
 *
 *   ⚠️ 못 막는 것: 라이브에서 실제로 몇 행이 정리되는지는 여기서 알 수 없다. 판정 규칙과 배선만 고정한다.
 */
describe('자기링크 판정 — SSOT 와 정리 규칙', () => {
  it('네이버 블로그 자기 주소를 잡는다(m./blog.me 포함)', () => {
    expect(isSelfBlogLink('https://blog.naver.com/abc')).toBe(true)
    expect(isSelfBlogLink('https://m.blog.naver.com/abc/123')).toBe(true)
    expect(isSelfBlogLink('https://abc.blog.me/1')).toBe(true)
  })

  it('연락처가 되는 외부 링크는 건드리지 않는다', () => {
    expect(isSelfBlogLink('https://linktr.ee/abc')).toBe(false)
    expect(isSelfBlogLink('https://instagram.com/abc')).toBe(false)
    // 카페는 블로그가 아니다(별도 플랫폼) — 여기서 자기링크로 치면 안 된다.
    expect(isSelfBlogLink('https://cafe.naver.com/abc')).toBe(false)
    // 유사 도메인 오탐 금지 — 경계가 없으면 남의 사이트를 지운다.
    expect(isSelfBlogLink('https://myblog.naver.company.com/x')).toBe(false)
  })

  it('전부 자기링크면 비우고, 섞여 있으면 외부만 남기고, 외부만이면 손대지 않는다', () => {
    expect(cleanSelfLinks('https://blog.naver.com/a https://m.blog.naver.com/b')).toBe(null)
    expect(cleanSelfLinks('https://blog.naver.com/a https://linktr.ee/x')).toBe('https://linktr.ee/x')
    expect(cleanSelfLinks('https://linktr.ee/x')).toBeUndefined()
    expect(cleanSelfLinks('')).toBeUndefined()
    expect(cleanSelfLinks(null)).toBeUndefined()
  })

  it('멱등 — 정리 결과를 다시 넣으면 변경 없음(정비 패스가 매 바퀴 같은 행을 갱신하지 않게)', () => {
    const once = cleanSelfLinks('https://blog.naver.com/a https://linktr.ee/x')
    expect(cleanSelfLinks(once as string)).toBeUndefined()
  })

  it('판정을 네 벌로 두지 않는다 — 발굴·측정이 SSOT 를 import 한다', () => {
    for (const f of ['influencer-discovery', 'influencer-performance']) {
      const src = read(`src/features/marketing/api/${f}.ts`)
      expect(src, `${f} 가 SSOT 를 안 쓴다`).toMatch(/from '\.\/influencer-self-link'/)
      expect(src, `${f} 에 인라인 사본이 남아 있다`).not.toMatch(/!\/blog\\\.naver\\\.com\/i\.test/)
    }
  })

  /** ⚠️ 이 표에서 빠진 단계는 **영원히 안 돈다** — 침묵이 아니라 부재라 경보에도 안 잡힌다. */
  it('정비 스케줄과 cron 리터럴 양쪽에 selflink 가 있다', () => {
    expect(read('src/features/marketing/api/influencer-maintenance.ts')).toMatch(/'selflink',/)
    // 📦 2026-08-02: cron 리터럴이 `maintenance-cron.ts` 로 분리됐다(엔트리 파일크기 래칫) — 불변식은 그대로.
    expect(read('src/worker-ads/maintenance-cron.ts')).toMatch(/'selflink',/)
  })
})

/**
 * 🔁 **선두 교대** — 몫 보장으로 못 푼 굶주림을 순서로 푼다 (2026-07-29 13:00 실측).
 *
 *   사전 마감(`frontStageDeadline`, 앞 레인 60% 상한)을 넣은 **뒤에도** 결과가 같았다:
 *   `naver { selected: 12, tried: 0 } · deadline_hit · elapsed 20.8s · spent 19/45`.
 *   중단은 **건 사이에서만** 일어나므로, YT 한 건이 마감 직전에 시작해 타임아웃(~9s)을 물면
 *   창을 넘겨 버린다 — **상한으로는 못 막는 종류**다(상한을 낮춰도 한 건이 창보다 길 수 있다).
 *
 *   ⇒ 홀수 라운드는 블로거가 먼저. 체인이 depth 2+ 로 도는 것이 같은 틱에 확인됐으므로(`depth: 2`)
 *     틱마다 블로거 선두 라운드가 최소 한 번 온다.
 */
describe('보강 레인 — 라운드마다 선두 교대', () => {
  const lane = read('src/features/marketing/api/influencer-enrich-lane.ts')

  /**
   * 🔁 **선두 조건 자체는 여기서 고정하지 않는다** — `ads-influencer-enrich-lane.test.ts` 가 SSOT.
   *
   *   나는 같은 14:00 실측(`depth: 0` 인 틱에서 블로거가 또 굶음)을 보고 `depth % 2 === 0` 으로
   *   뒤집으려 했는데, **다른 세션의 `depth % 2 === 1 || starvedLastRound(prev)` 가 더 낫다**:
   *   내 판은 체인이 계속 안 이어지면 이번엔 **앞 레인(링크인바이오·YT)이 영구히** 굶는다 —
   *   굶는 쪽을 바꿨을 뿐 굶주림 자체는 그대로다. 저쪽은 결정적 교대 + 자기교정이라 양쪽을 다 살린다.
   *   ⇒ 조건을 두 파일에서 각각 고정하면 서로를 되돌리는 싸움이 된다. 여기서는 **분기의 성질**만 본다.
   */
  it('블로거 선두 라운드에는 사전 마감을 씌우지 않는다 — 마감 전체를 쓴다', () => {
    const branch = /if \(naverFirst\) \{[\s\S]{0,300}?\n  \} else \{/.exec(lane)?.[0] || ''
    expect(branch, 'naverFirst 분기를 못 찾았다').toBeTruthy()
    expect(branch).toMatch(/runNaver\(\)[\s\S]{0,80}runFront\(\)/)
    expect(branch).not.toMatch(/frontStageDeadline/)
  })

  it('짝수 라운드는 종전대로 사전 마감 + 복원 순서를 지킨다', () => {
    const el = lane.slice(lane.indexOf('} else {'))
    const cap = el.indexOf('frontStageDeadline')
    const restore = el.indexOf('budget.deadline = started + deadlineMs')
    const naver = el.indexOf('runNaver()')
    expect(cap).toBeGreaterThan(-1)
    expect(restore).toBeGreaterThan(cap)   // 상한 뒤에 복원
    expect(naver).toBeGreaterThan(restore) // 복원 뒤에 블로거
  })

  it('블로거 호출이 한 곳뿐이다 — 두 벌로 두면 한쪽만 고쳐진다', () => {
    expect((lane.match(/enrichNaverActivity\(DB, budget/g) || []).length).toBe(1)
  })
})

/**
 * 🔧 **보강 레인 수동 트리거** — 되돌려 볼 수 없으면 고치는 속도가 안 난다 (2026-07-29).
 *
 *   수집엔 `collect-burst`, 정비엔 `maintain-all` 이 있는데 보강 레인만 트리거가 없었다.
 *   그래서 이 레인의 변경은 **매시 정각 cron 을 기다려야만** 검증됐고, 오늘 네 번 고치는 동안
 *   확인 사이클이 매번 1시간씩 들었다(그중 두 번은 헛짚어 잘못된 처방이 그대로 서 있었다).
 */
describe('보강 레인 수동 트리거 — depth 가 실제로 전달된다', () => {
  it('어드민이 ur-ads 보강 엔드포인트로 위임한다', () => {
    const ops = read('src/features/marketing/api/admin-ads-pool-ops.routes.ts')
    expect(ops).toMatch(/influencer-pool\/enrich-run/)
    expect(ops).toMatch(/__ads\/enrich-influencer\?depth=/)
  })

  /** ⚠️ 받는 쪽이 안 읽으면 파라미터가 조용히 무시된다 — "시험했는데 왜 같지?" 가 되는 자리다. */
  it('ur-ads 쪽이 depth 를 읽어 레인에 넘긴다(무시 금지)', () => {
    const routes = read('src/worker-ads/enrich.routes.ts')
    // 상한은 넉넉히 — 좁게 잡으면 **주석 몇 줄만 늘어도** 매치가 끊겨 "코드는 맞는데 빨간불"이 된다
    // (실제로 이 테스트를 처음 쓸 때 600 으로 잡아 그렇게 됐다). 게으른 `?` 라 넓혀도 다음 핸들러까진 안 먹는다.
    const h = /enrichRoutes\.post\('\/__ads\/enrich-influencer'[\s\S]{0,2000}?\n\}\)/.exec(routes)?.[0] || ''
    expect(h, '핸들러를 못 찾았다').toBeTruthy()
    expect(h).toMatch(/c\.req\.query\('depth'\)/)
    expect(h).toMatch(/runInfluencerEnrich\(c\.env,/)
  })

  /** ⚠️ 드라이버(체인)를 부르면 백그라운드 체인이 cron 과 겹쳐 같은 구간을 중복 조회한다. */
  it('수동 트리거는 드라이버(체인)가 아니라 단일 라운드를 부른다', () => {
    const ops = read('src/features/marketing/api/admin-ads-pool-ops.routes.ts')
    expect(ops).not.toMatch(/enrich-run[\s\S]{0,900}enrich-influencer-driver/)
  })
})


/**
 * 🧱 **`runDdlOnce` 키를 공유하는 두 호출부는 같은 DDL 을 봐야 한다** (2026-07-29).
 *
 *   `ads_ddl_discovery_keywords` 키를 `influencer-auto-collect` 와 `influencer-keyword-store` 가
 *   **함께** 쓰는데, 각자 `KW_DDL` 배열을 들고 있었다. 내용이 같아 그날은 무해했지만 — 한쪽만 고치면
 *   체크섬이 호출부마다 달라져 **매 인보케이션 서로의 기록을 덮어쓰며 DDL + 시드 200문장이 영원히
 *   재실행**된다. 무료 플랜에서 서브리퀘스트가 천장인데, 그 재실행을 없애려고 만든 최적화가 통째로
 *   뒤집히는 형태다(그리고 에러가 안 나서 아무도 모른다 — 이 레포의 반복 실패형).
 *
 *   ⚠️ 못 막는 것: 다른 키에서 같은 구조가 생기는 것. 지금 공유 키는 이것 하나라(전수 확인) 그것만 고정한다.
 */
describe('🧱 DDL SSOT — 공유 키의 문장 목록은 한 벌이다', () => {
  const DIR = 'src/features/marketing/api'

  it('KW_DDL 정의는 레포에 정확히 하나', () => {
    const defs = ['influencer-keyword-ddl.ts', 'influencer-keyword-store.ts', 'influencer-auto-collect.ts']
      .filter(f => /^(export )?const KW_DDL/m.test(read(`${DIR}/${f}`)))
    expect(defs, `KW_DDL 을 두 곳 이상에서 정의하고 있다: ${defs.join(', ')}`).toEqual(['influencer-keyword-ddl.ts'])
  })

  /**
   * ⚠️ 2026-08-04 재앵커 — 원래 이 시험은 `['influencer-keyword-store.ts', 'influencer-auto-collect.ts']`
   *   **두 파일 이름을 박아** 두었다. 그런데 그 둘이 byte-동일한 정의를 갖고 있던 것 자체가 결함이었고
   *   (2026-07-29 분리가 병합으로 되돌아왔다), 중복을 지우자 이 시험이 **정상 구조를 빨간불로** 만들었다.
   *   ⇒ 이름이 아니라 **의도**에 건다: 그 공유 키로 `runDdlOnce` 를 부르는 모듈은 *전부* SSOT 를 import 한다.
   *   파일이 하나든 셋이든 성립하고, 새 호출부가 생기면 자동으로 검사 대상이 된다.
   */
  it('그 공유 키를 쓰는 모듈은 **전부** SSOT 를 import 한다', () => {
    const KEY = 'ads_ddl_discovery_keywords'
    const files = readdirSync(resolve(process.cwd(), DIR)).filter(f => f.endsWith('.ts'))
    const callers = files.filter(f => f !== 'influencer-keyword-ddl.ts' && read(`${DIR}/${f}`).includes(KEY))
    expect(callers.length, '호출부가 0개면 이 검사는 통과가 아니라 무의미하다(키 이름이 바뀌었나)').toBeGreaterThan(0)
    for (const f of callers) {
      expect(read(`${DIR}/${f}`), `${f} 가 공유 키를 쓰면서 KW_DDL 을 자체 정의하거나 베꼈다`)
        .toMatch(/import \{ KW_DDL \} from '\.\/influencer-keyword-ddl'/)
    }
  })
})

/**
 * 🔍 **소스에 생 NUL 바이트를 두지 않는다** — 그 파일은 grep/ripgrep 이 통째로 건너뛴다 (2026-07-29).
 *
 *   `ads-schema-guard.ts` 에 `statements.join(NUL)` 이 **생 바이트로** 박혀 있었다. 구분자 선택 자체는
 *   옳다(NUL 은 SQL 문에 못 들어가니 모호성이 없다) — 문제는 **표기**다. 그 한 바이트 때문에 `file(1)` 이
 *   이 파일을 `data` 로 보고, **grep 기반 검사 전부가 이 파일만 못 봤다**(가드가 "있는데 안 도는" 것과
 *   결과가 같다). 이스케이프(`U+0000`)로 적으면 문자열은 **동일**하고(체크섬 불변 — 실측 확인)
 *   파일은 텍스트로 남는다.
 *
 *   ⚠️ 이 테스트 자신도 NUL 을 **생으로 쓰지 않는다**(`String.fromCharCode(0)`) — 그랬다간 검사 파일이
 *   같은 사각지대로 들어간다.
 */
describe('🔍 소스에 생 NUL 바이트 없음 — grep 사각지대 방지', () => {
  const NUL = String.fromCharCode(0)
  const FILES = [
    'src/features/marketing/api/ads-schema-guard.ts',
    'src/features/marketing/api/influencer-keyword-ddl.ts',
    'src/worker-ads/lane-cadence.ts',
  ]

  it('검사 대상이 실제로 존재한다(경로가 낡아 0건이 되는 것 차단)', () => {
    for (const f of FILES) expect(read(f).length, `${f} 를 못 읽었다`).toBeGreaterThan(0)
  })

  it('어느 파일에도 U+0000 이 생으로 들어 있지 않다', () => {
    for (const f of FILES) expect(read(f).includes(NUL), `${f} 에 생 NUL 이 있다`).toBe(false)
  })
})

/**
 * 🔎 **자식이 자기 실패 사유를 남긴다** — 부모는 구조적으로 볼 수 없다 (2026-07-31 라이브 장애).
 *
 *   실측: ads 레인 15개가 매시간 `err=Error` 로 실패하는데, 같은 레인을 수동 트리거로 직접 부르면
 *   **완벽히 정상**이었다(`tried 19 · spent 44/45 · 13.1s`). 고장은 레인 본문이 아니라 부모의 kick ↔
 *   자식 인보케이션 사이인데, **왜 죽었는지가 어디에도 없었다.**
 *     · `kick` 은 `SELF.fetch` 의 status 를 안 본다 → 자식의 500 은 `ok:true` 로 기록된다.
 *       즉 `ok:false` 는 fetch 자체가 거부된 것이고, 자식의 메시지는 자식과 함께 사라진다.
 *     · 부모의 `cronErrorCode` 는 **부모가 본** 에러만 본다 → 전부 `err=Error` 로 뭉개진다.
 *       (그래서 "한도인가 아닌가"조차 구분이 안 됐다 — 그 구분이 처방을 정하는 값인데도.)
 *   그리고 자식 쪽 기록은 `{ err: 'LANE_ERROR' }` **상수**였다 = 부모와 정확히 같은 양의 정보, 즉 0.
 *
 *   ⚠️ 이 가드가 못 막는 것: 인보케이션이 통째로 강제 종료되면 기록 자체가 없다(그 부재가 신호다).
 */
describe('🔎 레인 실패 사유 — 자식이 원문을 남긴다', () => {
  it('미들웨어가 던져진 에러를 붙잡아 beat 로 넘긴다', () => {
    // 🔁 2026-08-01: 미들웨어 본체가 index.ts → self-beat.ts 로 옮겨졌다(그 모듈의 관심사이고,
    //   index.ts 가 600줄 캡에 닿아 있었다). 불변식은 그대로고 **보는 파일만** 바뀐다.
    const sb = read('src/worker-ads/self-beat.ts')
    const mw = /export function selfBeatMiddleware\([\s\S]{0,1200}?\n\}/.exec(sb)?.[0] || ''
    expect(mw, 'selfBeatMiddleware 를 못 찾았다').toBeTruthy()
    expect(mw, '에러를 잡아 두지 않는다').toMatch(/catch \(err\)[\s\S]{0,60}thrown = err/)
    expect(mw, 'writeSelfBeat 에 에러를 안 넘긴다').toMatch(/writeSelfBeat\([\s\S]{0,140}thrown\)/)
    expect(mw, '에러를 삼키면 부모가 재시도 판단을 못 한다').toMatch(/throw err/)
    // ⏳ beat 쓰기는 **응답 경로 밖**이어야 한다 — await 로 되돌리면 자식 수명이 늘어 느린 레인이 죽는다.
    expect(mw, 'beat 를 await 해 응답을 붙잡는다').toMatch(/waitUntil\(beat\)/)
    // 그리고 엔트리는 그 미들웨어를 실제로 붙여야 한다(옮기고 배선을 빠뜨리면 관측이 통째로 사라진다).
    expect(read('src/worker-ads/index.ts')).toMatch(/app\.use\('\/__ads\/\*', selfBeatMiddleware\(\)\)/)
  })

  it('beat 기록에 상수가 아니라 **실제 사유**가 들어간다', () => {
    const sb = read('src/worker-ads/self-beat.ts')
    // ⚠️ 주석을 걷어내고 본다 — 첫 판은 이 파일의 **설명 문장**에 있는 `LANE_ERROR` 를 위반으로 잡았다
    //   (코드가 아니라 산문을 검사한 것). 소스 형태 검사에서 반복해 밟는 함정이라 여기 남긴다.
    const code = sb.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // 🚫 회귀 형태: 무엇이 죽었든 같은 문자열을 쓰는 것(= 부모의 err=Error 와 정보량이 같다).
    expect(code, "'LANE_ERROR' 상수로 되돌아갔다").not.toMatch(/err:\s*'LANE_ERROR'/)
    expect(code).toMatch(/function failNote\(/)
    expect(code, '메시지를 안 싣는다').toMatch(/detail:\s*msg\.slice/)
    expect(code, 'failNote 를 실제로 호출하지 않는다').toMatch(/recordCronBeat\([\s\S]{0,120}failNote\(err\)/)
  })

  it('던지지 않고 5xx 를 반환한 경우와 구분된다 — 원인이 다르면 기록도 달라야 한다', () => {
    const sb = read('src/worker-ads/self-beat.ts')
    expect(sb).toMatch(/STATUS_5XX/)
  })
})

/**
 * ⏱️ **보강 마감은 부모 수명 아래여야 한다** — 2026-08-02 KST 실측이 만든 불변식.
 *
 *   cron 경로에서 부모 인보케이션은 약 **10.5초**에 회수되고, 그때 살아 있던 자식이 **전부 함께** 죽는다
 *   (피호출자는 호출자보다 오래 못 산다 — 이 파일 맨 위 규칙이 여기서 상한으로 나타난다).
 *   두 틱 연속 **성공 최대 8,316 / 8,050ms ↔ 실패 최소 10,505ms · 겹침 0**, 실패는 전부 같은 초에 몰렸다.
 *   그런데 세 보강 레인의 마감 기본값은 **20초**였다 — 그 창은 **애초에 도달 불가능**했고,
 *   그래서 `enrich_lane.last_run` 이 며칠째 멈춰 있었다(스냅샷 쓰기 전에 죽으니 기록이 안 남는다).
 *
 *   ⚠️ 이 검사가 **못 막는 것**: 마감은 *항목 사이*에서만 검사된다. 건당 fetch 가 최대 8s라
 *     6.9초에 시작한 건이 14.9초에 끝나면 여전히 절단된다 — 건당 타임아웃은 별도 과제다.
 *   ⚠️ 10.5초는 **관측값**이지 플랫폼 상수가 아니다. 플랜/런타임이 바뀌면 다시 재라
 *     (성공 max ↔ 실패 min 경계를 보면 된다).
 */
describe('⏱️ 보강 마감 — 부모 수명(≈10.5s) 아래', () => {
  it('기본값이 부모 수명보다 확실히 작다', () => {
    expect(ENRICH_DEADLINE_MS_DEFAULT).toBeLessThan(10_500)
    // 너무 작으면 매 라운드가 한 건도 못 끝낸다 — 아래로도 바닥을 둔다.
    expect(ENRICH_DEADLINE_MS_DEFAULT).toBeGreaterThanOrEqual(5_000)
  })

  it('env 로 조정되지만 범위를 벗어나지 않는다(무배포 되돌리기 경로)', () => {
    expect(resolveEnrichDeadlineMs('9000')).toBe(9_000)
    expect(resolveEnrichDeadlineMs('999999')).toBe(120_000)
    expect(resolveEnrichDeadlineMs('1')).toBe(5_000)
    expect(resolveEnrichDeadlineMs('abc')).toBe(ENRICH_DEADLINE_MS_DEFAULT)
    expect(resolveEnrichDeadlineMs(undefined)).toBe(ENRICH_DEADLINE_MS_DEFAULT)
  })

  /**
   * 🔑 **세 레인이 한 env 를 공유하는데 기본값은 세 벌이었다.** 하나만 고치면 나머지는 조용히 옛 값으로 남는다
   *   — 실제로 죽은 목록에 `enrich-company`·`enrich-prospects` 가 정확히 들어 있었다(같은 이유로 죽고 있었다).
   */
  it('세 보강 레인이 모두 SSOT 리졸버를 쓴다(기본값 복제 금지)', () => {
    for (const f of ['influencer-enrich-lane.ts', 'enrich-lane.ts', 'prospect-enrich.ts']) {
      const src = read(`src/features/marketing/api/${f}`)
      // 🔁 2026-08-02: 진입점이 `envEnrichDeadlineMs(env)` 로 바뀌었다(요금제까지 반영하려면 raw 문자열이
      //   아니라 env 를 받아야 한다). **가드의 의도는 그대로다** — "레인이 SSOT 를 쓰는가".
      //   두 형태를 모두 허용하되(옛 형태도 여전히 SSOT 경유라 위반이 아니다) 어느 쪽도 안 쓰면 실패.
      //   ⚠️ 이름만 갈아끼우고 검사를 약화시키지 않았는지 확인할 것 — `.not.toMatch` 복제 금지 줄은 불변이다.
      expect(src, `${f} 가 리졸버를 안 쓴다`).toMatch(/(envEnrichDeadlineMs\(env\)|resolveEnrichDeadlineMs\(env\.ADS_ENRICH_DEADLINE_MS\))/)
      expect(src, `${f} 에 기본값이 다시 복제됐다`).not.toMatch(/ADS_ENRICH_DEADLINE_MS \|\| '', 10\) \|\| \d/)
    }
  })
})

/**
 * ⏱️ **마감만으로는 부족하다** — 마감 검사는 *항목 사이*에서만 일어난다.
 *   6.9초에 통과한 항목이 상수 8s 타임아웃을 다 쓰면 14.9초에 끝나고, 그때 부모(≈10.5s)는 이미 없다.
 *   ⇒ 건당 타임아웃을 **남은 창에서 유도**해 최악 종료를 `마감 + 바닥값` 으로 묶는다.
 */
describe('⏱️ 건당 fetch 타임아웃 — 남은 창에서 유도', () => {
  it('창이 넉넉하면 종전 상수를 그대로 준다(느린 사이트를 근거 없이 버리지 않는다)', () => {
    const now = 1_000_000
    expect(budgetedTimeoutMs(now + 20_000, 8_000, now)).toBe(8_000)
    expect(budgetedTimeoutMs(undefined, 8_000, now)).toBe(8_000) // 마감 없음(수동 트리거) = 부모 수명에 안 묶임
  })

  it('창이 좁으면 남은 만큼만 준다', () => {
    const now = 1_000_000
    expect(budgetedTimeoutMs(now + 4_000, 8_000, now)).toBe(4_000)
  })

  it('바닥값 아래로는 안 내려간다 — 200ms 타임아웃은 정상 응답까지 실패로 각인한다', () => {
    const now = 1_000_000
    expect(budgetedTimeoutMs(now + 200, 8_000, now)).toBe(FETCH_TIMEOUT_FLOOR_MS)
    expect(budgetedTimeoutMs(now - 5_000, 8_000, now)).toBe(FETCH_TIMEOUT_FLOOR_MS) // 이미 지난 마감
  })

  /** 🔑 이 부등식이 이 수리의 전부다. 깨지면 항목 하나가 부모보다 오래 살 수 있다. */
  it('최악 종료(마감 + 바닥값)가 부모 수명보다 작다', () => {
    expect(ENRICH_DEADLINE_MS_DEFAULT + FETCH_TIMEOUT_FLOOR_MS).toBeLessThan(10_500)
  })

  it('블로거 두 fetch 가 상수가 아니라 유도값을 쓴다', () => {
    const src = read('src/features/marketing/api/influencer-performance.ts')
    // 네이버 RSS·홈 — 이 두 줄이 레인의 실제 병목이다
    expect(src).toMatch(/rss\.blog\.naver\.com[^\n]*AbortSignal\.timeout\(itemTimeout\)/)
    expect(src).toMatch(/m\.blog\.naver\.com[^\n]*AbortSignal\.timeout\(itemTimeout\)/)
    expect(src).toMatch(/const itemTimeout = budgetedTimeoutMs\(budget\.deadline, 8000\)/)
  })

  /** 유튜브 단계도 같은 창 안에서 돈다 — 여기서 넘기면 뒤에 선 블로거가 통째로 굶는다. */
  /**
   * ⚠️ 2026-08-03: YT 성과가 `influencer-yt-performance.ts` 로 분리됐다(600줄 래칫, 순수 이동).
   *   앵커를 안 옮기면 이 가드는 **YT 호출이 0개인 파일을 세며 조용히 실패/통과**한다 — 낡은 지도.
   */
  it('유튜브 API 호출도 마감 안에서 유도값을 쓴다(상수 10s 잔존 금지)', () => {
    const yt = read('src/features/marketing/api/influencer-yt-performance.ts')
      .split('\n')
      .filter(l => /YT_BASE\}|AbortSignal\.timeout/.test(l))
      .join('\n')
    // 예산(budget)이 스코프에 있는 호출은 전부 유도값이어야 한다
    const budgeted = (yt.match(/budgetedTimeoutMs\(budget\.deadline, 10000\)/g) || []).length
    expect(budgeted, '유튜브 호출 3곳이 유도값을 써야 한다').toBe(3)
  })
})
