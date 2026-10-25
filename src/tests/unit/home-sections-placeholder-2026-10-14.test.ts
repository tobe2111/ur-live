/**
 * 📐 홈 편성 섹션 자리 = 진짜 첫 섹션과 같은 모양 (2026-10-14 — 홈 CLS)
 *
 * 실측(하네스 `--cls --slow=1500`, 섹션 스텁): 자리가 [제목 + 사진 + 13px 막대 둘] 이고 유어쇼츠
 * 레일을 빠뜨려서, 응답 순간 아래 피드가 415px 밀렸다(CLS 0.16). 수리 후 0.008.
 *
 * 고정하는 것:
 *   ① 자리 분기가 유어쇼츠 레일을 **첫 섹션 뒤·중간 배너 앞**에 그린다(진짜 분기와 같은 순서)
 *   ② 자리 카드는 진짜 카드와 **같은 줄 구조**다 — 줄마다 글자 크기·줄 높이·여백 클래스를 카드 소스와 대조
 *   ③ 자리 카드는 진짜 카드를 `invisible` 로 빌려 쓰지 않는다(화면에 들어오면 가짜 id 로 상세를 미리 받는다)
 * ⚠️ 못 보는 것: 실제 높이(jsdom 에 레이아웃이 없다 — 하네스 `--cls` 가 판정) · 이름이 한 줄인 섹션의 75px 차이.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const sections = stripComments(readFileSync('src/components/home/HomeSections.tsx', 'utf8'))
const card = stripComments(readFileSync('src/pages/main-home/GroupBuyFeedCard.tsx', 'utf8'))
const ph = stripComments(readFileSync('src/components/home/DealCardPlaceholder.tsx', 'utf8'))

function skeletonBranch() {
  const a = sections.indexOf('if (isLoading && visible.length === 0)')
  const b = sections.indexOf('if (visible.length === 0) return', a)
  expect(a).toBeGreaterThan(0)
  expect(b).toBeGreaterThan(a)
  return sections.slice(a, b)
}

describe('① 자리 분기의 순서', () => {
  it('자리 섹션 → 유어쇼츠 레일 → 중간 배너 (진짜 분기와 같은 순서)', () => {
    const s = skeletonBranch()
    const sec = s.indexOf('</section>')
    const rail = s.indexOf('{shortsRail}')
    const mid = s.indexOf('{midBanner}')
    expect(sec).toBeGreaterThan(0)
    expect(rail).toBeGreaterThan(sec)
    expect(mid).toBeGreaterThan(rail)
    // 진짜 분기도 첫 섹션 뒤에 레일 → 배너다(이게 바뀌면 자리도 같이 바꿔야 한다)
    expect(sections).toMatch(/\{sIdx === 0 && shortsRail\}\s*\{sIdx === 0 && midBanner\}/)
  })
  it('자리 카드는 DealCardPlaceholder 로 그린다(13px 막대 둘로 돌아가지 않는다)', () => {
    const s = skeletonBranch()
    expect(s.match(/<DealCardPlaceholder\b/g)?.length).toBeGreaterThanOrEqual(2)
    expect(s).not.toMatch(/h-\[13px\]/)
  })
})

describe('② 자리 카드 = 진짜 카드의 줄 구조', () => {
  const rows: Array<[string, RegExp, RegExp]> = [
    ['사진 비율', /aspectClass="aspect-\[4\/3\]"/, /aspect-\[4\/3\]/],
    ['본문 여백', /<div className="pt-3">/, /<div className="pt-3">/],  // 2026-10-25 메인 D안
    ['가게 줄', /text-\[12px\] leading-none mb-1/, /text-\[12px\] leading-none mb-1/],
    ['이름 줄', /text-\[15px\] font-medium line-clamp-2 leading-snug/, /text-\[15px\] font-medium leading-snug/],
    ['주소·평점 줄', /mt-1 text-\[12px\]/, /mt-1 text-\[12px\]/],
    ['정가 묶음', /<div className="mt-2">/, /<div className="mt-2">/],
    ['판매가 줄', /mt-1 leading-none/, /mt-1 leading-none/],
    ['판매가 크기', /text-\[17px\] font-bold/, /text-\[17px\] font-bold/],
  ]
  for (const [label, inCard, inPh] of rows) {
    it(label, () => {
      expect(card, `카드에서 사라졌다 — 자리 카드도 같이 바꿀 것`).toMatch(inCard)
      expect(ph).toMatch(inPh)
    })
  }
  it('이름은 두 줄로 잡는다(그리드 한 줄의 높이는 긴 쪽을 따른다)', () => {
    const name = ph.slice(ph.indexOf('text-[15px] font-medium leading-snug'), ph.indexOf('</p>', ph.indexOf('text-[15px] font-medium leading-snug')))
    expect(name.match(/<span/g)?.length).toBe(2)
  })
})

describe('③ 진짜 카드를 빌리지 않는다', () => {
  it('자리 카드 파일이 GroupBuyFeedCard 를 import 하지 않는다', () => {
    expect(ph).not.toMatch(/GroupBuyFeedCard/)
  })
  it('스크린리더에 안 읽힌다', () => {
    expect(ph).toMatch(/aria-hidden="true"/)
  })
})
