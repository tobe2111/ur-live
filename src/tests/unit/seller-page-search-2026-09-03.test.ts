/**
 * 🔎 **셀러 대시보드 페이지 검색** (2026-09-03 대표 *"셀러대시보드도 어드민 대시보드처럼
 * 페이지 검색이 필요해"*).
 *
 * 이 기능이 붙는 이유는 편의가 아니라 **오늘 실제로 난 사고** 때문이다 — 이용권 관리 페이지가
 * 존재하는데 사이드바에서 안 보여 대표가 "없다"고 판단했다. 셀러 라우트 64개 중 사이드바에 있는 건
 * 절반뿐이고, 나머지에 쓰는 화면이 섞여 있다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 렌더·키보드 동작(⌘K 는 브라우저 이벤트).
 *   여기서 고정하는 것은 **검색 대상 구성**과 **어드민과 같은 컴포넌트를 쓴다**는 것이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SELLER_SEARCH_ONLY, NAV_GROUPS } from '@/components/seller/seller-nav'

const LAYOUT = readFileSync('src/components/SellerLayout.tsx', 'utf8')
/** 주석 제거본 — 설명 주석에 남은 이름을 배선으로 세면 가짜 초록이 된다(오늘만 네 번째로 겪었다). */
const LAYOUT_CODE = LAYOUT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ADMIN = readFileSync('src/components/AdminLayout.tsx', 'utf8')
const ROUTES = readFileSync('src/routes/seller.routes.tsx', 'utf8')
const PALETTE = 'src/components/dashboard/CommandPalette.tsx'

describe('① 어드민과 같은 물건을 쓴다', () => {
  it('팔레트는 공용 컴포넌트 한 벌이다 — 복사하면 반드시 갈린다', () => {
    expect(() => readFileSync(PALETTE, 'utf8')).not.toThrow()
    for (const f of [LAYOUT, ADMIN]) {
      expect(f).toContain("from '@/components/dashboard/CommandPalette'")
      expect(f).toContain('<CommandPalette items={commandItems}')
    }
  })

  it('🔒 어드민 전용 사본이 다시 생기지 않았다', () => {
    let existed = true
    try { readFileSync('src/components/admin/AdminCommandPalette.tsx', 'utf8') } catch { existed = false }
    expect(existed).toBe(false)
  })
})

describe('② 셀러 쪽 배선', () => {
  it('⌘K / Ctrl+K 로 열린다', () => {
    expect(LAYOUT).toMatch(/metaKey \|\| e\.ctrlKey/)
    expect(LAYOUT).toMatch(/key\.toLowerCase\(\) === 'k'/)
  })

  it('🔒 눈에 보이는 진입점도 있다 — 단축키만 있으면 아무도 모른다', () => {
    expect(LAYOUT).toContain('setPaletteOpen(true)')
    expect(LAYOUT).toContain("t('seller.pageSearch'")
  })

  it('🔒 검색 대상이 사이드바의 복사본이 아니다 — 그러면 못 찾던 페이지는 여전히 못 찾는다', () => {
    expect(LAYOUT_CODE).toContain('...SELLER_SEARCH_ONLY.map(')  // 실제로 목록을 펼쳐 담는가
    expect(SELLER_SEARCH_ONLY.length).toBeGreaterThan(5)
  })
})

describe('③ 검색 전용 목록이 성립한다', () => {
  const navPaths = new Set(NAV_GROUPS.flatMap(g => g.items).map(i => i.path))

  it('전부 실제 라우트다 — 없는 곳으로 보내면 404 다', () => {
    for (const it of SELLER_SEARCH_ONLY) expect(ROUTES).toContain(`path="${it.path}"`)
  })

  it('🔒 사이드바에 이미 있는 항목과 겹치지 않는다 — 겹치면 검색 결과가 두 줄로 뜬다', () => {
    for (const it of SELLER_SEARCH_ONLY) expect(navPaths.has(it.path)).toBe(false)
  })

  it('🔒 통과 화면(로그인·콜백·대기)은 넣지 않는다 — 갈 데가 아니다', () => {
    for (const it of SELLER_SEARCH_ONLY) {
      expect(it.path).not.toMatch(/login|register|signup|callback|reset-password|forgot-password|waiting|relink/)
    }
  })

  it('라벨 키와 폴백을 둘 다 갖는다 — 번역 누락 시 빈 줄이 뜨면 안 된다', () => {
    for (const it of SELLER_SEARCH_ONLY) {
      expect(it.labelKey.startsWith('seller.')).toBe(true)
      expect(it.fallback.length).toBeGreaterThan(0)
    }
  })
})
