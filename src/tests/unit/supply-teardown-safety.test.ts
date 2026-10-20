import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { stripComments } from '../helpers/source-text'

/**
 * 🧨 도매몰 철거 안전망 (2026-07-29 — 대표 "도매몰 안 한다, 덮어써도 된다")
 *
 * 🔴 이 파일이 막으려는 사고 하나: **`src/features/supply/**` 를 통째로 지우면 소비자 결제가 깨진다.**
 *
 * 디렉터리 이름이 `supply` 라 "도매 전용"으로 보이지만 아니다. 소비자 worker 가 직접 import 한다 —
 * 주문 확정(`creditSupplierOnOrder`) · 환불(`reverseSupplierOnRefund`) · cron(정산 성숙/예치금·출금 reconcile) ·
 * 캐시 워밍(`normalizeSupplyProductData`). 게다가 `buyer-*`(해외 바이어 풀)·`maker-*`(제조사 후보 풀)는
 * **도매와 무관한 별개 사업**이고 소비자 번들에서도 마운트된다.
 *
 * ⇒ 철거 대상은 **도매 라우트·화면**이지 디렉터리가 아니다.
 *   이 테스트는 "소비자가 부르는 것"이 사라지면 **삭제 시점에 즉시 빨강**을 낸다.
 *   문서만으로는 `rm -rf features/supply` 를 막지 못한다(그래서 테스트로 환원).
 *
 * ⚠️ **이 테스트가 못 막는 것**(과신 금지):
 *   - 파일은 남기고 **내부 export 를 지우는 경우**는 여기서 안 잡힌다(tsc/빌드가 잡는다).
 *   - 라이브 데이터·배포 상태는 못 본다. 머니 게이트(예치금 등 4항목)는 **사람이** 확인한다.
 *   - 여기 열거된 쌍은 철거 시점의 사실이다. 호출부를 정당하게 옮기면 이 목록도 같이 고쳐야 한다.
 *
 * 설계 근거: docs/design/wholesale-teardown-plan.md §0 · §1 · §7
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const exists = (p: string) => existsSync(resolve(process.cwd(), p))

describe('도매 철거 안전망 — 소비자가 부르는 supply 파일은 남아야 한다', () => {
  /** [소비자 호출부, 그 호출부가 부르는 supply 파일, 언제 부르는가] */
  const CONSUMER_DEPENDENCIES: Array<[string, string, string]> = [
    ['src/worker/utils/order-commissions.ts', 'src/features/supply/api/supply-settlement.ts', '주문 확정 시 공급자 적립'],
    ['src/worker/utils/order-refund.ts', 'src/features/supply/api/supply-settlement.ts', '환불 시 적립 역전'],
    // 🌆 2026-08-25: 일간 cron 을 인보케이션 단위로 쪼개면서 정산 성숙 호출이 `scheduled.ts` →
    //   `cron/daily-lane.ts`(money 그룹)로 **이사**했다. 이 줄을 안 고치면 "소비자가 안 부른다"로
    //   읽혀 도매 철거 때 이 파일이 지워질 수 있다 — 그러면 공급자 정산이 런타임에 멎는다.
    //   ⚠️ 지도(호출부 경로)는 코드를 옮길 때마다 같이 옮겨야 한다. 오늘만 세 번 걸렸다.
    ['src/worker/cron/daily-lane.ts', 'src/features/supply/api/supply-settlement.ts', 'cron 정산 성숙'],
    ['src/worker/scheduled.ts', 'src/features/supply/api/wholesale-deposit-core.ts', 'cron 예치금 reconcile'],
    ['src/worker/scheduled.ts', 'src/features/supply/api/supplier-withdrawal-core.ts', 'cron 출금 reconcile'],
    ['src/worker/cron/cache-prewarm.ts', 'src/features/supply/api/supply-visibility.ts', '캐시 워밍 정규화'],
  ]

  for (const [caller, dep, why] of CONSUMER_DEPENDENCIES) {
    it(`${dep.split('/').pop()} — ${why} (${caller.split('/').pop()} 가 부른다)`, () => {
      expect(exists(caller), `호출부 ${caller} 가 사라졌다 — 의존 목록을 갱신할 것`).toBe(true)
      // 호출부가 여전히 그 파일을 참조하는가(참조가 사라졌으면 목록이 낡은 것 — 같이 정리)
      const stem = dep.replace('src/features/supply/api/', '').replace('.ts', '')
      expect(read(caller).includes(`features/supply/api/${stem}`),
        `${caller} 가 더 이상 ${stem} 을 안 부른다 — 이 목록을 갱신할 것`).toBe(true)
      // 그리고 그 파일은 실재해야 한다 — 지우면 소비자 결제/환불/cron 이 런타임에 깨진다.
      expect(exists(dep), `🔴 ${dep} 삭제됨 — ${why} 가 깨진다. 철거 대상은 라우트·화면이지 이 파일이 아니다`).toBe(true)
    })
  }
})

