/**
 * 🪑 **셀러 목록 시드가 화면이 실제로 부르는 API 를 덮는가** (2026-10-01)
 *
 * 결재: `docs/decisions/2026-09-28-my-stage2-sheet-teardown.md`
 *
 * ## 왜 이 시험이 있나 — **얇은 픽스처에 두 번 당했다**
 *
 * 1차(2026-09-30): 하네스가 셀러 목록 API 를 하나도 목하지 않아 전부 404 → **빈 화면**을 재고
 *    `--phone-audit` 가 여섯 개 "🟢 깨끗" 을 냈다. 빈 목록은 당연히 안 깨진다.
 * 2차(2026-10-01, 이 시드를 만든 날): **결재문이 적어 둔 API 목록**만 담았더니 정산 화면이
 *    여전히 *"아직 자동 정산 내역이 없습니다"* · 미지급 0 이었다 — 그 화면의 주 숫자는
 *    `/api/seller/payouts` 에서 오는데 그 이름이 결재문 목록에 없었다.
 *
 * ⇒ 교훈: **"문서가 센 목록" 도 실측이 아니다.** 목록은 **화면 소스에서 뽑아야** 한다.
 *   이 시험이 그 일을 기계로 한다 — 정산 표면이 읽는 GET 경로를 소스에서 긁어
 *   시드가 덮는지 본다. 안 덮이면 다음 세션이 또 빈 화면을 재게 된다.
 *
 * ⚠️ **범위는 정산 표면(머니)뿐이다.** 결재문이 정한 우선순위 ①이고, 전 화면으로 넓히면
 *   POST/동적 경로까지 끌려와 소음이 된다. 넓힐 때는 그 소음을 어떻게 가를지 먼저 정할 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { SELLER_LIST_PATHS, sellerListResponse } from '../../../scripts/preview-seeds/seller-lists.mjs'

/** 정산(머니) 표면 — 결재문 우선순위 ①. */
const MONEY_SURFACE = [
  'src/pages/SellerSettlementsPage.tsx',
  ...readdirSync('src/pages/seller-settlements').map((f) => `src/pages/seller-settlements/${f}`),
].filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))

/** 읽기(GET)가 아닌 것 — 시드 대상이 아니다. */
const MUTATIONS = new Set([
  '/api/seller/business-registration/submit',
  '/api/seller/deal-withdraw',
  '/api/seller/voucher-redeem',
])

