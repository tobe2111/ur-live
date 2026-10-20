/**
 * 🧨 **도매몰 철거 — 지운 것과 **남긴 것** 둘 다 고정한다** 〔2026-10-11 대표 "도매몰 잔해들은 아예 다 삭제해줘"〕
 *
 * 도매몰(유통스타트)을 코드에서 걷어냈다. 그런데 이 철거의 **최대 함정**은 계획서(§0)가 적어 둔 그대로다:
 *   > 🔴 `src/features/supply/**` 를 통째로 지우면 **소비자 결제가 깨진다.**
 * 디렉터리 이름이 `supply` 라서 "도매 전용" 으로 보이지만 아니다 — 소비자 주문확정·환불·cron 이
 * 그 안의 정산 엔진을 **직접 부른다.** 그래서 이 시험은 두 방향을 같이 지킨다:
 *   ① 지운 것이 **되살아나지 않는다**(도매 라우트·화면·마운트)
 *   ② 남긴 것이 **함께 지워지지 않는다**(정산 엔진 · buyer/maker 풀 · 몰 인프라 · 소비자 호출부)
 *
 * ⚠️ ②가 이 시험의 본문이다. ①만 있으면 다음 세션이 "철거의 연장" 이라며 엔진을 지울 수 있고,
 *   그때 깨지는 것은 도매가 아니라 **소비자 결제**다(그리고 그건 에러가 늦게 나타난다).
 *
 * ⚠️ 이 시험이 **못 막는 것**:
 *   - DB 테이블(계획서 §3 으로 **남긴다** — 회계 증빙). 테이블을 지우는 것은 별건·회계 판단이다.
 *   - `role='wholesale'` 어드민 계정 4개(라이브 실측). 코드가 아니라 **계정 운영** 문제다.
 *   - `utongstart.com` 도메인. 두 Pages 프로젝트 어디에도 안 붙어 있다(실측) — 레지스트라 쪽 일이다.
 *
 * 주입 매니페스트: scripts/mutations/wholesale-teardown.mjs
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))

describe('① 지운 것이 되살아나지 않는다', () => {
  const GONE = [
    'src/worker/mount-wholesale.ts',
    'src/routes/supplier.routes.tsx',
    'src/pages/WholesaleCatalogPage.tsx',
    'src/pages/SupplierDashboardPage.tsx',
    'src/features/supply/api/wholesale.routes.ts',
    'src/features/supply/api/supplier-auth.routes.ts',
    'src/features/supply/api/distributor-admin.routes.ts',
    'src/features/admin/api/admin-suppliers.routes.ts',
    'src/hooks/queries/useWholesale.ts',
  ]
  for (const f of GONE) {
    it(`${f.split('/').pop()} 가 없다`, () => expect(existsSync(f)).toBe(false))
  }

  it('소비자 앱이 /wholesale · /supplier 라우트를 선언하지 않는다', () => {
    const app = read('src/App.tsx')
    expect(app).not.toMatch(/path="\/wholesale/)
    expect(app).not.toMatch(/path="\/supplier/)
  })

  it('워커가 도매 라우트를 마운트하지 않는다', () => {
    const idx = read('src/worker/index.ts')
    expect(idx).not.toContain('mountWholesale')
    // 🏬 몰 관리(`/api/admin/wholesale-malls`)는 **공구 서비스**다 — 이름만 wholesale 이다(아래 ② 참조).
    expect(idx).not.toMatch(/app\.route\('\/api\/wholesale/)
    expect(idx).not.toMatch(/app\.route\('\/api\/supplier/)
  })

  it('어드민 nav 에 도매 밴드가 0개다', () => {
    expect(read('src/components/admin/admin-nav-config.ts')).not.toContain("domain: 'wholesale',")
  })

  it('도매 번들 빌드 스위치가 상수 false 다 (env 로 되살릴 수 없다)', () => {
    const bw = read('scripts/build-worker.js')
    expect(bw).toContain('const INCLUDE_WHOLESALE = false')
    expect(bw).not.toContain("process.env.WHOLESALE_BUNDLE")
    // ⚠️ define 자체는 남아야 한다 — 빼면 esbuild 가 식별자를 남겨 런타임 ReferenceError 가 된다.
    expect(bw).toContain("'__INCLUDE_WHOLESALE__'")
  })
})

describe('② 남긴 것이 함께 지워지지 않는다 (여기가 본문)', () => {
  /** 소비자 결제·환불·cron 이 직접 부르는 정산 엔진 — 계획서 §1(a). */
  const ENGINE: Array<[string, string[]]> = [
    ['src/features/supply/api/supply-settlement.ts',
      ['src/worker/utils/order-commissions.ts', 'src/worker/utils/order-refund.ts']],
    ['src/features/supply/api/supply-visibility.ts', ['src/worker/cron/cache-prewarm.ts']],
    ['src/features/supply/api/wholesale-deposit-core.ts', ['src/worker/scheduled.ts']],
    ['src/features/supply/api/supplier-withdrawal-core.ts', ['src/worker/scheduled.ts']],
  ]
  for (const [engine, callers] of ENGINE) {
    it(`${engine.split('/').pop()} 가 남아 있다 — ${callers.length}곳이 부른다`, () => {
      expect(existsSync(engine), `${engine} 를 지우면 소비자 결제/cron 이 깨진다`).toBe(true)
      const base = engine.split('/').pop()!.replace(/\.ts$/, '')
      const seen = callers.filter((c) => read(c).includes(base))
      expect(seen, `${base} 를 부르는 소비자 호출부가 사라졌다 — 배선이 끊겼는지 확인할 것`).toEqual(callers)
    })
  }

  it('소비자 코드가 부르는 헬퍼 둘이 남아 있다', () => {
    expect(existsSync('src/features/supply/api/wholesale-helpers.ts')).toBe(true)
    expect(existsSync('src/features/supply/api/wholesale-settlement.ts')).toBe(true)
    // 🩸 2026-10-11: 처음엔 **이름만** 찾았는데(`toContain('computeWholesaleOnly')`) 주입이 그 이름을 담은
    //   지역 상수로 바꾸자 그대로 통과했다 — 지키려던 것은 이름이 아니라 **배선**이다. ⇒ import 경로로 앵커.
    expect(read('src/features/auth/api/seller.routes.ts'))
      .toMatch(/import \{ computeWholesaleOnly \} from '@\/features\/supply\/api\/wholesale-helpers'/)
    expect(read('src/features/admin/api/admin-products.routes.ts'))
      .toMatch(/import \{ loadPlatformCommissionPct \} from '[^']*supply\/api\/wholesale-settlement'/)
  })

  it('🧨 2026-10-20 별개 사업(해외 바이어 · 제조사 후보 풀)도 대표 지시로 삭제됐다 — 되살아나지 않는다', () => {
    // 종전엔 "남아 있어야 한다"(계획서 §1(b))였다. 대표 *"1,2,3번은 지워줘"* 로 결정이 바뀌었다.
    const files = readdirSync('src/features/supply/api')
    expect(files.filter((f) => f.startsWith('buyer-') || f.startsWith('maker-'))).toEqual([])
    expect(read('src/worker-ads/index.ts')).not.toContain("'/__ads/collect-maker'")
    const idx = read('src/worker/index.ts')
    expect(idx).not.toContain("app.route('/api/admin/buyer-pool'")
    expect(idx).not.toContain("app.route('/api/admin/maker-pool'")
  })

  it('🏬 공구 서비스(운영자 몰) 인프라가 남아 있다 — 계획서 §1(c)', () => {
    for (const f of [
      'src/features/mall/api/mall-public.routes.ts',
      'src/features/mall/api/mall-admin.routes.ts',
      'src/worker/utils/mall-consumer.ts',
      'src/features/supply/api/wholesale-malls.ts',
      'src/features/supply/api/wholesale-malls-admin.routes.ts',
      'src/pages/MallHomePage.tsx',
      'src/pages/admin/AdminWholesaleMallsPage.tsx',
    ]) {
      expect(existsSync(f), `${f} 는 공구 서비스다 — 이름이 wholesale 이어도 도매가 아니다`).toBe(true)
    }
    // 몰 관리 API 는 도매 게이트 **밖**에 마운트돼야 한다(2026-08-03 대표 실측 404 의 교훈).
    expect(read('src/worker/index.ts')).toContain("app.route('/api/admin/wholesale-malls'")
  })

  it('이름만 Supplier 인 유어딜 주소를 지우지 않았다', () => {
    // 🩸 2026-10-11 실제로 지웠다가 되살렸다: `/seller/register/supplier` 라는 **옛 라우트 이름** 때문에
    //   도매로 분류했는데, 그건 유어딜 **사업자 유저 전환**(가입) 화면이었다.
    // 🔀 2026-10-12 재조준: 그 화면 파일(`SellerRegisterSupplierPage`)은 이번엔 **이름이 아니라 쓰임으로**
    //   지웠다 — 가입 문이 2026-10-10 부터 `/store/new` 하나라 import 하는 곳이 0 이었다.
    //   교훈(이름으로 분류하지 말 것)이 지키려던 것은 **이미 공유된 옛 가입 링크가 살아 있는가**이고,
    //   그건 라우트가 지킨다 — 도매 철거가 이 주소를 같이 쓸어 가면 옛 링크가 404 가 된다.
    const routes = read('src/routes/seller.routes.tsx')
    expect(routes).toContain('path="/seller/register/supplier" element={<LegacySellerRegisterRedirect />}')
  })
})
