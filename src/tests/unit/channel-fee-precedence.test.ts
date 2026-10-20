import { describe, it, expect } from 'vitest'
import { getSellerCommissionRate } from '@/features/group-buy/api/helpers'

/**
 * 💸 2026-08-27 — **대행사 매장이 5% 가 아니라 10% 를 내고 있었다.**
 *
 * ## 무슨 일이 있었나
 * 대표 확정 모델: *"10%는 매장이 직접 입점해 이용권을 팔 때. 대행사로 가입하면 5%."*
 * 그런데 이용권 판매가 실제로 부르는 `getSellerCommissionRate` 는 **채널을 아예 안 봤다.**
 * 순서가 `sellers.commission_rate → GMV 등급 → 기본 5%` 였고, 라이브 실측에서
 * **활성 매장 7곳 전부 `commission_rate = 10`** 이라 1번에서 끝났다 — 대행사 매장 포함.
 *
 * ## 이 순서가 이 수정의 핵심이다 (채널이 override 보다 **위**)
 * `sellers.commission_rate` 는 쓰는 주체가 셋이다: 어드민 수동, `seller-tier-eval` cron(GMV 등급으로
 * 3~5% 를 덮어쓴다), 그리고 과거 잔재. 채널을 이 컬럼 **아래**에 두면 **cron 이 돌 때마다 채널 요율이
 * 조용히 지워진다.** 에러도 로그도 없다 — 이 레포가 반복해 만난 "실패가 아니라 침묵" 클래스다.
 * 실측이 그 증거다: 컬럼 기본값은 5, tier 표에도 10 은 없는데 7곳이 전부 10 이었다(아무도 의도 안 함).
 *
 * ## 못 막는 것
 *   - 게이트를 켰을 때 원장·정산이 실제로 그 요율로 떨어지는지 → **staging 실결제**로만 확인된다.
 *   - 매장이 실제로 어느 채널로 등록됐는지(운영 데이터). 지금 7곳 중 6곳이 미기록이다.
 */
function fakeDb(opts: {
  gate?: boolean
  channel?: string
  sellerRate?: number | null
  settings?: Record<string, string>
}) {
  const settings: Record<string, string> = {
    ...(opts.gate ? { fee_channel_rates_enabled: 'true' } : {}),
    ...(opts.settings ?? {}),
  }
  return {
    prepare(sql: string) {
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async first<T>() {
          if (/FROM sellers/.test(sql)) return { commission_rate: opts.sellerRate ?? null } as T
          if (/SUM\(/.test(sql)) return { gmv: 0 } as T
          const lit = /key = '([a-z_]+)'/.exec(sql)
          if (lit) return (settings[lit[1]] !== undefined ? { value: settings[lit[1]] } : null) as T | null
          if (/key = \?/.test(sql)) {
            const k = String(args[0] ?? '')
            return (settings[k] !== undefined ? { value: settings[k] } : null) as T | null
          }
          return null as T | null
        },
        async all<T>() {
          if (/FROM seller_meta/.test(sql) && opts.channel) {
            return { results: [{ seller_id: 7, key: 'store_channel', value: opts.channel }] as T[] }
          }
          return { results: [] as T[] }
        },
        async run() { return { meta: { changes: 1 } } },
      }
      return self
    },
  } as never
}

const rate = (o: Parameters<typeof fakeDb>[0]) => getSellerCommissionRate(fakeDb(o), 7)

describe('이용권 수수료 — 채널이 요율을 정한다', () => {
  it('🛡️ 게이트 OFF 면 종전 그대로 (매장별 값이 이긴다) — 기본 OFF = 라이브 무변화', async () => {
    expect(await rate({ sellerRate: 10, channel: 'brokered' })).toBeCloseTo(0.10)
  })

  it('🔑 게이트 ON + 대행사 → 5% (매장에 박힌 10 을 이긴다)', async () => {
    // 이게 실제로 틀려 있던 케이스다: 홍대돈까스(대행)가 10% 를 내고 있었다.
    expect(await rate({ gate: true, channel: 'brokered', sellerRate: 10 })).toBeCloseTo(0.05)
  })

  it('게이트 ON + 직접 → 10%', async () => {
    expect(await rate({ gate: true, channel: 'direct', sellerRate: 5 })).toBeCloseTo(0.10)
  })

  it('🩸 채널 미지정은 종전 경로로 — 모르면 바꾸지 않는다', async () => {
    // 7곳 중 6곳이 여기 해당한다. 추측으로 요율을 바꾸면 매장에서 더 떼는 사고가 난다.
    expect(await rate({ gate: true, sellerRate: 10 })).toBeCloseTo(0.10)
  })

  it('어드민이 채널 요율을 조정하면 그 값을 쓴다', async () => {
    expect(await rate({
      gate: true, channel: 'brokered', sellerRate: 10, settings: { platform_fee_pct_brokered: '4' },
    })).toBeCloseTo(0.04)
  })

  it('채널 조회가 터져도 정산은 계속된다 (fail-soft)', async () => {
    const broken = { prepare() { throw new Error('boom') } } as never
    // 전부 실패하면 기본값으로 떨어진다 — 예외가 밖으로 새지 않는다.
    await expect(getSellerCommissionRate(broken, 7)).resolves.toBeCloseTo(0.05)
  })
})
