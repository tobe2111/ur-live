/**
 * 🗺️ 지도 위 UI B안 계약 (2026-09-02 대표 확정 — "B안으로 진행해줘")
 *
 * 대표 신고 두 건에서 왔다: "이거 색깔 말이야 눈에 잘 안들어오지 않아?"(카테고리 칩) ·
 * "이 버튼도 눌렀는지 안눌렀는지 확인도 안돼"(현위치 버튼). 원인은 색이 아니라 자리 — 카카오 지도 타일은
 * 다크 모드에서도 밝은데 그 위 UI 가 앱 테마를 따라 남색이 됐고, 선택 상태는 테두리 한 겹뿐이었다.
 *
 * 지키는 것:
 *   ① 지도 위 오버레이 칩·검색바·현위치 버튼은 **테마를 따르지 않는다**(흰 표면 고정, `light-fixed`)
 *   ② 선택·활성 = **브랜드 블루 면**(테두리 아님) — 칩·내 주변·필터·현위치 버튼 전부
 *   ③ 칩 아이콘 = 유어딜 선 아이콘(voucher-types `icon`), 이모지 0
 *   ④ 핀 링은 잉크 하나 + 선택/라이브만 블루 — 카테고리별 팔레트(핑크·에메랄드…)로 되돌아가지 않는다
 *   ⑤ 오늘의 핫딜 카드: 할인율은 사진 위가 아니라 가격 줄에, 카드 테두리 0
 * 못 막는 것: 실제 지도 위에서 어떻게 보이는지 — `node scripts/visual-preview.mjs --route=/ --deals` 로 본다
 * (카카오 SDK 는 차단되므로 타일 없이 UI 만 뜬다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8')
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const TOPBAR = 'src/pages/restaurant-map/MapTopBar.tsx'
const DEFS = 'src/pages/restaurant-map/voucher-types.ts'
const PAGE = 'src/pages/RestaurantMapPage.tsx'
const PINS = 'src/pages/restaurant-map/map-overlays.ts'
const SHEET = 'src/pages/restaurant-map/SheetFilterBar.tsx'

describe('① 지도 위 오버레이는 테마를 따르지 않는다', () => {
  const s = code(read(TOPBAR))
  it('오버레이 표면 상수가 흰색 고정이고 dark: 를 갖지 않는다', () => {
    const m = s.match(/const OVERLAY_SURF = '([^']+)'/)
    expect(m, 'OVERLAY_SURF 상수가 사라졌다').toBeTruthy()
    expect(m![1]).toMatch(/\bbg-white\b/)
    expect(m![1]).not.toMatch(/dark:/)
  })
  it('오버레이 칩이 OVERLAY_SURF/OVERLAY_ON 을 쓴다(패널만 테마)', () => {
    expect(s).toMatch(/\$\{chipBase\} \$\{on \? OVERLAY_ON : surf\}/)
    expect(s).toMatch(/const surf = panel \? PANEL_SURF : OVERLAY_SURF/)
  })
})

describe('② 선택·활성 = 브랜드 블루 면', () => {
  it('칩·내 주변·필터의 켜짐이 bg-brand 면이다(잉크 면·테두리 아님)', () => {
    const s = code(read(TOPBAR))
    expect(s).toMatch(/const OVERLAY_ON = 'bg-brand text-white/)
    expect(s).not.toMatch(/bg-gray-900 text-white border-blue-600/)
  })
  it('현위치 버튼: 켜짐·측위 중 = bg-brand + 흰 아이콘, 꺼짐 = 흰 원(테마 무관)', () => {
    const s = code(read(PAGE))
    expect(s).toMatch(/\(nearMeMode \|\| locating\) \? 'bg-brand text-white' : 'bg-white text-gray-800'/)
  })
  it('시트 안 칩도 같은 규칙(bg-brand 면)', () => {
    const s = code(read(SHEET))
    expect(s).toMatch(/voucherType === v\.key\s*\?\s*'bg-brand text-white'/)
  })
})

describe('③ 칩 아이콘 = 유어딜 선 아이콘, 이모지 0', () => {
  it('voucher-types 에 emoji 필드가 없고 icon 이 있다', () => {
    const s = code(read(DEFS))
    expect(s).not.toMatch(/emoji/)
    expect(s).toMatch(/icon: GridIcon/)
    expect(s).toMatch(/icon: TicketStubIcon/)
  })
  it('MapTopBar·SheetFilterBar 가 <v.icon /> 으로 그린다', () => {
    expect(code(read(TOPBAR))).toMatch(/<v\.icon size=/)
    expect(code(read(SHEET))).toMatch(/<v\.icon size=/)
  })
  it('urdeal-icons 가 칩 아이콘 4개를 export', () => {
    const s = read('src/components/icons/urdeal-icons.tsx')
    for (const n of ['GridIcon', 'MealLineIcon', 'BeautyLineIcon', 'StayLineIcon']) expect(s).toMatch(new RegExp(`export const ${n} =`))
  })
})

describe('④ 핀 링 = 잉크 하나 + 선택/라이브 블루', () => {
  const s = code(read(PINS))
  it('카테고리 팔레트가 없다', () => {
    expect(s).not.toMatch(/#ec4899|#10b981|#8b5cf6|#f59e0b|categoryColor|categoryEmoji/i)
  })
  // 🗺️ 2026-09-09 (안 D4): 핀이 원형 사진+링 → **알약**이 되면서 `ring` 변수는 사라졌다.
  //   지키려던 것은 변수 이름이 아니라 *"강조색은 브랜드 하나, 자리는 선택뿐"* 이라는 규칙이므로
  //   그 규칙 자체로 다시 겨눈다(테스트를 지우는 것과 다르다 — 계약은 그대로 살아 있다).
  //   `isLive` 는 라이브커머스 영구중단으로 항상 빈 Set 이라 09-09 에 제거됐다.
  it('브랜드 색은 선택(면)·즐겨찾기(선)에만 — 카테고리·평점 등으로 번지지 않는다', () => {
    const brandUses = [...s.matchAll(/PIN_RING_BRAND/g)].length
    expect(brandUses, 'PIN_RING_BRAND 가 사라졌다').toBeGreaterThan(0)
    // 선택 알약 배경 + 즐겨찾기 윤곽선. 그 밖에서 브랜드가 쓰이기 시작하면 자리가 늘어난 것이다.
    expect(brandUses, `브랜드 색 사용처가 ${brandUses}곳으로 늘었다`).toBeLessThanOrEqual(3)
    expect(s).toMatch(/isFav && !isSelected \? `outline:1\.5px solid \$\{PIN_RING_BRAND\}/)
  })
  it('무게 3단계가 pinTierStyle 한 곳에서 나온다(호출부가 색을 따로 정하지 않는다)', () => {
    expect(s).toMatch(/export function pinTierStyle\(tier: MapMarkerTier\)/)
    for (const t of ['selected', 'seen', 'highlight']) expect(s).toContain(`tier === '${t}'`)
  })
  it('버블·핀 폴백에 이모지·그라디언트가 없다', () => {
    expect(s).not.toMatch(/linear-gradient\(135deg/)
    expect(s).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })
})

/**
 * ⑤ **'오늘의 핫딜'은 지도에서 제거됐다** (2026-09-08 대표 *"거리순이 가장 우선이야"* ·
 *   *"오늘의 핫딜은 원래 없었지 않아? 왜 생긴거지?"*).
 *
 * 여기 있던 검사들은 그 캐러셀의 **생김새**를 고정하고 있었다(할인율 자리·테두리 0·이모지 0).
 * 캐러셀이 사라졌으니 그 계약도 갈 곳이 없다 — 지우는 대신 **"되살아나지 않는다"로 재조준**한다.
 *
 * ## 왜 없앴나 (셋 다 실측)
 * ① **거리순을 가로챘다** — 시트는 거리순인데 그 위에 할인율순 다섯 장이 먼저 서 있었다.
 * ② **바로 아래 첫 줄과 겹쳤다** — 거리 1등과 할인 1등이 같으면 한 화면에 같은 카드가 두 번.
 *    홈에서 2026-09-06 에 고친 "같은 이용권이 두 번"과 같은 클래스인데 지도엔 그 처방이 안 갔다.
 * ③ **"5곳"이 전체에서 고른 게 아니었다** — 2026-09-03 수요 로딩 이후 화면은 가까운 50개만 갖고 있다.
 *    위에 "338곳"이라 적혀 있어도 실제로는 그 50개 중 top 5 였다.
 *
 * ⚠️ 이 테스트가 못 막는 것: **다른 이름의 같은 물건**(예: '지금 뜨는 딜')을 새로 얹는 것.
 *   막는 것은 이 컴포넌트·이 배선의 부활까지다.
 */
describe('⑤ 지도 시트 맨 위는 거리순이 갖는다', () => {
  const map = code(read(PAGE))
  it('핫딜 캐러셀이 되살아나지 않았다', () => {
    expect(map, 'HeroCarousel 배선이 돌아왔다').not.toMatch(/<HeroCarousel/)
    expect(map, '할인율 TOP5 파생이 돌아왔다').not.toMatch(/const heroDeals =/)
    expect(fs.existsSync(path.join(process.cwd(), 'src/pages/restaurant-map/HeroCarousel.tsx')),
      '컴포넌트 파일이 돌아왔다').toBe(false)
  })
})
