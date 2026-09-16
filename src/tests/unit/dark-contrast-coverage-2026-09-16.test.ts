import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../helpers/source-text'

/**
 * 🕯️ `scripts/check-dark-contrast.mjs` 의 **커버리지**를 고정한다.
 *
 * 그 가드는 브라우저를 띄워 실제 대비를 재므로 PR 게이트가 아니고(느리고 환경에 민감하다),
 * 주기 워크플로(`dark-contrast.yml`)에서만 돈다. 그래서 **목록이 낡아도 아무도 모른다** —
 * 검사는 계속 초록이고, 빠진 화면만 조용히 검사 밖으로 나간다.
 *
 * 🩸 2026-09-16 실측이 정확히 그 상태였다: 목록은 **꺼진 화면**을 재고 있었고
 *    (`/points/charge` = `TOPUP_DISABLED` · `/community-group-buy/new` = `COMMUNITY_PROPOSAL_HIDDEN`),
 *    **이용권을 카드로 사는 유일한 살아 있는 화면 `/pay/widget` 은 목록에 없었다.**
 *    하필 그 화면이 이 가드가 "가장 조심하라"고 적어 둔 구조(`light-island`)를 갖고 있고,
 *    그 방어(전역 `.dark input` 이 토스 이메일 칸을 흰 글자로 덮는 것 차단)는
 *    **한 번도 측정된 적이 없었다.**
 *
 * ⚠️ 이 테스트가 못 하는 것: **실제 대비 측정**(픽셀). 그건 브라우저 가드만 할 수 있다.
 *    여기서 재는 것은 "그 가드가 무엇을 보기로 선언했는가" 하나다.
 */

const GUARD = 'scripts/check-dark-contrast.mjs'

/**
 * `light-island` 는 **주석이 아니라 런타임 클래스**다(tailwind `darkMode` variant 가 안쪽 `dark:`
 * 를 통째로 끄고 전역 라이트 입력 규칙을 `!important` 로 켠다). 그래서 이 클래스를 쓴 화면은
 * **다크에서도 흰 표면**이 되고, 거기 놓인 글자가 밝으면 안 보인다 — 이 가드의 존재 이유 그 자체.
 *
 * ⇒ 이 클래스를 쓰는 소비자 화면은 **반드시 가드 목록에 있어야 한다.**
 *    새 파일이 이 클래스를 쓰면 이 표가 빨간불이 되고, 그때 "어느 경로가 그걸 그리나"를 정한다.
 */
const LIGHT_ISLAND_COVERAGE: Record<string, { by: string; why: string }> = {
  'src/pages/restaurant-map/MapTopBar.tsx': { by: '/map', why: '지도 위 검색창 — 2026-09-03 흰 배경 위 흰 글자(1.1:1) 실사고 자리' },
  'src/pages/restaurant-map/SelectedDealCard.tsx': { by: '/map', why: '지도 타일 위 딜 카드(항상 흰 표면)' },
  'src/pages/TossWidgetPayPage.tsx': { by: '/pay/widget', why: '토스 위젯은 토스가 흰색으로 그린다 — 우리가 테마를 못 바꾼다' },
  'src/pages/pc-home/PcHomePage.tsx': { by: '/', why: '잉크 색면 위 홈 패널' },
  'src/components/home/HomeSections.tsx': { by: '/', why: '같은 홈 패널' },
  'src/components/home/UrShortsRail.tsx': { by: '/', why: '같은 홈 패널' },
}

/**
 * 범위 밖 — **소비자 화면이 아니라서** 이 가드가 안 본다. 셀러/어드민 대시보드는 다크 자체가
 * 없고(CLAUDE.md: `dark:` 추가 절대 금지), 그래서 "다크에서 안 보임"이 성립하지 않는다.
 */
const OUT_OF_SCOPE: Record<string, string> = {
  'src/components/seller/StoreRegisterModal.tsx': '셀러 대시보드(/seller/*) 전용 — 라이트 고정이라 다크 대비 개념 없음',
}

