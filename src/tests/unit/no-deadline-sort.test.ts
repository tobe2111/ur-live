/**
 * 🗓️ 2026-09-04 대표 확정: **"마감 개념은 없어."**
 *
 * 이용권은 "모여야 열리는" 공동구매가 아니라 즉시 구매다. 그래서 소비자 화면에 '마감임박' 정렬을
 * 두면 ① 개념적으로 틀리고 ② 실제로도 아무 순서를 못 만든다 — 라이브 실측(2026-09-04): 활성
 * 338건 중 `group_buy_deadline` 이 박힌 건 **1건**뿐이고, 그 1건은 `DEMO_LAST` 가 어차피 맨 앞에
 * 고정하므로 정렬 결과가 최신순과 사실상 같았다.
 *
 * ⚠️ 이 테스트가 지키는 것은 **소비자 정렬 UI 에서 마감이 사라진 상태**뿐이다. 못 지키는 것:
 *   · 서버 `ALLOWED_GB_SORT.deadline` (API 는 남아 있다 — 외부 호출자 계약이라 건드리지 않았다)
 *   · 상세의 'D-day' 배너와 `/join`·결제확정의 마감 구매 차단 가드 (대표 판단 대기 — 그 둘은
 *     한 쌍이라 한쪽만 떼면 "안내 없이 조용히 못 사는" 더 나쁜 상태가 된다)
 *   · 셀러 등록 폼의 '판매 마감' 입력
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

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
