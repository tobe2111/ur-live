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
const HERO = 'src/pages/restaurant-map/HeroCarousel.tsx'
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
  it('ring 은 isLive || isSelected 일 때만 브랜드', () => {
    expect(s).toMatch(/const ring = isLive \|\| isSelected \? PIN_RING_BRAND : PIN_RING_INK/)
  })
  it('버블·핀 폴백에 이모지·그라디언트가 없다', () => {
    expect(s).not.toMatch(/linear-gradient\(135deg/)
    expect(s).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })
})

describe('⑤ 오늘의 핫딜 카드', () => {
  const s = code(read(HERO))
  it('할인율이 사진 위(absolute) 배지가 아니라 가격 줄에 있다', () => {
    expect(s).not.toMatch(/absolute top-1\.5 left-1\.5 bg-brand/)
    expect(s).toMatch(/discount > 0 && <span className="text-brand-text/)
  })
  it('카드 테두리 0 · shadow-lift · 이모지 0', () => {
    expect(s).toMatch(/shadow-lift/)
    expect(s).not.toMatch(/border border-gray-100/)
    expect(s).not.toMatch(/[\u{1F300}-\u{1FAFF}]|⚡/u)
  })
})
