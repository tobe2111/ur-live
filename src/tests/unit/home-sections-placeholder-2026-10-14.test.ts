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
const phFile = stripComments(readFileSync('src/components/home/DealCardPlaceholder.tsx', 'utf8'))
// 🧾 2026-10-31: 같은 파일에 한 줄 자리(`DealRowPlaceholder`)가 생겼다 — 거기에도 `text-[17px] font-bold` 가 있어
// 파일 전체로 대조하면 격자 자리가 판매가 줄을 잃어도 통과한다(주입이 잡았다). 격자 컴포넌트 본문만 본다.
const ph = phFile.slice(phFile.indexOf('export default function DealCardPlaceholder'), phFile.indexOf('export function DealRowPlaceholder'))

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
    // 🧾 2026-10-31 (Y2): PC 는 격자 자리(`DealCardPlaceholder`), 모바일은 한 줄 자리(`DealRowPlaceholder`).
    expect(s.match(/<DealCardPlaceholder\b/g)?.length).toBeGreaterThanOrEqual(1)
    expect(s.match(/<DealRowPlaceholder\b/g)?.length).toBeGreaterThanOrEqual(1)
    expect(s).not.toMatch(/h-\[13px\]/)
  })
})

describe('② 자리 카드 = 진짜 카드의 줄 구조', () => {
  const rows: Array<[string, RegExp, RegExp]> = [
    ['사진 비율', /'aspect-\[4\/3\]'/, /aspect-\[4\/3\]/], // 🧾 2026-10-31: 격자/한 줄 삼항이 됐다(격자 쪽 값)
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
    expect(phFile).not.toMatch(/GroupBuyFeedCard/)
  })
  it('스크린리더에 안 읽힌다', () => {
    expect(ph.length).toBeGreaterThan(200)
    expect(phFile).toMatch(/aria-hidden="true"/)
  })
})

describe('④ 한 줄 자리(Y2) = 진짜 한 줄 카드와 같은 상수', () => {
  // 🧾 2026-10-31 (대표 확정 Y2): 본문 높이가 120 으로 고정이라 같은 상수만 쓰면 자리와 진짜 줄의 높이가 언제나 같다.
  it('줄·사진칸·사진 모양·본문·하단 줄을 HOME_ROW_CLS 로 세운다', () => {
    const rowPh = phFile.slice(phFile.indexOf('export function DealRowPlaceholder'))
    expect(rowPh.length).toBeGreaterThan(200)
    for (const k of ['link', 'thumb', 'mediaAspect', 'mediaBox', 'body', 'foot']) {
      expect(rowPh, k).toContain(`HOME_ROW_CLS.${k}`)
      expect(card, `카드도 ${k}`).toContain(`HOME_ROW_CLS.${k}`)
    }
  })
  it('본문 높이가 사진과 같은 120 으로 고정돼 있다(줄마다 높이가 갈리지 않는다)', async () => {
    const { HOME_ROW_CLS } = await import('@/shared/home-row')
    expect(HOME_ROW_CLS.body).toMatch(/\bh-\[120px\]/)
    expect(HOME_ROW_CLS.thumb).toMatch(/\bw-\[120px\]/)
    expect(HOME_ROW_CLS.mediaAspect).toBe('aspect-square')
  })
})
