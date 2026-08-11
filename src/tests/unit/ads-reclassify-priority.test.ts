/**
 * 🎯 재검사 우선순위 — "추측이 많은 소스부터" (2026-08-09 대표 승인 "1번 해줘").
 *
 * ## 왜 (라이브 실측)
 * ```
 *   회차당 250행 · 시간당 1회 (stopped_by=deadline)   풀 229,456 → 한 바퀴 38일
 *   커서 id 55,380  ↔  오염된 webkr 1,092건은 id 69,053~471,880 (전부 커서 뒤)
 *   대표가 신고한 진흥원 행 = id 401,793
 * ```
 * 즉 규칙을 고쳐도 **그 행에 닿기까지 그 38일을 거의 다 기다려야 했다.** 재검사가 id 오름차순
 * 크롤 하나뿐이라, "어디가 틀렸을 가능성이 높은가"와 무관하게 처음부터 훑었기 때문이다.
 *
 * ⚠️ 이 테스트가 지키는 것은 **순서**지 처리량이 아니다. 250행/회차라는 천장은 그대로다 —
 *   우선순위는 그 천장 아래에서 **무엇을 먼저 쓸지**만 바꾼다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { RECLASSIFY_PRIORITY_TIERS } from '@/features/marketing/api/reclassify-priority'
import { REGISTRY_CATEGORY_SOURCES } from '@/features/marketing/api/company-classify'

const SRC = 'src/features/marketing/api/company-discovery.ts'
const PRIO = 'src/features/marketing/api/reclassify-priority.ts'

describe('재검사 우선순위', () => {
  it('🔒 webkr 이 첫 티어 — 이름 자체를 페이지 제목에서 추측하는 유일한 소스', () => {
    expect(RECLASSIFY_PRIORITY_TIERS.length).toBeGreaterThan(0)
    expect(RECLASSIFY_PRIORITY_TIERS[0]).toContain('webkr')
  })

  /**
   * 등록부 소스(정부 신고 업태)를 우선순위에 넣으면 **우선순위가 무의미해진다** — 그쪽이 풀의 96%라
   * 앞줄이 통째로 등록부로 채워져 원래의 38일 크롤과 같아진다. 우선순위의 값은 "작고 틀리기 쉬운 것"에 있다.
   */
  it('🔒 등록부 소스는 우선순위에 없다 (넣으면 우선순위가 무의미해진다)', () => {
    for (const tier of RECLASSIFY_PRIORITY_TIERS) {
      for (const s of tier) expect(REGISTRY_CATEGORY_SOURCES.has(s), s).toBe(false)
    }
  })

  it('🔒 우선순위는 전체 크롤을 대체하지 않는다 (등록부 행도 결국 재검사된다)', () => {
    const src = fs.readFileSync(SRC, 'utf8')
    // 티어가 다 비면(prioDone) 기존 전체 크롤로 폴백하는 분기가 살아 있어야 한다.
    expect(src).toMatch(/const prioDone = !prio/)
    // 우선순위가 비면(prioDone) 전체 크롤 배치를 실제로 가져오는가
    expect(src).toMatch(/prioDone \? await pickCrawlBatch\(/)
  })

  /**
   * 🩸 커서를 섞으면 **한쪽이 조용히 건너뛴다** — 우선순위 회차가 전체 크롤 커서를 밀면 그만큼의
   * 등록부 행이 영영 재검사되지 않는다(에러 없이). 이 레포의 "조용한 누락" 클래스라 배선을 고정한다.
   */
  it('🔒 그 회차가 쓴 패스의 커서만 전진한다', () => {
    const src = fs.readFileSync(SRC, 'utf8')
    expect(src).toMatch(/if \(prioDone\) await DB\.prepare\([^\n]*\)\.bind\(RECLASSIFY_CURSOR/)
    expect(src).toMatch(/else await writePrioState\(DB, prio!\.tier, nextCursor, CLASSIFY_RULES_VERSION\)/)
  })

  /**
   * 한 바퀴가 끝나면 우선순위 상태도 리셋돼야 **다음 랩에서 다시 앞줄에 선다.**
   * 안 하면 티어가 끝에 고정돼 우선순위가 1회용이 된다 — 규칙은 앞으로도 계속 바뀐다.
   */
  it('🔒 랩 완료 시 우선순위 상태도 리셋된다 (안 하면 1회용이 된다)', () => {
    const src = fs.readFileSync(SRC, 'utf8')
    const lap = src.slice(src.indexOf('한 바퀴 완료'), src.indexOf('한 바퀴 완료') + 700)
    expect(lap).toMatch(/writePrioState\(DB, 0, 0, CLASSIFY_RULES_VERSION\)/)
  })

  it('어느 패스였는지 결과에 남는다 (안 보이면 또 오진한다)', () => {
    const src = fs.readFileSync(SRC, 'utf8')
    expect(fs.readFileSync(PRIO, 'utf8')).toMatch(/phase: `prio:/)
    expect(src).toMatch(/done: false, phase/)
  })
})

/**
 * 🩸 **규칙 버전이 바뀌면 우선순위 커서도 리셋** — 2026-08-11 라이브에서 실제로 물렸다.
 *
 * 판정 때 webkr 잔량이 **981 에서 한 건도 안 줄어** 있었다. 레인은 정상이었고(`ok=true`, 47분 전)
 * `phase=prio:local` 이었다 — **커서가 webkr 을 이미 지나쳐 다음 티어로 넘어간 뒤**에 버전이 8로
 * 올라갔고, 그 981건은 다시 대상이 됐는데 커서가 지나간 자리라 **한 바퀴(38일) 전엔 안 본다.**
 *
 * 버전 bump 의 의미는 *"전부 다시 봐라"* 다 ⇒ 우선순위 큐도 앞줄부터 다시 서야 한다.
 * 안 그러면 우선순위가 **"첫 배포 때 한 번만" 듣는 장치**가 된다.
 */
describe('규칙 버전 변경 시 우선순위 커서 리셋', () => {
  const SRCP = fs.readFileSync(PRIO, 'utf8')

  it('🔒 저장된 버전이 현행과 다르면 앞줄부터 (tier 0, cursor 0)', () => {
    expect(SRCP).toMatch(/if \(rulesVersion != null && Number\(p\.v\) !== rulesVersion\) return \{ tier: 0, cursor: 0 \}/)
  })

  it('🔒 상태에 버전을 함께 적는다 (안 적으면 영원히 "다르다" → 커서가 안 전진한다)', () => {
    expect(SRCP).toMatch(/JSON\.stringify\(\{ tier, cursor, v: rulesVersion \}\)/)
  })

  it('🔒 호출부가 현행 버전을 실제로 넘긴다 (계산해 놓고 안 쓰면 그대로다)', () => {
    const src = fs.readFileSync(SRC, 'utf8')
    expect(src).toMatch(/writePrioState\(DB, 0, 0, CLASSIFY_RULES_VERSION\)/)
    expect(src).toMatch(/writePrioState\(DB, prio!\.tier, nextCursor, CLASSIFY_RULES_VERSION\)/)
    expect(SRCP).toMatch(/readPrioState\(DB, rulesVersion\)/)
  })
})