function sellerGetPaths(files: string[]): string[] {
  const out = new Set<string>()
  for (const f of files) {
    const code = readFileSync(f, 'utf8')
    for (const m of code.matchAll(/['"`](\/api\/seller\/[a-z0-9/_-]*)['"`?]/g)) {
      const p = m[1]
      // 템플릿 보간이 붙는 경로(`.../${id}/approve`)는 단건 조작 — 목록 시드 대상 아님.
      if (MUTATIONS.has(p)) continue
      out.add(p)
    }
  }
  return [...out].sort()
}

describe('셀러 목록 시드 — 화면이 부르는 것을 덮는다', () => {
  it('정산 표면이 읽는 GET 경로가 모두 시드에 있다', () => {
    const used = sellerGetPaths(MONEY_SURFACE)
    expect(used.length, '정산 표면에서 API 경로를 하나도 못 찾았다 — 이 시험이 헛돌고 있다')
      .toBeGreaterThan(5)
    const missing = used.filter((p) => !SELLER_LIST_PATHS.includes(p))
    expect(missing, `시드에 없는 경로 — 하네스가 404 를 주고 화면이 빈 채로 측정된다: ${missing.join(', ')}`)
      .toEqual([])
  })

  it('시드가 실제로 응답을 낸다 (목록은 full/empty 두 상태)', () => {
    for (const p of SELLER_LIST_PATHS) {
      expect(sellerListResponse(p), `${p} 가 응답을 안 낸다`).toBeTruthy()
      expect(sellerListResponse(p, 'empty'), `${p} 의 빈 상태가 없다`).toBeTruthy()
    }
    // 모르는 경로는 null — 하네스가 다른 스텁으로 넘길 수 있어야 한다.
    expect(sellerListResponse('/api/seller/does-not-exist')).toBeNull()
  })

  it('픽스처가 얇지 않다 — 폰에서 깨지는 값을 일부러 담았다', () => {
    const orders = sellerListResponse('/api/seller/orders')!.data as Array<Record<string, unknown>>
    expect(orders.length).toBeGreaterThan(1)
    // 긴 이름 · 7자리 이상 금액 · 빈 필드가 **각각 하나는** 있어야 경계가 드러난다.
    expect(orders.some((o) => String(o.shipping_name).length >= 12), '긴 이름이 없다 — 말줄임 경계를 못 본다').toBe(true)
    expect(orders.some((o) => Number(o.total_amount) >= 1_000_000), '큰 금액이 없다 — 칸 넘침을 못 본다').toBe(true)
    expect(orders.some((o) => o.user_name === null), '빈 필드가 없다 — 폴백 경로를 못 본다').toBe(true)
    const logs = sellerListResponse('/api/seller/alimtalk/logs')!.data as Array<Record<string, unknown>>
    expect(logs.some((l) => l.success === 0), '실패 로그가 없다 — 오류 배지를 못 본다').toBe(true)
  })

  /**
   * 🚩 일곱 화면이 **한 깃발**로 열린다.
   *
   * 🩸 2026-10-01: `/seller/analytics` 만 `--analytics` 를 따로 요구해 `--seller-lists` 로는
   *   계속 🟡("잴 내용이 없다")였다. 일곱 중 하나가 다른 깃발을 요구하면 **다음 세션은 그 하나를
   *   안 잰다** — 2차가 실제로 그렇게 빠뜨렸고, 그 화면이 빠진 표가 결재문에 올라갔다.
   */
  it('매출 분석도 --seller-lists 로 열린다 (일곱이 한 깃발)', () => {
    const h = readFileSync('scripts/visual-preview.mjs', 'utf8')
    expect(h, '매출 분석이 다른 깃발만 본다 — 일곱 중 하나가 측정에서 빠진다')
      .toMatch(/if \(args\.analytics \|\| SELLER_LISTS\) \{/)
    // `=empty` 는 **따로 살아 있어야** 한다 — "판 적은 있으나 이 기간엔 없음" 화면을 보는 깃발이다.
    expect(h, 'empty 변형이 사라졌다 — 빈 상태 화면을 못 본다')
      .toMatch(/args\.analytics === 'empty' \|\| SELLER_LISTS === 'empty'/)
  })

  it('하네스가 이 시드를 배선해 쓴다 (모듈만 있고 안 쓰면 측정은 그대로 빈 화면)', () => {
    const h = readFileSync('scripts/visual-preview.mjs', 'utf8')
    expect(h).toMatch(/import \{ sellerListResponse \} from '\.\/preview-seeds\/seller-lists\.mjs'/)
    expect(h, '플래그가 꺼져 있으면 아무 일도 안 일어난다').toMatch(/sellerListResponse\(p, SELLER_LISTS\)/)
    expect(h, '좌석 토큰이 JWT 모양이 아니면 시트가 안 열려 또 빈 화면이 된다')
      .toMatch(/if \(STORES_N > 0 \|\| SELLER_LISTS\) \{/)
  })
  /**
   * 🩸 2026-10-01(합치면서 값을 치렀다) — **봉투를 서버 코드만 보고 짜면 틀린다.**
   *   협업 코드 라우트의 서버 코드엔 `codes:` 가 최상위처럼 보이지만 `success(c, {...})` 가
   *   한 겹 더 감싸므로 실제 응답은 `{ success, data: { codes } }` 다. 합치는 중에 최상위로
   *   spread 했더니 화면이 **"아직 코드가 없어요"** 로 떴다 — 404 도 아니고 에러도 없다.
   *   ⇒ 봉투는 **소비자 쪽**(`CollabCodesSection.tsx:36` 의 `r.data.data.codes`)에서 읽는다.
   *   ⚠️ 이 시험은 **모양만** 본다. 화면이 실제로 그 값을 그리는지는 `--phone-audit` 의
   *     🟡("잴 내용이 없다") 판정이 잡는다 — 둘은 짝이다.
   */
  it('새로 담은 셋의 봉투가 소비자가 읽는 자리와 맞다', () => {
    const codes = sellerListResponse('/api/seller-marketing/codes')! as { data: { codes: unknown[]; influencer_pct_cap: unknown } }
    expect(Array.isArray(codes.data?.codes), 'data.codes 가 아니다 — 화면은 r.data.data.codes 를 읽는다').toBe(true)
    expect(codes.data.codes.length, '코드가 비었다 — 빈 화면을 재게 된다').toBeGreaterThan(1)
    expect(codes.data.influencer_pct_cap, '커미션 상한이 없다 — 화면이 상한 안내를 못 그린다').toBeTruthy()

    const deals = sellerListResponse('/api/seller-marketing/deals')! as { data: unknown[] }
    expect(deals.data.length, '제안이 비었다').toBeGreaterThan(1)

    const products = sellerListResponse('/api/seller/products')! as { data: Array<Record<string, unknown>> }
    expect(products.data.length, '이용권이 비었다').toBeGreaterThan(1)
    // 이용권 화면은 `sold`·`group_buy_status` 로 판매 중/종료를 가른다 — 둘 다 있어야 세그먼트가 갈린다.
    expect(products.data.some((x) => x.group_buy_status === 'active'), '판매 중이 없다').toBe(true)
    expect(products.data.some((x) => Number(x.total_revenue) >= 1_000_000), '큰 매출이 없다 — 칸 넘침을 못 본다').toBe(true)
  })

  /**
   * 🗓️ 고정 날짜 금지 — `이번 달` 칸은 `monthRevenue(daily)`(`useSellerHome.ts:61`)가
   *   **이번 달 키만** 더한다. 시드가 지난달로 박혀 있으면 달이 넘어가는 순간 `₩0` 이 뜨고,
   *   시드는 멀쩡해 보이는데 숫자만 0 이라 "판매 0" 으로 오판한다(2026-10-01 에 실제로 겪었다).
   */
  it('일별 매출 시드가 오늘을 포함한다 (달이 넘어가도 0 이 안 된다)', () => {
    const stats = sellerListResponse('/api/seller/dashboard/stats')! as { data: { daily_revenue: Array<{ date: string; revenue: number }> } }
    const ym = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)
    const thisMonth = stats.data.daily_revenue.filter((d) => d.date.startsWith(ym))
    expect(thisMonth.length, `이번 달(${ym}) 치가 없다 — 고정 날짜로 박혀 있다`).toBeGreaterThan(0)
    expect(thisMonth.reduce((a, d) => a + d.revenue, 0), '이번 달 합이 0 이다').toBeGreaterThan(0)
  })
})
