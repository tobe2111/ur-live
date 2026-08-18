import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  NAV_GROUPS, NAV_SECTIONS, navSectionOf, ALWAYS_ALLOWED_ADMIN_PATHS,
  type NavSectionKey,
} from '@/components/admin/admin-nav-config'

/**
 * 🧭 **어드민 nav — 분류가 맞는가** 〔2026-08-16 대표 *"카테고리 페이지들 분류를 제대로 할 필요가 있어"*〕
 *
 * 2026-08-14 에 공구 서비스 밴드를 만들며 *"서비스가 넷이면 밴드도 넷"* 이라고 적었는데,
 * 실측해 보니 **넷째(유어애즈)가 밴드를 못 받고 있었다.** 원인은 사람의 누락이 아니라 구조다 —
 * `navSectionOf` 가 그룹 **제목을 문자열로 맞춰보고** 안 맞으면 조용히 `'common'` 으로 떨어뜨렸다.
 * 즉 **아무것도 안 하면 공통 서랍으로 빨려 들어가는** 기본값이었고, 그래서 유어애즈가
 * '⚙️ 공통 · 회원·재무·검증·시스템' 라벨 아래 렌더됐다.
 *
 * 같은 실측에서 함께 나온 것:
 *   - 유어딜 전용 상권 화면 5개가 '운영'(전사 상황판)과 '검증/CS'(공통) 에 흩어져 있었다.
 *   - 라우트는 있는데 nav 에 없어 **URL 로만 도달**하던 화면 3개(제조사 풀·송장 일괄·카카오 로그인 진단).
 *   - nav 에는 있는데 **라우트도 페이지도 없는** 항목 2개(라이브 모니터·캐스팅).
 *
 * ## 이 파일이 막는 것
 *   - R1 밴드는 **선언**이다 — 폴백으로 정해지지 않는다
 *   - R2 라우트가 nav 에서 도달 가능하다 (고아 화면 = 만들어 놓고 아무도 못 찾는 화면)
 *   - R3 nav 가 **실재하는** 화면만 가리킨다 (죽은 링크)
 *   - R4 단일 서비스 전용 화면이 공통/전사 서랍에 눌러앉지 않는다
 *
 * ⚠️ **못 막는 것**: "이 화면이 정말 그 서비스 것인가" 라는 판단 자체. 여기서 고정한 건
 *   *이미 내린 판정*이고, 새 화면의 소속은 여전히 사람이 정한다. 그리고 실제 렌더(밴드 헤더가
 *   화면에 보이는지)는 `AdminLayout` 의 JSX 라 이 테스트 밖이다 — 여기서는 데이터·판정 함수만 본다.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const ADMIN_ROUTES_FILE = 'src/routes/admin.routes.tsx'

/** `<Route path="/admin/...">` 에서 경로만. */
const declaredRoutes = (): string[] => {
  const src = read(ADMIN_ROUTES_FILE)
  const hits = src.match(/path="\/admin[^"]*"/g) ?? []
  return [...new Set(hits.map((h) => h.slice(6, -1)))]
}
/** nav 가 도달시키는 경로 — 주항목 + `also`(탭으로 흡수된 딥링크). 쿼리는 떼고 본다. */
const navReachable = (): Set<string> =>
  new Set(NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => [i.path, ...(i.also ?? [])])).map((p) => p.split('?')[0]))

/**
 * nav 에 없어도 되는 라우트 — **이유가 있는 것만.** 여기 추가하려면 이유를 한 줄 적을 것
 * (적을 이유가 없으면 그건 고아지 예외가 아니다).
 */
const NOT_IN_NAV_OK: Record<string, string> = {
  '/admin/login': '로그인 화면 — nav 는 로그인 후에만 보인다',
  '/admin/2fa': '강제 보안 게이트 — ALWAYS_ALLOWED_ADMIN_PATHS 로 역할 무관 도달',
  '/admin/cafe24/callback': 'OAuth 콜백 — 사람이 누르는 화면이 아니다',
  '/admin/kakao-test/callback': 'OAuth 콜백 — 사람이 누르는 화면이 아니다',
  '/admin/wholesale-integrity': '2026-06-17 의도적 강등 — 도매 통합 현황의 카드 링크로 진입',
}

