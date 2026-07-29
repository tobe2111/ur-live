import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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
    ['src/worker/scheduled.ts', 'src/features/supply/api/supply-settlement.ts', 'cron 정산 성숙'],
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

describe('도매 철거 안전망 — 도매가 아닌 별개 사업은 함께 걷히면 안 된다', () => {
  // `features/supply` 안에 있지만 도매몰과 무관하다. 소비자 번들이 마운트하고 cron 이 돈다.
  const SEPARATE_BUSINESS = [
    ['src/features/supply/api/buyer-pool.routes.ts', '해외 수출 바이어 파이프라인'],
    ['src/features/supply/api/buyer-autofetch.ts', '바이어 자동수집(소비자 cron)'],
    ['src/features/supply/api/maker-pool.routes.ts', '제조사·판매사 후보 풀'],
  ] as const

  for (const [f, why] of SEPARATE_BUSINESS) {
    it(`${f.split('/').pop()} — ${why}`, () => {
      expect(exists(f), `🔴 ${f} 삭제됨 — ${why} 는 도매몰과 무관하다`).toBe(true)
    })
  }

  it('소비자 번들이 buyer-pool·maker-pool 어드민을 계속 마운트한다', () => {
    // worker/index.ts 가 도매 마운트와 별개로 이 둘을 직접 건다(도매 워커 미배포 대응).
    //   도매 마운트를 걷어낼 때 같이 지우면 어드민 화면이 죽는다.
    const idx = read('src/worker/index.ts')
    expect(idx.includes("'/api/admin/buyer-pool'")).toBe(true)
    expect(idx.includes("'/api/admin/maker-pool'")).toBe(true)
  })

  it('바이어 자동수집 cron 이 살아 있다', () => {
    expect(read('src/worker/scheduled.ts').includes("'buyer-autofetch'")).toBe(true)
  })
})
