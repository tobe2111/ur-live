/**
 * 🧹 마이 손수 시트 철거 (2026-10-01) — 주입 매니페스트.
 * 가드: src/tests/unit/my-sheet-teardown-2026-10-01.test.ts
 *
 * ⚠️ **"지웠는가" 를 보는 가드는 늘 통과하기 쉽다**(아무것도 안 하면 초록이다). 그래서 주입은
 *   **되돌아오는 방향**과 **철거가 만든 새 장치를 무력화하는 방향** 둘을 다 심는다.
 */
const TEST = 'src/tests/unit/my-sheet-teardown-2026-10-01.test.ts'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const TOOLPAGES = 'src/pages/user-profile/seller-section/tool-pages.ts'

export default [
  {
    name: '🧹 철거한 주문 시트가 다시 얹힌다 (같은 일에 화면이 둘)',
    file: SECTION,
    // 🩸 첫 판은 지역 변수만 선언했고 **빨간불이 안 났다** — 가드는 `<OrdersSheet` 렌더와
    //   `seller-section/OrdersSheet'` import 를 보는데 그 주입은 둘 다 안 만들었다.
    //   조건을 재현하지 않는 주입은 아무것도 증명하지 않는다 ⇒ import + 렌더를 함께 심는다.
    find: "const WithdrawSheet = lazy(() => import('./seller-section/WithdrawSheet'))",
    replace: "const WithdrawSheet = lazy(() => import('./seller-section/WithdrawSheet'))\nconst OrdersSheet = lazy(() => import('./seller-section/OrdersSheet'))",
    test: TEST,
    why: '한 개씩 되살리는 것이 이 구조가 무너지는 방식이다 — 2026-09-26 에 범용 도구 시트를 손수 시트 위에 얹어 일곱 개가 문 두 개로 열렸다. 되돌리려면 revert 한 번이어야 한다.',
  },
  {
    name: '🚪 바로가기가 마이 밖으로 나간다 (마이가 경유지가 된다)',
    file: SECTION,
    find: "    setPage({ path, title })\n    setPageFrom(from)\n    setTool('page')",
    replace: "    void title; void from\n    enterSeat(path)",
    test: TEST,
    why: '나가는 순간 사장님은 "대시보드라는 게 따로 있다" 를 배운다 — 대표 지시(*"대시보드는 쓸 필요없게끔"*)의 정반대이고, 화면은 정상으로 보인다.',
  },
  {
    name: '🪑 좌석이 바뀌어도 열린 시트가 안 닫힌다 (옛 가게를 보며 새 가게에 앉아 있다)',
    file: SECTION,
    find: "    if (prev == null || prev === seatId) return\n    setTool(null)",
    replace: "    if (prev == null || prev === seatId) return\n    if (false) setTool(null)",
    test: TEST,
    why: '손수 시트 각자가 하던 일을 한 곳으로 옮긴 장치다. 꺼지면 가게 A 의 주문 목록을 보면서 가게 B 의 좌석으로 쓰기를 보낸다 — 서버가 토큰으로 거르므로 **조용히 아무 일도 안 일어난다**(에러도 없다).',
  },
  {
    name: '🪑 좌석 변화를 구독하지 않는다 (effect 가 한 번만 돈다)',
    file: SECTION,
    find: "    setPageFrom(null)\n  }, [seatId])",
    replace: "    setPageFrom(null)\n  }, [])",
    test: TEST,
    why: '배열만 비우면 코드는 그대로 있고 **한 번도 발화하지 않는다**. 가드가 "setTool(null) 이 있는가" 만 보면 통과한다 — 그래서 구독까지 본다.',
  },
  {
    name: '↩️ 닫으면 늘 전체 도구로 돌아간다 (바로가기에서 열었는데)',
    file: SECTION,
    find: "          onClose={() => { const back = pageFrom; setPage(null); setPageFrom(null); setTool(back) }}",
    replace: "          onClose={() => { setPage(null); setPageFrom(null); setTool('tools') }}",
    test: TEST,
    why: '주문을 보고 닫았는데 안 본 도구 목록이 뜬다. `pageFrom` 이 죽은 상태가 되므로 선언만 보는 검사는 통과한다.',
  },
  {
    name: '💸 돈까지 철거한다 (출금의 PIN 되돌아오기를 잃는다)',
    file: SECTION,
    find: "  '/seller/settlements': 'withdraw',",
    replace: "",
    test: TEST,
    why: '대시보드 `DealBalanceCard` 는 412 PIN_REQUIRED 를 "프로필에서 설정해주세요" 토스트로 끝낸다 — 돈이 나가는 흐름 한복판에서 사장님이 막힌다. 그래서 돈만 손수 시트로 남겼다.',
  },
  {
    name: '🚪 철거한 일을 전체 도구에서도 못 열게 만든다 (진짜로 사라진다)',
    file: TOOLPAGES,
    find: "export const FULL_SCREEN_ONLY: Record<string, string> = {",
    replace: "export const FULL_SCREEN_ONLY: Record<string, string> = {\n  '/seller/store': 'x',",
    test: TEST,
    why: '철거의 전제는 **"대시보드 화면으로 닿는다"** 다. 그 주소가 전체화면 전용으로 박히면 마이에서 못 열고, 바로가기에서도 뺐으므로 그 기능은 조용히 사라진다.',
  },
]
