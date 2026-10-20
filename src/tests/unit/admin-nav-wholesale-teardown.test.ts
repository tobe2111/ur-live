/**
 * 🧨 **어드민 nav — 도매 철거 가시성** 〔2026-08-03 대표 "도매몰은 잔재도 없애는거야"〕
 *
 * 릴리즈 체크리스트 **A6**(*"도매 잔재가 안 보인다 — 어드민 메뉴에 도매 항목 0"*)의 **안전한 절반**을 고정한다.
 * 나머지 절반(화면·라우트 삭제)은 철거 계획 §4 머니 게이트 통과 후 **별도 PR** 이다.
 *
 * ## 이 테스트가 실제로 막는 것
 * - R1 소비자 도메인에서 도매 밴드가 **안 보인다** (그 API 는 이 배포에 없다 — 이미 죽은 링크였다)
 * - R2 도매 도메인에서는 **그대로 보인다** — 🔴 여기가 핵심이다. 머니 게이트 확인 경로
 *   `/admin/wholesale-overview` 가 살아 있어야 대표가 예치금 잔액을 보고 환급할 수 있다.
 *   전역 플래그로 숨겼다면 **돌려줄 경로까지 숨기는** 사고가 된다.
 * - R3 **몰 관리는 도매 밴드에 없다** — `urdeal.kr/{슬러그}`(소비자 표면)를 정하는 화면이라
 *   도매와 함께 숨겨지면 파일럿 몰을 만들 수 없다. 같은 날 API 도 도매 번들 밖으로 옮겼다.
 * - R4 도매와 무관한 별개 사업(해외 바이어 풀)은 **도매 밴드에 들어가지 않는다** — 함께 사라지면 안 된다.
 *
 * ⚠️ **못 막는 것**: 실제 배포 호스트에서의 렌더. `isUtongstart()` 는 `window.location` 을 읽으므로
 *   여기서는 jsdom 호스트를 바꿔 판정 함수만 검증한다. 도매 배포가 `utongstart.com` 도
 *   `*wholesale*` 도 아닌 호스트에 붙으면 `?wholesale=1` 로 열어야 한다(함수 주석).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { NAV_GROUPS, VISIBLE_NAV_GROUPS, isWholesaleAdminSurface, withoutWholesaleOnConsumer } from '@/components/admin/admin-nav-config'

/** jsdom 호스트 교체 — `window.location.hostname` 은 직접 대입이 안 되므로 정의를 갈아끼운다. */
function setHost(hostname: string, search = '') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname, search },
  })
}
const CONSUMER = 'urdeal.kr'
afterEach(() => setHost(CONSUMER))

const wholesaleGroups = (gs: typeof NAV_GROUPS) => gs.filter((g) => g.domain === 'wholesale')

describe('🔴 R1 — 소비자 도메인에선 도매 밴드가 안 보인다', () => {
  for (const host of [CONSUMER, 'www.urdeal.kr', 'live.ur-team.com', 'ur-live.pages.dev']) {
    it(`${host} → 도매 그룹 0`, () => {
      setHost(host)
      expect(isWholesaleAdminSurface()).toBe(false)
      expect(wholesaleGroups(withoutWholesaleOnConsumer(VISIBLE_NAV_GROUPS))).toEqual([])
    })
  }

  it('숨겨도 소비자 그룹은 그대로 남는다(nav 가 통째로 비지 않는다)', () => {
    setHost(CONSUMER)
    const kept = withoutWholesaleOnConsumer(VISIBLE_NAV_GROUPS)
    expect(kept.length).toBeGreaterThan(3)
    expect(kept.some((g) => g.title === '🎟️ 이용권')).toBe(true) // 2026-10-20 '🏪 오프라인 공구' → '🎟️ 이용권'
  })
})