describe('dark-contrast 가드 커버리지 (2026-09-16)', () => {
  const guard = readCode(GUARD)

  it('① 가드가 실제로 존재하고 경로 목록을 갖는다', () => {
    expect(guard.length).toBeGreaterThan(1000)
    const routes = [...guard.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1])
    // 측정 대상 0건이면 통과가 아니라 실패 — 이 레포가 반복해 당한 "헛도는 가드".
    expect(routes.length).toBeGreaterThan(20)
  })

  it('② light-island 를 쓰는 소비자 화면이 전부 가드 목록에 있다', () => {
    const routes = [...guard.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1])
    for (const [file, { by, why }] of Object.entries(LIGHT_ISLAND_COVERAGE)) {
      const covered = routes.some((r) => r === by || r.startsWith(`${by}?`))
      expect(covered, `${file} 을 그리는 경로 ${by} 가 가드 목록에 없다 (${why})`).toBe(true)
    }
  })

  it('③ light-island 사용처 목록이 실제 소스와 일치한다 (새 사용처는 결정을 강제)', () => {
    // 위 두 표가 낡으면 ②가 헛돈다 — 지키려던 파일이 목록에서 사라져도 초록이기 때문.
    const known = new Set([...Object.keys(LIGHT_ISLAND_COVERAGE), ...Object.keys(OUT_OF_SCOPE)])
    const actual = new Set<string>()
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`
        if (e.isDirectory()) walk(p)
        else if (/\.tsx?$/.test(e.name) && readFileSync(p, 'utf8').includes('light-island')) actual.add(p)
      }
    }
    for (const root of ['src/pages', 'src/components', 'src/features']) walk(root)
    expect(actual.size, 'light-island 사용처가 0건 — 탐색이 헛돈다(통과 아님)').toBeGreaterThan(0)
    for (const f of actual) {
      expect(known.has(f), `새 light-island 사용처: ${f} — 어느 경로가 그리는지 정해 표에 넣을 것`).toBe(true)
    }
  })

  it('④ 살아 있는 카드결제 화면(/pay/widget)이 목록에 있다', () => {
    // 🩸 이 한 줄이 2026-09-16 에 실제로 빠져 있었다. 이름을 박아 두는 이유는,
    //    "머니 화면을 넣었다"는 일반 문장으로는 **어느 화면이 살아 있는지**를 못 지키기 때문이다.
    expect(guard).toContain('/pay/widget')
  })

  it('⑤ 경로별 "아무것도 안 그려짐 = 실패" 검사가 살아 있다', () => {
    // 합계(measured < 200)만으로는 **한 경로가 통째로 안 그려져도** 초록이다 —
    // 다른 41개가 합계를 채우면 그 경로만 조용히 검사 밖으로 나간다.
    expect(guard).toMatch(/perRoute\.push\(/)
    // 🩸 되돌려-검증이 잡았다: 처음엔 `filter(` 존재만 봤는데, 임계를 `r.n < 0` 으로 바꾸면
    //    (= 영원히 빈 배열) 검사가 통째로 죽는데도 통과했다. **모양이 아니라 값**을 본다.
    expect(guard).toMatch(/const EMPTY_ROUTES = perRoute\.filter\(\(r\) => r\.n < [1-9]\d*\)/)
    // 판정 뒤에 반드시 종료해야 한다(로그만 찍고 통과하면 검사가 아니다).
    const blk = guard.slice(guard.indexOf('const EMPTY_ROUTES'))
    expect(blk.slice(0, 600)).toContain('process.exit(1)')
  })

  it('⑦ 서버 데이터가 있어야 그려지는 머니 화면은 API 스텁을 단다', () => {
    // 🩸 2026-09-16 실측: `/cart` 4개 · `/checkout` 3개 · `/payment/success` 4개뿐이었다.
    //    그려지던 것은 전부 **빈 상태/에러 카드**("장바구니가 비어있습니다" · "결제 승인 실패")였다.
    //    즉 이 가드가 "가장 실패 비용이 크다"고 적어 둔 화면들이, 존재한 이래 한 번도
    //    **상품·금액·결제 버튼**을 재 본 적이 없다. localStorage 로는 못 고친다 —
    //    진실이 `GET /api/cart` · `POST /api/payments/confirm` 이기 때문.
    expect(guard).toMatch(/const CART_API = \{/)
    expect(guard).toMatch(/const PAY_CONFIRM_API = \{/)
    // 스텁을 **실제로 붙였는가** — 선언만 있고 배선이 없으면 화면은 도로 빈 상태다.
    for (const r of ['/cart', '/checkout']) {
      const line = guard.split('\n').find((l) => l.includes(`route: '${r}'`))
      expect(line, `${r} 항목이 없다`).toBeTruthy()
      expect(line, `${r} 에 api 스텁 미배선 — 빈 장바구니만 재게 된다`).toContain('api: CART_API')
    }
    expect(guard).toContain('api: PAY_CONFIRM_API')
    // 결제 완료는 쿼리(paymentKey·orderId·amount)가 없으면 스텁이 있어도 조기 에러로 빠진다.
    expect(guard).toMatch(/\/payment\/success\?paymentKey=[^'"]*orderId=[^'"]*amount=/)
    // 인터셉터가 그 표를 읽는가 — 표만 있고 fulfill 이 없으면 정적 서버의 index.html 이 간다.
    expect(guard).toMatch(/R\.api && R\.api\[/)
    expect(guard).toMatch(/r\.fulfill\(\{ status: 200, contentType: 'application\/json'/)
  })

  it('⑥ 전체 측정 하한(헛도는 측정기 차단)이 살아 있다', () => {
    expect(guard).toMatch(/measured < \d{3}/)
    const blk = guard.slice(guard.indexOf('if (measured <'))
    expect(blk.slice(0, 400)).toContain('process.exit(1)')
  })
})
