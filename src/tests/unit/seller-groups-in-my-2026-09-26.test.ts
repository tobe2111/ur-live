/**
 * 🧰 마이 안 판매 = 묶음 다섯 (2026-09-26, 설계 §21)
 *   대표: *"일단 마이에서 대부분 끝내야 해"*
 *
 * 여기 고정하는 것들은 **전부 에러 없이 회귀한다**:
 *   - 좌석 가드가 빠져도 화면은 멀쩡히 그려진다 — 남의 가게 주문이 뜰 뿐이다.
 *   - 상태 전이를 여기서 다시 구현해도 동작한다 — 규칙이 두 벌이 될 뿐이다.
 *   - 가게 시트가 계좌 필드를 같이 보내도 저장은 된다 — 사장님이 상호를 고치려다 PIN 을 요구받을 뿐이다.
 *   - 가격 확인 단계가 사라져도 저장은 된다 — 한 손 실수가 손님이 보는 값을 바꿀 뿐이다.
 * ⇒ 그래서 주입 러너(`scripts/mutations/seller-groups-in-my.mjs`)가 매번 깨뜨려 본다.
 *
 * ## 이 시험이 **못** 막는 것
 *   - 실제 렌더·레이아웃(jsdom 은 높이가 없다) — 시트가 폰에서 잘리는지는 브라우저가 판정한다.
 *   - 서버가 정말 그 필드를 받는지 — 라이브 계약은 staging 이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import { canOpenInSheet } from '@/pages/user-profile/seller-section/tool-pages'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
// 🧹 2026-10-01 철거: 묶음 네 시트(`OrdersSheet`·`VoucherSheet`·`VoucherEditSheet`·`StoreSheet`)
//    는 내려갔다 — 그 일들은 대시보드 화면이 맡는다(손수 시트는 그 화면의 **폰용 사본**이었다).

/**
 * 🧹 **2026-10-01 철거 — 이 파일의 묶음 1~4(시트 내부 검사 17건)를 내렸다.**
 *
 * 대상이 **사본**이었다. 사본을 지우면 사본용 가드도 내려간다 — 다만 *"원본에도 그 성질이 있나"*
 * 를 먼저 확인했고, **원본이 더 약한 자리 둘**을 찾았다. 둘 다 등급 C(돈·되돌릴 수 없는 일)라
 * 여기서 고치지 않고 결재문에 올렸다(`2026-09-28-my-stage2-sheet-teardown.md` §철거로 잃은 것).
 *
 * | 사본이 지키던 것 | 원본 | 판정 |
 * |---|---|---|
 * | 환불에 닿을 길이 있다 | `/seller/orders` 에 환불 버튼 + `confirmDialog(danger)` | ✅ 같다 |
 * | 환불에 **사유**를 적는다 | 본문이 `{}` — 사유 칸이 없다 | 🔴 **사본이 나았다** |
 * | 이용권 가격이 바뀌면 한 번 더 묻는다 | 상품 편집 화면에 가격-변경 확인 단계가 없다 | 🔴 **사본이 나았다** |
 * | 목록을 전부 한 번에 받지 않는다 | 그 화면들이 원본이다(사본이 복제했던 것) | ✅ 같다 |
 * | 좌석 가드 · 보내기 직전 `assertSeat` | 대시보드는 **좌석 토큰**(`seller_token`)으로 스코프된다 | ✅ 다른 방식, 같은 보장 |
 * | 열린 뒤 좌석이 바뀌면 닫는다 | 대시보드 화면엔 없었다 → **`SellerSection` 으로 자리를 옮겼다** | ✅ 재배치 |
 * | 네 시트가 공용 셸을 쓴다 | 셸은 `ToolPageSheet` 하나다 | ✅ 더 강해졌다 |
 *
 * ⚠️ 이 표가 이 철거의 **감사 기록**이다. 되돌리려면 revert 한 번이고, 그러면 위 가드들이 함께 돌아온다.
 */