describe('R1 — 밴드는 선언이다 (폴백으로 정해지지 않는다)', () => {
  const sectionKeys = new Set<NavSectionKey>(NAV_SECTIONS.map((s) => s.key))

  it('🔴 모든 그룹이 `section` 을 **직접** 선언한다', () => {
    for (const g of NAV_GROUPS) {
      expect(g.section, `'${g.title}' 이 밴드를 선언하지 않았다`).toBeTruthy()
      expect(sectionKeys.has(g.section), `'${g.title}' 의 밴드 '${g.section}' 가 NAV_SECTIONS 에 없다`).toBe(true)
    }
  })

  it('🔴 `navSectionOf` 는 선언값을 그대로 돌려준다 — 제목을 보지 않는다', () => {
    for (const g of NAV_GROUPS) expect(navSectionOf(g)).toBe(g.section)
    // 제목만 바꿔도 밴드가 따라 움직이면(옛 구현) 라벨 수정이 조용한 재분류가 된다.
    const renamed = { ...NAV_GROUPS[0], title: '제목을 완전히 바꿔본다' }
    expect(navSectionOf(renamed)).toBe(NAV_GROUPS[0].section)
  })

  it('🔴 서비스 넷이 각자 밴드를 갖는다 — 유어애즈 포함', () => {
    for (const key of ['urdeal', 'mall', 'ads', 'wholesale'] as const) {
      expect(NAV_SECTIONS.some((s) => s.key === key), `밴드 '${key}' 미정의`).toBe(true)
      // 🔎 `navSectionOf` 경유 — `AdminLayout` 이 부르는 그 함수다(데이터만 맞고 함수가 틀리면 화면은 여전히 어긋난다).
      expect(NAV_GROUPS.some((g) => navSectionOf(g) === key), `밴드 '${key}' 에 그룹이 하나도 없다`).toBe(true)
    }
  })

  it('🔴 유어애즈 그룹이 공통 밴드에 있지 않다', () => {
    const ads = NAV_GROUPS.find((g) => g.title.includes('유어애즈'))
    expect(ads, '유어애즈 그룹이 없다').toBeTruthy()
    expect(navSectionOf(ads!)).toBe('ads')
  })

  it('🔴 RBAC 축(`domain`)과 렌더 축(`section`)이 어긋나지 않는다', () => {
    // 두 축은 다르지만, 도매 도메인 그룹이 다른 밴드에 그려지면 화면과 권한이 갈린다.
    for (const g of NAV_GROUPS.filter((x) => x.domain === 'wholesale')) {
      expect(g.section, `'${g.title}'`).toBe('wholesale')
    }
  })
})

describe('R2 — 만들어 놓고 못 찾는 화면이 없다', () => {
  it('🔴 모든 어드민 라우트가 nav 에서 도달 가능하다', () => {
    const reachable = navReachable()
    const orphans = declaredRoutes().filter((r) => !reachable.has(r) && !(r in NOT_IN_NAV_OK))
    expect(orphans, `nav 어디에도 없어 URL 직접 입력으로만 열리는 화면:\n${orphans.join('\n')}`).toEqual([])
  })

  it('예외 목록이 낡지 않았다 — 이미 nav 에 올라온 경로는 예외에서 빼라', () => {
    const reachable = navReachable()
    const stale = Object.keys(NOT_IN_NAV_OK).filter((p) => reachable.has(p))
    expect(stale, `nav 에 있는데 예외로도 남아 있다: ${stale.join(', ')}`).toEqual([])
  })

  it('강제 보안 경로는 예외로 명시돼 있다', () => {
    // `/admin/set-pin` 은 nav(시스템)에 있고 `/admin/2fa` 는 없다 — 후자가 예외에 있어야 한다.
    for (const p of ALWAYS_ALLOWED_ADMIN_PATHS) {
      expect(navReachable().has(p) || p in NOT_IN_NAV_OK, `${p} 도달 불가`).toBe(true)
    }
  })
})

describe('R3 — nav 가 실재하는 화면만 가리킨다', () => {
  it('🔴 죽은 링크 0 (라우트 없는 nav 항목)', () => {
    const routes = new Set(declaredRoutes())
    const dead = [...navReachable()].filter((p) => !routes.has(p))
    expect(dead, `라우트가 없는 nav 경로:\n${dead.join('\n')}`).toEqual([])
  })
})

