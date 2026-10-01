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

  it('하네스가 이 시드를 배선해 쓴다 (모듈만 있고 안 쓰면 측정은 그대로 빈 화면)', () => {
    const h = readFileSync('scripts/visual-preview.mjs', 'utf8')
    expect(h).toMatch(/import \{ sellerListResponse \} from '\.\/preview-seeds\/seller-lists\.mjs'/)
    expect(h, '플래그가 꺼져 있으면 아무 일도 안 일어난다').toMatch(/sellerListResponse\(p, SELLER_LISTS\)/)
    expect(h, '좌석 토큰이 JWT 모양이 아니면 시트가 안 열려 또 빈 화면이 된다')
      .toMatch(/if \(STORES_N > 0 \|\| SELLER_LISTS\) \{/)
  })
})
