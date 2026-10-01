/**
 * 🧹 **마이의 손수 시트 철거 — 되돌아오지 않게** (2026-10-01, 대표 *"철거도 해주고"*)
 *
 * ## 무엇을 했나
 * 마이 판매 구역이 **같은 일에 화면을 둘** 갖고 있었다 — 손수 만든 폰 시트와 대시보드 화면.
 * 2026-09-26 의 처방은 *"문은 둘이어도 도착지는 하나"*(`COVERED_BY_SHEET`)였고, 그 주석 자신이
 * **"이건 종착지가 아니라 다리"** 라고 적어 뒀다: *"대시보드 화면이 폰에서 좋아지면 내려와야 한다."*
 *
 * 그 조건을 측정으로 채웠다(결재 `docs/decisions/2026-09-28-my-stage2-sheet-teardown.md` §측정 3차):
 * 일곱 화면 430px — **가로스크롤 0 · 하드 클립 0 · 표 오버플로 0**. ⇒ 손수 시트 쪽을 지웠다.
 *
 * ## 이 가드가 지키는 것
 * 1. 철거된 일곱이 **다시 얹히지 않는다**(한 개씩 돌아오면 그때부터 또 두 벌이다).
 * 2. 그 일들에 **마이에서 닿을 길이 있다**(지운 것이 기능을 지운 것이 되면 안 된다).
 * 3. 좌석이 바뀌면 **열린 시트가 닫힌다** — 손수 시트 각자가 하던 일을 한 곳으로 옮겼다.
 * 4. 돈(`/seller/settlements`)은 **아직 손수 시트다** — 출금의 PIN 되돌아오기를 잃지 않게.
 *
 * ## ⚠️ 이 가드가 **못** 하는 것
 * - 대시보드 화면이 폰에서 **쓸 만한지**는 안 본다(그건 `--phone-audit` 의 일이고, 그 측정이 이 철거의 근거다).
 * - 시트 안에서 그 화면이 **실제로 렌더되는지**도 안 본다(`tool-page-sheet-renders-2026-09-28` 가 본다).
 * - 철거로 **잃은 것**(환불 사유 · 이용권 가격 확인 단계)은 원본 화면의 일이고 등급 C 다 — 결재문에 있다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import { canOpenInSheet } from '@/pages/user-profile/seller-section/tool-pages'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const bare = stripComments(SECTION)

/** 철거된 손수 시트. 되돌리기는 revert 한 번이고, 한 개씩 되살리는 것이 아니다. */
const TORN_DOWN = ['OrdersSheet', 'VoucherSheet', 'VoucherEditSheet', 'StaysSheet',
  'AnalyticsSheet', 'StoreSheet', 'PartnersSheet', 'MessagesSheet', 'RefundSheet'] as const

