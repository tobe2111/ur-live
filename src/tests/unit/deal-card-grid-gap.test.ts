/**
 * 📐 딜 카드 격자 간격 — 한 규칙 (2026-09-03 대표 확정 "안 1")
 *
 * 대표: *"약간 이용권 간의 세로폭이 있어야할 것 같은데"* — 실측해 보니 열·행이 똑같이 12px 인데
 * 카드 **안쪽** 줄 간격은 2~8px 이라, 판매가 바로 밑에서 다음 사진이 시작돼 카드 경계가 안 읽혔다.
 * 묶음을 알아보는 건 절대 거리가 아니라 **안팎의 차이**다.
 *
 * ⚠️ 이 카드는 홈·찜·유어샵·편성 섹션이 **같이 쓴다.** 격자마다 gap 을 손으로 적으면 화면마다
 *    간격이 갈린다 — 이 레포는 카드 자체로 이미 한 번 겪었다(홈 섹션 카드 ↔ 피드 카드 두 벌).
 *
 * ⚠️ 못 막는 것: 실제 렌더 픽셀. Tailwind 가 클래스를 어떻게 번역하는지는 여기서 안 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'

/** 딜 카드를 격자로 까는 화면들 — 새 화면을 만들면 여기에 더한다. */
const GRIDS = [
  'src/pages/main-home/GroupBuyFeed.tsx',
  'src/pages/WishlistPage.tsx',
  'src/components/home/HomeSections.tsx',
  'src/pages/seller-public/CuratorPinsSection.tsx',
  'src/pages/CuratorPage.tsx',
]

describe('딜 카드 격자 간격', () => {
  it('① 세로가 가로보다 넓다 (카드 안 여백과 구분되어야 카드가 끊긴다)', () => {
    const x = Number(DEAL_GRID_GAP.match(/(?:^|\s)gap-x-(\d+)/)?.[1])
    const y = Number(DEAL_GRID_GAP.match(/(?:^|\s)gap-y-(\d+)/)?.[1])
    expect(x, 'gap-x 가 있어야 한다').toBeGreaterThan(0)
    expect(y, 'gap-y 가 있어야 한다').toBeGreaterThan(0)
    expect(y, '세로가 가로보다 좁거나 같으면 원래 문제로 돌아간다').toBeGreaterThan(x)
    // 카드 안 가장 큰 여백이 8px(pt-2)이므로 세로는 그 두 배 이상이어야 "밖"으로 읽힌다.
    expect(y * 4, '세로 간격이 16px 이하면 카드 안 여백과 구분이 안 된다').toBeGreaterThanOrEqual(20)
  })

  it('② 가로는 좁게 유지한다 (열까지 벌리면 사진이 작아지고 화면이 허전해진다)', () => {
    const x = Number(DEAL_GRID_GAP.match(/(?:^|\s)gap-x-(\d+)/)?.[1])
    expect(x * 4).toBeLessThanOrEqual(16)
  })

  it('③ 격자들은 손으로 적지 않고 같은 상수를 쓴다', () => {
    // 🩸 처음 이 검사의 정규식은 `className="..."` 만 봤다. 그런데 상수를 쓰려면 형태가
    //    `className={`...`}` 로 바뀐다 — 즉 **고치자마자 검사가 통째로 헛돌았다**(되돌려-검증에서 발각).
    //    ⇒ `{` 를 허용하고, "찾은 격자가 0개면 통과가 아니라 실패"로 못 박는다.
    const GRID_CLASS = /className=\{?[`"'][^`"']*grid-cols-\d[^`"']*[`"']/g
    const bad: string[] = []
    let seen = 0
    for (const f of GRIDS) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(GRID_CLASS)) {
        seen++
        // 딜 카드 격자만 대상 — 간격을 손으로 적었는데 공용 상수가 없으면 그 화면만 갈린다.
        if (/\bgap[-xy]*-\d/.test(m[0]) && !m[0].includes('DEAL_GRID_GAP')) bad.push(`${f}: ${m[0].slice(0, 100)}`)
      }
    }
    expect(seen, '격자를 하나도 못 찾았다 — 파일이 옮겨졌거나 표기가 바뀌었다(검사가 무의미해진다)').toBeGreaterThanOrEqual(GRIDS.length)
    expect(bad, `딜 격자에 간격을 손으로 적었다:\n${bad.join('\n')}`).toEqual([])
  })
})