describe('5. 🧰 배선 — 낱개 목록이 아니라 묶음이다', () => {
  /**
   * 🎯 2026-09-30 재조준 — 지키는 것은 **"그 화면에 닿을 길이 있다"** 이지
   * *"바로가기 줄로 있다"* 가 아니었다. 대표 확정으로 바로가기를 넷으로 줄이면서
   * `store` 는 `전체 도구`(= `COVERED_BY_SHEET`)를 거쳐 **같은 시트**로 열린다.
   * ⚠️ 그래서 둘 중 하나만 있으면 통과다 — 하지만 **둘 다 없으면** 그 기능은 마이에서 사라진다.
   */
  it('다섯 묶음에 모두 닿을 길이 있다 (바로가기 줄 또는 전체 도구)', () => {
    // 🧹 2026-10-01 철거: 닿는 길이 셋이 됐다 — 바로가기(`openTool` = 돈 / `openPage` = 화면)
    //   또는 전체 도구(`canOpenInSheet`). 지키는 것은 그대로다: **셋 다 없으면 마이에서 사라진다.**
    const code = stripComments(SECTION)
    for (const [job, path] of [['orders', '/seller/orders'], ['vouchers', '/seller/group-buy'],
      ['withdraw', '/seller/settlements'], ['analytics', '/seller/analytics'],
      ['store', '/seller/store']] as const) {
      const viaRow = code.includes(`openPage('${path}'`) || code.includes(`'${path}': '`)
      expect(viaRow || canOpenInSheet(path), `${job}(${path}) 에 닿을 길이 없다`).toBe(true)
    }
  })

  it('🧰 시트가 있는 주소로는 나가지 않는다 (마이가 경유지가 되지 않는다)', () => {
    /**
     * 🎯 2026-09-30 신설 — 위 *"닿을 길이 있다"* 가 2026-09-30 ⑥(바로가기 아홉 → 넷)에서
     * `direct || viaTools` 로 넓어지자, **줄이 대시보드로 나가도 "전체 도구로 닿으니" 통과**하게 됐다.
     * 주입(`주문 묶음이 다시 대시보드로 나간다`)이 그걸 잡았다(head e5784cd).
     *
     * 지키려던 것은 *줄이 있는가* 가 아니라 **나가지 않는가** 였고, 그건 바로가기가 넷이 된 뒤에도
     * 그대로 살아 있다 — 나가는 순간 사장님은 "대시보드라는 게 따로 있다" 를 배운다(대표 지시의 정반대).
     *
     * ⚠️ `enterSeat` 자체는 금지가 아니다: 시트가 **없는** 주소(41개 중 나머지)는 좌석을 받아 나가는 게 맞고
     *    `/store/scan`(손님 쪽)도 그렇다. 금지는 **시트가 있는 주소를 리터럴로 넘기는 것**뿐이다.
     */
    // 🧹 2026-10-01 철거 재조준: 종전엔 **표에 있는 주소**가 나가지 않는지 봤다. 표가 돈 하나로
    //   줄었으므로 이제는 **바로가기 줄이 여는 주소 전부**(`openPage` + 표)를 본다.
    //   지키려던 것은 그대로다 — 마이가 경유지가 되지 않는다(나가는 순간 "대시보드라는 게 따로 있다" 를 배운다).
    const code = stripComments(SECTION)
    const rowPaths = [...code.matchAll(/openPage\('(\/seller\/[^']+)'/g)].map((m) => m[1])
    const tablePaths = [...code.matchAll(/'(\/seller\/[a-z-]+)':\s*'[a-z]+',/g)].map((m) => m[1])
    const owned = [...new Set([...rowPaths, ...tablePaths])]
    expect(owned.length, '바로가기 주소를 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThanOrEqual(4)
    const leaked = owned.filter((path) => code.includes(`enterSeat('${path}')`))
    expect(leaked, `마이가 여는 주소인데 대시보드로 나간다: ${leaked.join(' · ')}`).toEqual([])
  })

  it('바로가기가 여는 것이 실제로 그려진다 (줄만 있고 시트가 없으면 아무 일도 안 난다)', () => {
    const code = stripComments(SECTION)
    // 돈은 손수 시트, 나머지는 대시보드 화면 시트 — 둘 다 **렌더 분기**가 있어야 열린다.
    const at = code.indexOf("tool === 'withdraw'")
    expect(at, 'withdraw 분기가 없다').toBeGreaterThan(0)
    expect(code.slice(at, at + 200), 'withdraw 가 <WithdrawSheet 를 안 연다').toContain('<WithdrawSheet')
    const pat = code.indexOf("tool === 'page'")
    expect(pat, 'page 분기가 없다 — 대시보드 화면이 하나도 안 열린다').toBeGreaterThan(0)
    expect(code.slice(pat, pat + 200), 'page 가 <ToolPageSheet 를 안 연다').toContain('<ToolPageSheet')
  })

  it('판매 중 목록이 두 곳에 있지 않다 — `SellingList` 는 지웠다', () => {
    // 같은 목록이 카드와 묶음 두 곳에 있으면 한쪽만 새로고침되는 날이 온다.
    expect(stripComments(SECTION)).not.toContain('<SellingList')
  })

  it('할 일(확인 대기)은 카드에 남는다 — 가장 잦은 행동을 한 탭 더 깊게 두지 않는다', () => {
    expect(stripComments(SECTION)).toContain('<PendingOrders')
  })

  it('남은 시트가 공용 셸(`Sheet`)을 쓴다 — 뒤로가기·z-index·스크롤 규약이 갈리지 않게', () => {
    // 🧹 2026-10-01 철거: 네 시트가 내려가 셸을 쓰는 것이 **더 적어졌다**(셸 자체는 그대로).
    for (const f of ['WithdrawSheet', 'ToolPageSheet', 'AllToolsSheet']) {
      expect(stripComments(readCode(`src/pages/user-profile/seller-section/${f}.tsx`)),
        `${f}: 자기 마크업을 쓰면 하단 네비 뒤로 숨거나 폰에서 잘린다`).toMatch(/from '\.\/Sheet'/)
    }
  })
})