describe('🧹 손수 시트 철거 (2026-10-01)', () => {
  it('측정이 비어 있지 않다 (0건이면 통과가 아니라 고장)', () => {
    expect(bare.length, '소스를 못 읽었거나 주석 제거가 통째로 먹었다').toBeGreaterThan(8000)
    expect(TORN_DOWN.length).toBe(9)
  })

  it('① 철거된 시트 파일이 실제로 없다', () => {
    for (const name of TORN_DOWN) {
      expect(() => readCode(`src/pages/user-profile/seller-section/${name}.tsx`),
        `${name} 가 돌아왔다 — 철거는 revert 로 되돌리고, 한 개씩 되살리지 않는다`).toThrow()
    }
  })

  it('① 마이가 그 시트를 import 하거나 렌더하지 않는다', () => {
    for (const name of TORN_DOWN) {
      expect(bare, `${name} import 가 돌아왔다`).not.toContain(`seller-section/${name}'`)
      expect(bare, `${name} 렌더가 돌아왔다 — 같은 일에 화면이 다시 둘이다`).not.toContain(`<${name}`)
    }
  })

  it('② 그 일들에 마이에서 닿을 길이 있다 (바로가기 또는 전체 도구)', () => {
    const rows = [...bare.matchAll(/openPage\('(\/seller\/[^']+)'/g)].map((m) => m[1])
    expect(rows.length, '바로가기가 대시보드 화면을 하나도 안 연다 — 검사가 헛돌고 있다')
      .toBeGreaterThanOrEqual(2)
    for (const path of ['/seller/orders', '/seller/group-buy', '/seller/analytics', '/seller/store',
      '/seller/influencer-deals', '/seller/alimtalk', '/seller/stays']) {
      const reachable = rows.includes(path) || canOpenInSheet(path)
      expect(reachable, `${path} 에 닿을 길이 없다 — 시트를 지운 것이 기능을 지운 것이 됐다`).toBe(true)
    }
  })

  it('② 대시보드 화면은 **시트 안에서** 열린다 (마이 밖으로 나가지 않는다)', () => {
    // 🔴 `openPage` 가 `enterSeat` 로 바뀌면 마이가 통째로 그 주소로 떠난다(= 경유지가 된다).
    const at = bare.indexOf('async function openPage(')
    expect(at, 'openPage 가 없다 — 앵커가 낡았다').toBeGreaterThan(0)
    const fn = bare.slice(at, at + 700)
    expect(fn, '좌석을 안 맞추고 열면 남의 가게 데이터를 그린다').toContain('currentSeatId() !== store.seller_id')
    expect(fn, '좌석을 못 잡았는데 열면 안 된다').toMatch(/if \(!ok\)/)
    expect(fn, '시트로 열지 않으면 마이 밖으로 나간다').toContain("setTool('page')")
    expect(fn, 'openPage 가 바깥 라우터로 나가면 안 된다').not.toContain('enterSeat(')
  })

  it('② 닫으면 **온 곳으로** 돌아간다 (전체 도구에서 왔으면 그 목록으로)', () => {
    expect(bare, 'pageFrom 을 안 들고 다니면 바로가기에서 열고 닫아도 전체 도구가 뜬다')
      .toContain('const [pageFrom, setPageFrom]')
    expect(bare).toMatch(/setPageFrom\('tools'\)/)
    expect(bare, '닫을 때 온 곳을 안 쓰면 그 상태는 죽은 코드다')
      .toMatch(/const back = pageFrom;[\s\S]{0,120}setTool\(back\)/)
  })

  it('③ 좌석이 바뀌면 열린 시트가 닫힌다 (손수 시트가 각자 하던 일)', () => {
    const at = bare.indexOf('const lastSeatRef')
    expect(at, '좌석 변화 effect 가 없다 — 열린 화면이 옛 가게를 가리킨다').toBeGreaterThan(0)
    const fn = bare.slice(at, at + 500)
    expect(fn, '첫 마운트에서 닫으면 열자마자 닫힌다').toMatch(/if \(prev == null \|\| prev === seatId\) return/)
    /**
     * 🩸 **첫 판은 `toContain('setTool(null)')` 이었고 헛돌았다.** 주입이 그 줄을
     *   `if (false) setTool(null)` 로 바꿨는데 문자열이 그대로 있어 **초록**이 떴다
     *   (이 레포가 반복해 당한 "검사가 실패할 수 없음" 클래스를 내가 또 만들었다).
     * ⇒ 존재가 아니라 **무조건 실행되는가**를 본다 — 조기 반환 뒤 세 줄이 **연속**이어야 한다.
     */
    const body = fn.slice(fn.indexOf('return') + 6)
    expect(body.replace(/\s+/g, ' ').trim(), '좌석이 바뀌면 **무조건** 닫아야 한다 — 조건으로 감싸면 조용히 안 닫힌다')
      .toMatch(/^setTool\(null\) setPage\(null\) setPageFrom\(null\)/)
    expect(fn, 'seatId 를 구독하지 않으면 바뀌어도 안 돈다').toMatch(/\}, \[seatId\]\)/)
  })

  it('④ 돈은 아직 손수 시트다 (출금의 PIN 되돌아오기를 잃지 않게)', () => {
    expect(bare, '출금 시트가 내려갔다 — PIN 이 막히면 대시보드는 토스트로 끝난다')
      .toContain('<WithdrawSheet')
    expect(bare, '표에서 돈이 빠지면 전체 도구가 대시보드 화면을 열어 그 흐름을 잃는다')
      .toMatch(/'\/seller\/settlements':\s*'withdraw',/)
    expect(bare, 'PIN 을 요구한 쪽으로 되돌아오지 않으면 계좌를 넣다 출금 화면에 떨어진다')
      .toContain('setPinReturn(')
  })
})