describe('🧨 2026-10-20 해외 바이어 풀 · 제조사 후보 풀 · Cafe24 — 대표 "지워줘"로 삭제됐다', () => {
  // 종전 이 블록은 "도매와 무관한 별개 사업이라 함께 걷히면 안 된다" 였다. 대표가 직접 삭제를 지시해 결정이 바뀌었다.
  // 되살아나지 않게 반대 방향으로 고정한다. ⚠️ DB 테이블(수집해 둔 데이터)은 지우지 않았다 — 데이터 삭제는 별건(결재).
  for (const f of [
    'src/features/supply/api/buyer-pool.routes.ts', 'src/features/supply/api/buyer-autofetch.ts',
    'src/features/supply/api/maker-pool.routes.ts', 'src/features/supply/api/maker-collect.ts',
    'src/features/cafe24/api/cafe24.routes.ts',
  ]) {
    it(`${f.split('/').pop()} 가 없다`, () => { expect(exists(f)).toBe(false) })
  }
  it('소비자 워커가 그 어드민 API 를 마운트하지 않는다', () => {
    const idx = read('src/worker/index.ts')
    for (const m of ["'/api/admin/buyer-pool'", "'/api/admin/maker-pool'", "'/api/buyer-ingest'", "cafe24Routes"]) expect(idx).not.toContain(m)
  })
  it('바이어 자동수집 cron 이 돌지 않는다', () => {
    expect(read('src/worker/scheduled.ts').includes("'buyer-autofetch'")).toBe(false)
  })
})

describe('도매 철거 — 소비자 표면에 도매 유입 진입점이 없다 (2026-08-03)', () => {
  /**
   * 🧨 대표 "도매몰은 잔재도 없애는거야". 접는 서비스로 **새로 들여보내는 문**을 소비자 표면에 두지 않는다.
   *
   * 🔴 라우트(`/supplier/login` 등)는 **일부러 살려 둔다** — 철거 계획 §4 가 예치금·미지급 정산금이
   *   0 임을 확인한 뒤에야 삭제하라고 못박았고, 기존 제조사·판매사가 잔액을 회수하려면 들어올 길이
   *   있어야 한다. 여기서 막는 것은 *신규 유입 링크*뿐이다(문은 남기고 간판만 내린다).
   *
   * ⚠️ 못 막는 것: 외부에 이미 퍼진 링크·검색 결과. 그건 라우트가 살아 있는 한 계속 도달한다(의도).
   */
  // 🧭 2026-10-12 — 셀러 로그인 화면(`SellerLoginPage`)은 대시보드와 함께 지웠다(주소는 카카오 로그인 별칭).
  //   소비자가 로그인하는 화면은 `LoginPage` 하나다.
  const CONSUMER_SURFACES = [
    ['src/pages/LoginPage.tsx', '소비자 로그인'],
  ] as const

  for (const [f, why] of CONSUMER_SURFACES) {
    it(`${f.split('/').pop()} — ${why} 에 /supplier·/wholesale 링크 0`, () => {
      const code = stripComments(read(f))
      expect(code).not.toMatch(/(?:to|href)=["']\/(?:supplier|wholesale)/)
    })
  }

  it('🧨 철거 완료 — 도매 라우트 모듈이 사라졌다 (머니 게이트 통과 후)', () => {
    // 🔁 2026-10-11 재조준: 종전 단언은 *"그래도 라우트 자체는 살아 있다 — 잔액 회수 경로"* 였다.
    //   그 조건("삭제는 머니 게이트 통과 후")이 **충족됐다**: 예치금 172,800원의 주인(`sellers.id 5·13`)이
    //   존재하지 않고, 충전요청 2건은 전부 confirmed, 미지급 정산 1건은 테스트 주문과 같은 시각이다
    //   (2026-06-29) ⇒ 남의 돈이 아니라 테스트 잔재. 대표 지시로 삭제했다.
    //   ⚠️ **테이블은 그대로 있다**(계획 §3 — 회계 증빙). 돌려줄 돈이 생기면 데이터는 D1 에 남아 있다.
    expect(existsSync('src/routes/supplier.routes.tsx')).toBe(false)
    expect(existsSync('src/worker/mount-wholesale.ts')).toBe(false)
  })
})
