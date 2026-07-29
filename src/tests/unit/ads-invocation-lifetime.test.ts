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
import { frontStageDeadline } from '@/features/marketing/api/influencer-enrich-lane'
import { interleavePicks } from '@/features/marketing/api/influencer-keyword-rotation'

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

  it('비율은 10~80 으로 클램프되고 비정상 입력은 기본값(40)이 된다', () => {
    expect(frontStageDeadline(0, 20_000, 0)).toBe(18_000)    // <10 → 10
    expect(frontStageDeadline(0, 20_000, 99)).toBe(4_000)    // >80 → 80
    expect(frontStageDeadline(0, 20_000, Number.NaN)).toBe(12_000) // NaN → 40
    expect(frontStageDeadline(0, Number.NaN, 40)).toBe(0)
  })

  it('앞 레인에 사전 마감을 씌우고 블로거 직전에 푼다 — 복원이 빠지면 블로거도 갇힌다', () => {
    expect(lane).toMatch(/budget\.deadline = frontStageDeadline\(started, deadlineMs, naverFloorPct\)/)
    expect(lane).toMatch(/budget\.deadline = started \+ deadlineMs/)
  })

  it('복원이 블로거 호출 **앞**에 온다(순서가 뒤집히면 무효)', () => {
    const restore = lane.indexOf('budget.deadline = started + deadlineMs')
    const naverCall = lane.indexOf('enrichNaverActivity(DB, budget')
    expect(restore).toBeGreaterThan(0)
    expect(naverCall).toBeGreaterThan(restore)
  })
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
