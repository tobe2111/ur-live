/**
 * 🏠 홈 `?category=` 에서는 서버가 "전체" 홈 첫 화면을 그리지 않는다 (2026-11-10).
 *
 * 🩸 라이브 실측(폰 4G · CPU 4배) `/?category=meal_voucher` CLS 0.83 — 워커는 쿼리를 안 보고 전체 홈(지역 사진 머리 + 첫 섹션)을
 *   그렸고, 앱은 카테고리를 고르면 그 편성을 숨긴다 → 마운트 때 화면이 통째로 바뀌었다.
 *
 * ⚠️ 못 보는 것: 실제 밀림 수치(라이브 `vitals` 로 잰다) · 카테고리 화면 자체의 첫 화면(이 수리는 "틀린 그림을 안 그린다" 까지다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOME_CATEGORY_KEYS, homeCategoryOf } from '@/shared/home-query'
import { HOME_CATEGORY_KEYS as SCREEN_KEYS } from '@/pages/main-home/useHomeQuerySync'

const WORKER = readFileSync('src/worker/index.ts', 'utf8') // raw — 워커는 주석 제거기를 쓰지 않는다
const HOOK = readFileSync('src/pages/main-home/useHomeQuerySync.ts', 'utf8')
const MOBILE = readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8')

describe('홈 ?category= 판정', () => {
  it('화면이 받아들이는 카테고리면 그 값을 돌려준다', () => {
    for (const k of HOME_CATEGORY_KEYS) {
      if (k === 'all') continue
      expect(homeCategoryOf(`?category=${k}`)).toBe(k)
      expect(homeCategoryOf(`?utm_source=kakao&category=${k}&sort=newest`)).toBe(k)
    }
  })

  it('전체·없음·모르는 값은 null — 그때는 종전대로 첫 화면을 그린다', () => {
    expect(homeCategoryOf('')).toBeNull()
    expect(homeCategoryOf('?category=all')).toBeNull()
    expect(homeCategoryOf('?category=')).toBeNull()
    expect(homeCategoryOf('?category=nope')).toBeNull()
    expect(homeCategoryOf('?sort=newest')).toBeNull()
    expect(homeCategoryOf('?utm_source=kakao&fbclid=abc')).toBeNull()
  })

  it('화면 훅과 워커가 같은 목록을 읽는다(한쪽만 늘면 새 카테고리에서 다시 밀린다)', () => {
    expect([...SCREEN_KEYS]).toEqual([...HOME_CATEGORY_KEYS])
    expect(HOOK).toContain("from '@/shared/home-query'")
    expect(HOOK).toContain('[...SHARED_HOME_CATEGORY_KEYS]')
  })

  it('워커의 폰 홈 첫 화면 분기가 카테고리 쿼리를 제외한다', () => {
    expect(WORKER).toContain("ssrSlot === 'MAIN' && ssrExtraPayload && isMainPage && shouldRenderMobileFirstScreen(c.req.header('user-agent')) && !homeCategoryOf(url.search)) {")
    expect(WORKER).toContain("import { homeCategoryOf } from '../shared/home-query'")
  })

  it('전제 — 폰 홈은 여전히 "전체" 일 때만 편성을 그린다(이 전제가 바뀌면 이 수리를 다시 볼 것)', () => {
    expect(MOBILE).toMatch(/category === 'all'/)
  })
})