describe('R4 — 단일 서비스 화면이 공통 서랍에 눌러앉지 않는다', () => {
  // 🔎 `g.section` 이 아니라 `navSectionOf` 로 읽는다 — 화면에 그려지는 밴드는 이 함수가 정한다.
  //   데이터만 검사하면 판정 함수가 옛 폴백으로 되돌아가도 초록이 뜬다(되돌려-검증에서 실제로 확인).
  const bandOf = (path: string): NavSectionKey | undefined => {
    const g = NAV_GROUPS.find((x) => x.items.some((i) => i.path.split('?')[0] === path))
    return g ? navSectionOf(g) : undefined
  }

  it('🔴 유어딜 상권/매장 5종이 유어딜 밴드에 있다', () => {
    // 발굴(밀도) → 리워드(방문·후기) → 페이백(쿠폰) → 성과(리포트) 는 하나의 루프다.
    for (const p of [
      '/admin/region-density', '/admin/visit-rewards', '/admin/kakao-reviews',
      '/admin/district-coupons', '/admin/district-report',
    ]) {
      expect(bandOf(p), `${p} 가 유어딜 밴드 밖(현재: ${bandOf(p)})`).toBe('urdeal')
    }
  })

  it('🔴 전사 상황판(`운영`)에는 특정 서비스 전용 화면이 없다', () => {
    const home = NAV_GROUPS.find((g) => g.section === 'home')!
    // 상권(district/region)은 유어딜 전용 — 여기로 되돌아오면 안 된다.
    for (const it of home.items) {
      expect(/\/(district|region)-/.test(it.path), `'${it.label}' 은 유어딜 전용인데 전사 상황판에 있다`).toBe(false)
    }
  })

  it('🔴 제조사 후보 풀은 도매 밴드다 — 유어애즈 풀과 같은 서랍에 두지 않는다', () => {
    // 페이지 헤더가 *"도매몰(유통스타트) 전용 — 유어애즈 파트너 풀과 격리된 테이블"* 이라고 선언한다.
    // 이름·위치가 buyer/partner-pool 과 닮아 유어애즈로 오분류하기 딱 좋은 자리다.
    expect(bandOf('/admin/maker-pool')).toBe('wholesale')
    expect(bandOf('/admin/partner-pool')).toBe('ads')
    expect(bandOf('/admin/buyer-pool')).toBe('ads')
  })

  it('🔴 공통 데스크에 남긴 단일 서비스 항목은 **라벨에 서비스를 밝힌다**', () => {
    // 2026-08-16 확정: 머니·CS 데스크는 한 큐로 처리하므로 `common` 에 두되, 이름이 다른 서비스와
    // 겹치는 항목은 라벨로 구분한다. `influencer_attributions` 는 전부 유어딜인데 '인플루언서' 라는
    // 말이 📣 유어애즈의 외부 수집 DB 와 겹쳐, 대표가 "어느 쪽이야?" 를 묻게 만들던 자리다.
    const labelOf = (p: string) =>
      NAV_GROUPS.flatMap((g) => g.items).find((i) => i.path === p)?.label ?? ''
    for (const p of ['/admin/influencer-payouts', '/admin/influencer-disputes']) {
      expect(labelOf(p), `${p} 라벨에 서비스 표시가 없다`).toMatch(/유어딜/)
    }
  })

  it('🔴 …그리고 **슈퍼 전용**이다 — 밴드만 옮기면 도매 파트너에게 403 빈화면이 된다', () => {
    // 짝으로 성립하는 결정이다: 도매 밴드(데이터 소속) + super-only(리드 DB 는 내부 자산 · API 가
    // 도매 RBAC 스코프 밖). 한쪽만 되돌리면 조용히 깨지므로 여기서 함께 고정한다.
    const layout = read('src/components/AdminLayout.tsx')
    const set = layout.match(/SUPER_ONLY_NAV\s*=\s*new Set\(\[([^\]]*)\]/)
    expect(set, 'SUPER_ONLY_NAV 를 못 찾았다 — 이름이 바뀌었으면 이 테스트도 함께 고칠 것').toBeTruthy()
    expect(set![1]).toContain('/admin/maker-pool')
  })
})
