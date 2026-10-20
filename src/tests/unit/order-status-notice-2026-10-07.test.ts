/**
 * 🔔 **상태 변경 알림이 구매자에게 한국어 문장으로 간다** — `ORDER_STATUS_NOTICE` 불변식.
 *
 * ## 왜 생겼나 (2026-10-07 — 대표 *"주문 확인은 왜 필요한거지?"* 를 코드로 답하다 나온 결함 둘)
 * 셀러가 [주문 확인] 을 누르면 `PUT /api/seller/orders/:id/status` 로 `PREPARING` 이 가고
 * 그 핸들러가 구매자에게 인앱 알림을 쏜다. 그런데 알림 문구 맵을 **단건·일괄 두 블록이 각자**
 * 들고 있었고, **서로 다르게 틀려** 있었다:
 * - **단건**: `CONFIRMED` 키를 들고 있었는데 그 값은 `VALID_STATUSES`·`ORDER_TRANSITIONS`
 *   어디에도 없어 **도달 불가**. 반대로 실제로 오는 `PREPARING` 은 키가 없어 폴백
 *   `` `주문 상태: ${dbStatus}` `` 이 한국 소비자에게 **영문 enum 을 그대로** 보냈다.
 * - **일괄**: 같은 `PREPARING` 을 셀렉트 박스에 띄워 두고(`seller-orders/BulkActionBar`)
 *   키가 없어 **알림을 한 건도 안 보냈다**(폴백이 없어 조용히 넘어간다).
 *
 * ⇒ 한쪽은 틀린 걸 보내고 한쪽은 아무것도 안 보냈다. **에러가 없어 아무도 신고하지 않는다.**
 *
 * ## 무엇을 재는가
 * 가장 값진 것은 ③ 이다 — **화면이 보낼 수 있는 상태**(`nextStatusOf` 의 목적지 + 일괄
 * 셀렉트의 `<option>`)를 **다른 파일에서 읽어** 그 전부에 문장이 있는지 대조한다. 원래 결함 둘이
 * 정확히 이 교차 검사로만 드러나는 모양이었다(한쪽 파일만 보면 둘 다 멀쩡해 보인다).
 *
 * ## ❌ 이 시험이 못 보는 것
 * - 문장이 **적절한지**(어투·내용) — 사람이 읽어야 한다.
 * - 알림이 실제로 **발송되는지**(`notifyUser` 는 fire-and-forget 이고 D1 이 필요하다).
 * - 어드민 경로(`/api/admin/orders/:n/status`)는 자기 알림 맵을 따로 쓴다 — 범위 밖.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw, sliceFrom } from '../helpers/source-text'

const NOTICE = 'src/shared/order-status-notice.ts'
const ROUTES = 'src/features/seller/api/seller-orders.routes.ts'
const HELPERS = 'src/pages/seller-orders/statusHelpers.tsx'
const BULK_BAR = 'src/pages/seller-orders/BulkActionBar.tsx'

/** 맵 리터럴에서 키 집합을 뽑는다(값이 아니라 **키**만 본다 — 문구 수정에 안 깨지게). */
function noticeKeys(code: string): string[] {
  const block = sliceFrom(code, 'const ORDER_STATUS_NOTICE', '};', 1200)
  return [...block.matchAll(/^\s*'?([A-Z_]+)'?\s*:/gm)].map((m) => m[1])
}

describe('구매자 상태 알림 문구 — ORDER_STATUS_NOTICE (2026-10-07)', () => {
  const code = readCode(ROUTES)
  const raw = readRaw(ROUTES)
  const notice = readCode(NOTICE)

  it('⓪ 주석 제거가 파일을 통째로 날리지 않았다 (측정기 자기검사)', () => {
    // 이 레포가 네 번 밟은 클래스 — 문자열 안의 `/*` 가 파일 가운데를 먹는다.
    // 측정 대상이 사라지면 아래 단언들이 **전부 헛돈다**.
    expect(code.length).toBeGreaterThan(raw.length * 0.5)
    expect(code).toContain('ORDER_STATUS_NOTICE')
    expect(noticeKeys(notice).length).toBeGreaterThan(2)
  })

  it('① PREPARING 에 한국어 문장이 있다 (셀러가 실제로 누르는 상태)', () => {
    expect(noticeKeys(notice)).toContain('PREPARING')
  })

  it('② 도달 불가한 키를 들고 있지 않다 — VALID_STATUSES 안의 값만', () => {
    const valid = sliceFrom(code, 'const VALID_STATUSES', ';', 400)
    const allowed = [...valid.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
    expect(allowed.length).toBeGreaterThan(3)
    for (const k of noticeKeys(notice)) expect(allowed).toContain(k)
    // 원래 들어 있던 죽은 키 — 이름으로도 한 번 못 박는다.
    expect(noticeKeys(notice)).not.toContain('CONFIRMED')
  })

  it('③ 화면이 보낼 수 있는 모든 상태에 문장이 있다 (교차 파일 — 이게 핵심)', () => {
    const keys = noticeKeys(notice)

    // (a) 단건: `nextStatusOf` 가 보내는 목적지
    const next = sliceFrom(readCode(HELPERS), 'export function nextStatusOf', '\n}', 800)
    const targets = [...next.matchAll(/return '([A-Z_]+)'/g)].map((m) => m[1])
    expect(targets).toEqual(expect.arrayContaining(['PREPARING', 'SHIPPING', 'DELIVERED']))

    // (b) 일괄: 셀렉트가 띄우는 `<option value="…">`
    const opts = [...readCode(BULK_BAR).matchAll(/<option value="([A-Z_]+)"/g)].map((m) => m[1])
    expect(opts.length).toBeGreaterThan(2)

    for (const s of [...targets, ...opts]) expect(keys).toContain(s)
  })

  it('④ 영문 enum 폴백이 없다 — 문장이 없으면 안 보낸다', () => {
    // 폴백이 살아 있으면 `VALID_STATUSES` 에 상태가 하나 늘 때마다 그 이름이 그대로 나간다.
    expect(code).not.toMatch(/주문 상태:\s*\$\{/)
  })

  it('⑤ 두 경로가 같은 맵을 쓴다 — 인라인 맵 0개', () => {
    // 종전 결함의 근원: 같은 맵을 두 블록이 각자 들고 있었다.
    expect(code).not.toContain('const statusMessages')
    // 라우트 파일에는 **import 1회 + 소비 2회**뿐 — 선언은 공용 모듈에 있다.
    expect([...code.matchAll(/ORDER_STATUS_NOTICE/g)]).toHaveLength(3)
    expect(code).toContain("from '@/shared/order-status-notice'")
    expect(notice).toContain('export const ORDER_STATUS_NOTICE')
  })

  it('⑥ 두 발송 블록 모두 문장 유무를 확인하고 보낸다', () => {
    // ⚠️ 앵커를 **주석으로 잡지 않는다** — `readCode` 가 주석을 지우므로 빈 조각이 잡히고
    //   그러면 아래 단언이 통째로 헛돈다(첫 판에서 실제로 그랬다. `source-text` 머리말 ②).
    const sites = [...code.matchAll(/ORDER_STATUS_NOTICE\[dbStatus\]/g)].map((m) => m.index ?? -1)
    expect(sites).toHaveLength(2)
    for (const at of sites) {
      const block = code.slice(at, at + 900)
      expect(block).toMatch(/if \(msg\)/)
      expect(block).toContain('notifyUser')
      expect(block).toContain("'order_status'")
    }
  })
})
