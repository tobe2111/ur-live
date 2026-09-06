/**
 * 🎟️ **이용권을 만들 수 있는 사람은 그것을 관리할 수도 있어야 한다** (2026-09-03 대표 신고).
 *
 * 대표: *"이용권 관리에 대한 통합 페이지가 따로 없어보여. 셀러 대시보드 왼쪽 카테고리에도 없지 않아?"*
 * 그리고 같은 뿌리에서 나온 두 신고: *"이용권 수정도 안되는구나?"* · *"이용권 관리가 되어야 할 것 같은데?"*
 *
 * 페이지는 **있었다**(`/seller/group-buy`). 문제는 닿을 수 없었다는 것이고, 원인이 셋이었다:
 *   ① 그룹 전체가 `mode: 'store'` → `store_owner` 가 아닌 셀러에겐 통째로 숨김.
 *      그런데 **등록은 `common`** 이라 "만들 수는 있는데 그 뒤가 없는" 상태가 됐다.
 *   ② 매장 단독 셀러의 심플 nav 에선 이름이 **"내 딜"** — 찾는 단어가 아니었다.
 *   ③ `/seller/voucher-orders` 는 링크가 어디에도 없는 고아 페이지였다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 렌더(권한·심플모드 분기는 SellerLayout 이 한다)와
 *   서버 권한. 여기서 고정하는 것은 **nav 정의의 도달 가능성**이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NAV_GROUPS } from '@/components/seller/seller-nav'
import { publicSellerHandle, isAutoSellerUsername } from '@/shared/seller-handle'
import { SELLER_TAB_GROUPS, findSellerTabGroup, tabGroupSiblings } from '@/components/seller/seller-tab-groups'

const items = NAV_GROUPS.flatMap(g => g.items)
const byPath = (p: string) => items.find(i => i.path === p)
const SIMPLE = readFileSync('src/components/seller-layout/SellerSimpleNav.tsx', 'utf8')
/** 주석 제거본 — 옛 이름을 *설명하는 주석*까지 위반으로 세면 가짜 빨강이 된다(오늘 실제로 걸렸다). */
const SIMPLE_CODE = SIMPLE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const MANAGE_PAGE = readFileSync('src/pages/SellerGroupBuyPage.tsx', 'utf8')
// ⚠️ 셀러 라우트는 **두 파일에 흩어져 있다** — 대부분은 `routes/seller.routes.tsx` 인데
//   `/seller/proxy-products` 같은 일부는 `App.tsx` 에 남아 있다. 한쪽만 보면 '라우트 없음'
//   오판이 난다(이 테스트를 처음 짤 때 실제로 그렇게 틀렸다).
const ROUTES = readFileSync('src/routes/seller.routes.tsx', 'utf8') + readFileSync('src/App.tsx', 'utf8')
const LAYOUT = readFileSync('src/components/SellerLayout.tsx', 'utf8')

