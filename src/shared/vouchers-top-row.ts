/**
 * 🎟️ 교환권(`/vouchers`) 머리 한 줄 — 2026-11-01 대표 확정 **A안 "한 줄 머리"**
 *
 * 대표: *"이용권 페이지 UI 별로야. **배너 없는게 낫겠고** 시안들 더 필요해."* → 시안 넷(A·B·C·D) 중
 *   *"A안 — 한 줄 머리"*. 시안·실측: `docs/design/vouchers-no-banner-2026-11.md`.
 *
 * ## 무엇이 바뀌었나
 * 2026-10-14 안 C("배너가 머리", `VouchersHero` 196px)를 **대체한다.** 라이브 실측(390×844)에서
 * 첫 상품이 **y=432**, 즉 첫 화면의 절반이 상품 앞에 있었고 그중 196px 가 "딜 모으는 법" 안내였다.
 * 교환권을 사러 들어온 사람에게 첫 화면의 23%가 그 광고였다. 머리를 56px 한 줄로 바꿔 **y≈230**.
 *
 * ```
 *   내 딜 12,300 딜                              [검색] [보관함]     ← 56
 *   ──────────────────────────────────────────────────────────    ← hairline
 * ```
 *
 * ## 🔴 이 파일이 클래스를 갖고 있는 이유
 * 같은 머리를 **둘이 그린다** — React(`pages/vouchers/VouchersTopRow.tsx`)와 서버 첫 화면
 * (`worker/utils/vouchers-first-screen.ts`). 두 벌로 적으면 한쪽만 바뀌는 날 **마운트 순간 화면이
 * 밀리는데 에러는 0** 이다. 그래서 치수를 정하는 클래스는 여기 한 곳에 두고 둘이 import 한다
 * (`shared/pass-head.ts` 선례 — 그쪽도 두 벌 대조를 상수 공유로 바꿨다).
 *
 * ## 🔴 잔액 자리에 0 을 적지 않는다
 * `balance` 는 마운트 뒤 API 로 오고, **비로그인 방문자에게도 0 이다.** 모르는 것과 0 은 다르다
 * (2026-09-01 에 "당신은 0" 상자로 첫 화면을 시작했다가 고친 실수 — `DealBalanceCard` 규칙 #4).
 * 로그인인데 아직 모르면 숫자 자리를 **비워** 두고(높이는 같다), 비로그인이면 잔액이 아니라
 * **할 수 있는 일**("딜 모으기")을 말한다.
 *
 * ## ⚠️ `DealBalanceCard` 를 쓰지 않는 이유
 * 그 카드는 **마이도 같이 쓴다**(`user-profile/TeamPointsCard`). 교환권 머리를 한 줄로 바꾸려고
 * 그 부품을 고치면 마이가 같이 바뀐다. 그래서 별도 부품이고, `DealBalanceCard` 는 무접촉이다.
 */

/** 딜을 모으러 가는 곳 — 쓰면 쌓인다(`DealBalanceCard` 와 같은 목적지). */
export const VOUCHERS_TOP_EARN_PATH = '/map'
/** 교환권 보관함. */
export const VOUCHERS_TOP_BOX_PATH = '/my-gifticons'
/** 교환권 검색. */
export const VOUCHERS_TOP_SEARCH_PATH = '/search?scope=exchange'

/**
 * 머리 한 줄의 클래스. **React 와 서버 첫 화면이 같은 값을 쓴다**(시험이 둘을 대조).
 * 🔴 높이를 정하는 것은 `row` 의 `h-14`(56) 하나다 — 숫자를 다른 곳에 또 적지 말 것.
 */
export const VOUCHERS_TOP_ROW = {
  /** 머리 줄. 왼쪽 여백 20(목록과 같은 격자), 오른쪽은 아이콘이 자기 여백을 가져 12. */
  row: 'flex items-center justify-between h-14 pl-5 pr-3',
  /** 아래 실선 한 줄 — 머리와 목록을 가른다(흰 바탕에선 이 선이 유일한 경계다). */
  rule: 'h-px bg-rule',
  /** 잔액 묶음. */
  deal: 'flex items-baseline gap-1 min-w-0',
  dealLabel: 'text-[12px] text-gray-500 dark:text-gray-400 mr-0.5',
  dealNum: 'text-[17px] font-bold tracking-[-0.4px] text-gray-900 dark:text-white',
  dealUnit: 'text-[13px] font-medium text-gray-600 dark:text-gray-300',
  /** 비로그인 — 잔액 대신 할 수 있는 일. */
  guest: 'inline-flex items-center gap-1 text-[15px] font-medium text-brand-text',
  /** 검색·보관함 아이콘 자리. */
  actions: 'flex items-center',
  icbtn: 'w-10 h-10 flex items-center justify-center rounded-full text-gray-900 dark:text-white active:opacity-60',
} as const

/** 잔액을 못 읽었을 때. **0 으로 위장하지 않는다**(2026-07-02 규칙). */
export const VOUCHERS_TOP_UNKNOWN = '—'
