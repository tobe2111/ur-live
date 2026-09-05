/**
 * 🗓️ 2026-09-04 대표 확정: **"마감 개념은 없어."**
 *
 * 이용권은 "모여야 열리는" 공동구매가 아니라 즉시 구매다. 그래서 소비자 화면에 '마감임박' 정렬을
 * 두면 ① 개념적으로 틀리고 ② 실제로도 아무 순서를 못 만든다 — 라이브 실측(2026-09-04): 활성
 * 338건 중 `group_buy_deadline` 이 박힌 건 **1건**뿐이고, 그 1건은 `DEMO_LAST` 가 어차피 맨 앞에
 * 고정하므로 정렬 결과가 최신순과 사실상 같았다.
 *
 * 🔄 2026-09-04 갱신: 여기 "대표 판단 대기" 로 적혀 있던 둘(상세 D-day 배너 · 구매 차단 가드)은
 *    #1349 에서 실제로 제거됐다. 그 판정은 `gb-join-block-reason.test.ts` 가 맡는다.
 *
 * ⚠️ 이 테스트가 못 지키는 것:
 *   · 서버 `ALLOWED_GB_SORT.deadline` (API 는 남아 있다 — 외부 호출자 계약이라 건드리지 않았다)
 *   · 미라우팅 파일(`GroupBuyListPage`)의 마감 정렬·'오늘 마감' 큐레이션 — 죽은 코드라 대상이 아니다
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/** ⚠️ 주석은 걷어내고 **코드만** 본다 — 이 레포가 반복해 밟은 함정이다(설명에 그 단어를 쓰면
 *  판정이 뒤집힌다). 실제로 이 테스트를 처음 짤 때 내 주석의 'deadline' 에 걸려 빨간불이 났다. */
const code = (p: string) => read(p).split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')

describe('마감 개념 — 소비자 정렬에서 제거된 상태 유지', () => {
  it('모바일 홈 피드 SORTS 에 deadline 칩이 없다', () => {
    const s = code('src/pages/main-home/GroupBuyFeed.tsx')
    const sorts = s.slice(s.indexOf('const SORTS'), s.indexOf('type SortKey'))
    expect(sorts).not.toMatch(/key:\s*'deadline'/)
    expect(sorts).not.toMatch(/마감임박/)
    // 살아 있는 칩은 그대로여야 한다(과잉 삭제 방지)
    expect(sorts).toMatch(/key:\s*'popular'/)
    expect(sorts).toMatch(/key:\s*'discount'/)
    expect(sorts).toMatch(/key:\s*'newest'/)
  })

  it('모바일 홈 피드에 deadline 정렬 분기가 없다', () => {
    expect(code('src/pages/main-home/GroupBuyFeed.tsx')).not.toMatch(/case\s+'deadline'/)
  })

  it('PC 홈의 칩 목록과 허용 키에 deadline 이 없다', () => {
    const s = code('src/pages/pc-home/PcHomePage.tsx')
    const chips = s.slice(s.indexOf('const SORT_CHIPS'), s.indexOf('export default'))
    expect(chips).not.toMatch(/'deadline'/)
    expect(chips).toMatch(/SORT_KEYS/)          // 허용 키 자체는 살아 있어야 한다
  })

  it('홈 쿼리 동기화의 허용 키에 deadline 이 없다 — 옛 링크는 무시되고 기본값이 유지된다', () => {
    const s = code('src/pages/main-home/useHomeQuerySync.ts')
    const keys = s.slice(s.indexOf('HOME_SORT_KEYS'), s.indexOf('HOME_SORT_KEYS') + 200)
    expect(keys).not.toMatch(/'deadline'/)
    expect(keys).toMatch(/'popular'/)
  })

  it('인플루언서 탐색에도 deadline 정렬이 없다 — 같은 필드를 쓰므로 한쪽만 남기면 정의가 갈린다', () => {
    const s = code('src/pages/InfluencerDiscoverPage.tsx')
    expect(s).not.toMatch(/value="deadline"/)
    expect(s).not.toMatch(/sortBy === 'deadline'/)
  })
})

/**
 * 🕳️ 영구히 0 만 내는 지표 — 마감이 사라지면 '마감까지 남은 시간' 조건은 아무것도 못 센다.
 *
 * 이건 크래시가 아니라 **조용한 부재**다. 숫자가 0 으로 나오니 화면은 멀쩡해 보이고, 안내 문구만
 * 사라진 개념("24h 이내 마감")을 계속 설명한다. 이 레포가 반복해 당한 클래스라 못으로 박는다.
 *
 * 같은 이유로 #1349 에서 어필리에이트 `/top-groups`(deadline 72h 창 → 영구 0건)를 진행률·최신순으로
 * 갈아 끼웠고, 셀러 '마감 임박/미달성 위험' 타일을 없앴다. 아래는 그 마지막 한 곳(에이전시)이다.
 */
describe('마감 개념 — 영구히 0 이 되는 지표를 남기지 않는다', () => {
  it('에이전시 overview 가 마감 기준 위험 집계를 하지 않는다', () => {
    const s = code('src/worker/routes/disputes.routes.ts')
    const q = s.slice(s.indexOf("agency-overview"), s.indexOf("// 어드민용 분쟁 리스트"))
    expect(q).not.toMatch(/group_buy_deadline/)
    expect(q).not.toMatch(/at_risk/)
    // 살아 있는 집계는 그대로여야 한다(과잉 삭제 방지)
    expect(q).toMatch(/active_count/)
    expect(q).toMatch(/churn_count/)
  })

  it('에이전시 알림 카드 자체가 없다 — 마감 문구가 되돌아올 자리가 없다', () => {
    // 🌇 2026-09-05 에이전시 일몰(대표 확정) — `AgencyGroupBuyAlert.tsx` 는 삭제됐다.
    //   원래 이 자리는 그 카드 안에 "미달성 위험 — 24h 이내 마감" 문구가 되살아나는 것을 막았다.
    //   컴포넌트가 통째로 없어졌으므로 **더 강한 형태**로 고정한다(파일 부재).
    //   ⚠️ 삭제된 파일을 계속 읽으면 `code()` 가 던지거나 빈 문자열이 되어 단언이 조용히 통과한다 —
    //     이 레포가 반복해 당한 '낡은 지도'다. 실제로 머지에서 주입 검사가 이걸 잡았다.
    expect(existsSync('src/components/agency/AgencyGroupBuyAlert.tsx')).toBe(false)
    expect(existsSync('src/components/agency')).toBe(false)
  })

  it('셀러 타입에 고아가 된 위험 카운트 필드가 없다', () => {
    expect(code('src/pages/seller-page/types.ts')).not.toMatch(/atRiskGroupBuys/)
  })
})