describe('🔴 R2 — 도매 도메인에선 그대로 보인다 (머니 게이트 확인 경로)', () => {
  for (const host of ['utongstart.com', 'www.utongstart.com', 'ur-wholesale.pages.dev']) {
    it(`${host} → 도매 그룹 유지`, () => {
      setHost(host)
      expect(isWholesaleAdminSurface()).toBe(true)
      expect(withoutWholesaleOnConsumer(VISIBLE_NAV_GROUPS)).toEqual(VISIBLE_NAV_GROUPS)
    })
  }

  it('`?wholesale=1` 탈출구가 산다', () => {
    setHost(CONSUMER, '?wholesale=1')
    expect(isWholesaleAdminSurface()).toBe(true)
  })

  /**
   * 🔁 **2026-10-11 재조준 — 이 단언은 이제 반대를 주장하고 있었다.**
   *
   * 종전: *"예치금 잔액을 볼 수 있는 화면(`/admin/wholesale-overview`)이 도매 도메인에 남아 있다"*.
   * 지키려던 것은 **"머니 게이트가 열려 있는 동안 환급 경로를 숨기지 말라"** 였다(계획 §4).
   *
   * 대표 지시로 철거를 실행하면서 그 게이트를 실측했고 **닫혔다**:
   *   · `wholesale_deposits` 172,800원 → 주인 `sellers.id 5·13` 이 **존재하지 않는다**(0행)
   *   · `wholesale_deposit_requests` 2건 **전부 confirmed** (미확인 0)
   *   · `supplier_settlements` pending 1건(10,000원) — 테스트 주문 2건과 **같은 날·같은 시각**(2026-06-29)
   * ⇒ 남의 돈이 아니라 테스트 한 번의 잔재다(대표 2026-08-03 *"아예 사업을 안했거든"* 과 일치).
   *
   * 그래서 화면 존재를 요구하는 단언은 폐기하고, **철거가 실제로 됐는지**를 대신 지킨다.
   * ⚠️ 테이블은 지우지 않았다(계획 §3 — 회계 증빙). 데이터는 그대로 있고 **노출만** 끊었다.
   */
  it('🧨 철거 완료 — 도매 화면이 어느 도메인에서도 nav 에 없다', () => {
    for (const host of ['utongstart.com', CONSUMER]) {
      setHost(host)
      const paths = withoutWholesaleOnConsumer(VISIBLE_NAV_GROUPS).flatMap((g) => g.items.map((i) => i.path))
      expect(paths).not.toContain('/admin/wholesale-overview')
      expect(paths.filter((p) => /^\/admin\/(wholesale|distributor|suppliers)/.test(p) && p !== '/admin/wholesale-malls'))
        .toEqual([])
      // 🏬 몰 관리는 공구 서비스다 — 함께 사라지면 안 된다(R3 와 같은 이유).
      expect(paths).toContain('/admin/wholesale-malls')
    }
  })
})

describe('🔴 R3 — 몰 관리는 도매 밴드에 없다', () => {
  it('`/admin/wholesale-malls` 가 `domain: wholesale` 그룹에 없다', () => {
    const inWholesale = wholesaleGroups(NAV_GROUPS).flatMap((g) => g.items.map((i) => i.path))
    expect(inWholesale).not.toContain('/admin/wholesale-malls')
  })

  it('소비자 도메인에서 몰 관리가 **보인다** (파일럿 몰을 여기서 만든다)', () => {
    setHost(CONSUMER)
    const paths = withoutWholesaleOnConsumer(VISIBLE_NAV_GROUPS).flatMap((g) => g.items.map((i) => i.path))
    expect(paths).toContain('/admin/wholesale-malls')
  })
})

describe('🔴 R4 — 도매가 아닌 별개 사업은 도매 밴드에 넣지 않는다', () => {
  // 철거 계획 §1(b): `features/supply` 안에 있지만 도매몰과 무관하다. 함께 걷히면 안 된다.
  it('해외 바이어 풀이 도매 밴드 밖이다', () => {
    const inWholesale = wholesaleGroups(NAV_GROUPS).flatMap((g) => g.items.map((i) => i.path))
    expect(inWholesale).not.toContain('/admin/buyer-pool')
    // 🧨 2026-10-20 대표 "지워줘" — 해외 바이어 풀은 메뉴에서도 사라졌다(되살아나지 않는다).
    expect(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path))).not.toContain('/admin/buyer-pool')
  })
})