describe('① 등록과 관리는 같은 가시성 — 한쪽만 보이면 막다른 길이 된다', () => {
  const reg = byPath('/seller/meal-voucher/new')
  const manage = byPath('/seller/group-buy')

  it('둘 다 nav 에 있다', () => {
    expect(reg).toBeTruthy()
    expect(manage).toBeTruthy()
  })

  it('🔒 관리가 등록보다 좁은 조건으로 숨지 않는다', () => {
    // 이게 정확히 이번 사고다: 등록 common · 관리 store → 만들고 나면 갈 곳이 없었다.
    expect(manage!.mode ?? 'common').toBe(reg!.mode ?? 'common')
    expect(manage!.hideFor ?? []).toEqual(reg!.hideFor ?? [])
  })

  it('🔒 관리가 들어 있는 그룹도 역할로 숨지 않는다', () => {
    const group = NAV_GROUPS.find(g => g.items.some(i => i.path === '/seller/group-buy'))!
    expect(group.mode ?? 'common').toBe('common')
    expect(group.hideFor ?? []).toEqual([])
  })

  it('이용권 그룹이 홈 바로 다음에 온다 — 등록과 관리가 붙어 있어야 찾는다', () => {
    const order = LAYOUT.match(/const GROUP_ORDER = \[([^\]]*)\]/)![1]
    const keys = order.split(',').map(s => s.trim().replace(/'/g, ''))
    expect(keys[0]).toBe('')
    expect(keys[1]).toBe('seller.layout.vouchers')
  })
})

describe('② 한 페이지처럼 — nav 는 하나, 안에서 탭', () => {
  const manage = byPath('/seller/group-buy')!

  it('이용권 등록과 관리가 같은 묶음에 있다 (대표: "이용권 등록이랑 같이")', () => {
    const group = NAV_GROUPS.find(g => g.items.some(i => i.path === '/seller/group-buy'))!
    expect(group.items.map(i => i.path).slice(0, 2)).toEqual(['/seller/meal-voucher/new', '/seller/group-buy'])
  })

  it('🔒 이용권 탭 경로가 그 줄의 also 에 있다 — 없으면 그 탭에서 사이드바가 꺼져 길을 잃는다', () => {
    // (모든 묶음에 대한 같은 검사는 아래 ⑥ 에 있다 — 여기는 이용권 묶음만 본다.)
    const covered = new Set([manage.path, ...(manage.also ?? [])])
    for (const sib of tabGroupSiblings('/seller/group-buy')) expect(covered.has(sib)).toBe(true)
    expect(covered.has('/seller/products/')).toBe(true)  // 이용권 수정 화면
  })

  it('탭 경로가 실제 라우트다 — 탭만 있고 라우트가 없으면 404 다', () => {
    for (const g of SELLER_TAB_GROUPS) for (const t of g.tabs) expect(ROUTES, `라우트 없음: ${t.path}`).toContain(`path="${t.path}"`)
  })

  it('🔒 탭은 레이아웃 한 곳에서 그린다 — 페이지마다 붙이면 안 붙인 페이지가 생긴다', () => {
    // 2026-09-03: 대상 24개 화면 중 6개가 `DashboardPageHeader` 를 안 쓴다. 헤더/페이지에 붙이는
    // 방식이면 그 여섯에서 탭이 사라지고, 그중 `/seller/stores` 는 착지점이라 위임·운영자로 갈
    // 길이 통째로 없어진다 — 오늘 고친 "페이지는 있는데 닿을 수 없다"의 재발이다.
    expect(readFileSync('src/components/SellerLayout.tsx', 'utf8')).toContain('<SellerGroupTabs />')
  })

  it('🔒 교환권(KT 기프티콘) 이력은 이용권 탭이 아니다 — 교환권 ≠ 이용권(명칭 SSOT)', () => {
    // 이름이 비슷해 실제로 한 번 잘못 넣었다가 되돌렸다. 다시 들어오면 그 혼동이 화면에 박힌다.
    expect(findSellerTabGroup('/seller/voucher-orders')).toBeNull()
  })

  it('🔒 사이드바의 `also` 가 형제 경로에서 파생된다 — 손으로 적으면 반드시 갈린다', () => {
    // 어긋나면 탭으로 이동한 순간 사이드바 줄이 꺼져 사용자가 자기 위치를 잃는다.
    for (const g of SELLER_TAB_GROUPS) {
      const landing = g.tabs[0].path
      const item = items.find(i => i.path === landing)
      expect(item, `묶음 착지점이 사이드바에 없다: ${landing}`).toBeTruthy()
      for (const sib of tabGroupSiblings(landing)) {
        expect(item!.also ?? [], `${landing} 의 also 에 ${sib} 누락`).toContain(sib)
      }
    }
  })

  it('🔒 묶음에 든 화면은 사이드바에 따로 줄을 갖지 않는다 — 통폐합의 의미가 사라진다', () => {
    for (const g of SELLER_TAB_GROUPS) {
      for (const sib of g.tabs.slice(1)) {
        expect(items.find(i => i.path === sib.path), `${sib.path} 가 사이드바에 남아 있다`).toBeFalsy()
      }
    }
  })
})

describe('③ 심플 nav(매장 단독) — 이름이 하는 일과 같아야 한다', () => {
  it('🔒 "내 딜" 이라는 내부 표현을 쓰지 않는다', () => {
    // 대표가 "이용권 관리"를 찾는데 화면엔 "내 딜" 이라고 적혀 있었다.
    expect(SIMPLE_CODE).not.toContain('내 딜')
  })

  it('이용권 관리가 심플 nav 에도 있다', () => {
    expect(SIMPLE).toContain("path: '/seller/group-buy'")
    expect(SIMPLE).toContain('이용권 관리')
  })

  it('수정 화면에서도 이용권 관리가 활성으로 표시된다', () => {
    const line = SIMPLE.split('\n').find(l => l.includes("path: '/seller/group-buy'"))!
    expect(line).toContain('/seller/products/')
  })
})

describe('④ 관리 → 수정 진입점이 살아 있다', () => {
  it('관리 페이지에 수정 링크가 있다 — 이 버튼이 유일한 이용권 수정 진입점이다', () => {
    // `/seller/products`(목록)는 SELLER_STORE_ONLY_MODE 로 nav 에서 빠져 있어, 이 링크가 끊기면
    // 이용권을 수정할 방법이 화면에서 사라진다.
    expect(MANAGE_PAGE).toMatch(/navigate\(`\/seller\/products\/\$\{p\.id\}\/edit`\)/)
    expect(ROUTES).toContain('path="/seller/products/:id/edit"')
  })
})

describe('⑤ 자동 발급 셀러 아이디는 손님에게 안 보인다', () => {
  it('서버가 지어 준 아이디는 가린다', () => {
    expect(isAutoSellerUsername('store_mt9rvbhg1i6')).toBe(true)
    expect(publicSellerHandle('store_mt9rvbhg1i6')).toBeNull()
    expect(publicSellerHandle('store_01012345678')).toBeNull()  // 어드민 수기 등록형(번호 노출)
  })

  it('🔒 사람이 고른 아이디는 그대로 둔다 — 통째로 지우는 게 답이 아니다', () => {
    expect(publicSellerHandle('tobe2111')).toBe('tobe2111')
    expect(publicSellerHandle('jea1612')).toBe('jea1612')
    expect(isAutoSellerUsername('storyteller')).toBe(false)  // 'store' 로 시작해도 언더스코어 형식이 아니면 사람 것
  })

  it('빈 값은 줄을 그리지 않는다', () => {
    expect(publicSellerHandle('')).toBeNull()
    expect(publicSellerHandle(null)).toBeNull()
  })

  it('🔒 상세 화면이 raw seller_username 을 직접 그리지 않는다', () => {
    const detail = readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf8')
    expect(detail).not.toMatch(/>@\{detail\.seller_username\}/)
    expect(detail).toContain('publicSellerHandle(detail.seller_username)')
  })
})

describe('⑥ 통폐합 — 접은 화면이 사라지면 안 된다 (2026-09-03 대표 승인 "전부")', () => {
  const LAYOUT_SRC = readFileSync('src/components/SellerLayout.tsx', 'utf8')

  it('🔒 탭 안으로 접힌 형제 화면이 검색에 들어간다', () => {
    // 사이드바에서 사라진 화면을 검색에도 안 넣으면, 통폐합이 그대로 "못 찾는 페이지 16개"가 된다.
    // (`SellerLayout` 주석이 경고하는 바로 그 실패다 — 검색이 사이드바의 복사본이면 의미가 없다.)
    expect(LAYOUT_SRC).toContain('SELLER_TAB_GROUPS.flatMap')
  })

  it('사이드바 줄 수가 실제로 줄었다 — 묶음 수 + 낱개 항목', () => {
    // 36줄이 문제였다. 묶음이 8개고 각 묶음이 사이드바에서 한 줄이므로, 접힌 형제만큼 줄어든다.
    const folded = SELLER_TAB_GROUPS.reduce((n, g) => n + g.tabs.length - 1, 0)
    expect(folded).toBeGreaterThanOrEqual(15)
  })

  it('🔒 착지점은 반드시 첫 탭이다 — 사이드바가 가리키는 곳과 탭의 첫 칸이 달라지면 혼란', () => {
    for (const g of SELLER_TAB_GROUPS) {
      const landing = g.tabs[0].path
      expect(findSellerTabGroup(landing)).toBe(g)
    }
  })

  it('🔒 한 경로가 두 묶음에 속하지 않는다 — 탭 줄이 화면마다 달라진다', () => {
    const seen = new Set<string>()
    for (const g of SELLER_TAB_GROUPS) for (const t of g.tabs) {
      expect(seen.has(t.path), `중복: ${t.path}`).toBe(false)
      seen.add(t.path)
    }
  })
})

describe('⑦ 숨기는 것과 없애는 것은 다르다', () => {
  it('🔒 라이브 전용 화면이 nav 정의에 남아 있다 — 통폐합 때 실제로 빠뜨려 CI 가 잡았다', () => {
    /**
     * `LIVE_COMMERCE_SUSPENDED` 가 렌더에서 거르므로 **화면에는 안 뜬다**(위 ⑥ 의 12~13줄은 그대로).
     * 그런데 정의에서 지우면 라우트가 **어디에서도 닿을 수 없는 상태**가 되고, 라이브가 돌아오는 날
     * 조용히 사라진 채로 남는다. `check-orphan-routes` 가 이걸 잡아 준 것이 이 테스트의 이유다.
     */
    // 🌇 2026-09-04: `/seller/promote-boosts` 는 목록에서 뺐다 — **숨긴 게 아니라 삭제**했다.
    //    그 쿠폰은 에이전시만 발급할 수 있었고(에이전시 일몰) 라이브에서 쓰는 것이었다(영구 중단).
    //    라이브 실측 `promote_boost_coupons` 0행 — 되살릴 대상이 없다.
    for (const p of ['/seller/castings', '/seller/donations',
                     '/seller/streaming-guide', '/seller/notify-followers']) {
      const it_ = items.find(i => i.path === p)
      expect(it_, `라이브 전용 항목이 nav 정의에서 사라졌다: ${p}`).toBeTruthy()
      expect(it_!.mode, `${p} 는 live 모드여야 한다(안 그러면 화면에 뜬다)`).toBe('live')
    }
  })
})
