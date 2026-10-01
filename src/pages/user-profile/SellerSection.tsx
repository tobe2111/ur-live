/**
 * 🏪 마이 판매 섹션 — "내 가게" (2026-09-25, 설계 §14 단계 1~2)
 *   대표 확정: *"하는 것도 마이에서 하는걸로. 근데 필수적인 것들 선별해서"*
 *
 * ## 무엇이 여기 있나 (2026-09-26 §21 — 낱개 목록 → **묶음**)
 * 오늘 카드 + 사용처리 + 할 일(주문 확인) + **묶음 다섯**(주문 · 이용권 · 정산 · 매출 분석 · 가게).
 *
 * 종전엔 낱개 버튼 목록이었다(등록·환불·분석·출금 + 전체 도구). 도구가 늘 때마다 그 목록이
 * 길어지고, 끝은 **마이 안의 두 번째 사이드바**다 — 화면만 옮겼을 뿐 대시보드를 없앤 게 아니다.
 * 그래서 사장님이 실제로 생각하는 단위로 묶고 **화면 수를 고정**한다. 도구는 묶음 *안*에서 자란다.
 *
 * ## 할 일은 카드에, 현황은 묶음에
 * `PendingOrders`(확인 대기)만 카드에 남는다 — 그건 **눌러야 할 것**이다. 판매 중 목록은 현황이라
 * 이용권 묶음 안으로 들어갔다(그래서 `SellingList` 를 지웠다 — 같은 목록이 두 곳에 있으면 갈린다).
 *
 * ## 🔴 좌석과 화면이 어긋나지 않게
 * 좌석 토큰은 JWT 안에 `seller_id` 가 박혀 있어 가게를 바꾸면 통째로 바뀐다. 그래서 일감은
 * **좌석이 맞을 때만** 그리고, 쓰기는 보내기 직전에 좌석을 다시 확인한다(§15-3).
 *
 * ## 셀러가 아니면 아무것도 안 그린다
 * 좌석이 0곳이면 `null`. 진입점은 이름 옆 `SellerSwitchInline` 칩(`내 가게 등록`) 그대로다 —
 * 여기에 또 하나를 두면 **진입점이 둘**이 되고, 둘은 반드시 갈린다.
 *
 * ## 🥕 승인 전에도 보인다
 * `isSeatableStoreStatus` 가 대기·반려도 좌석을 열어 준다(당근 모델). 그래서 이 카드는
 * 상태를 **직접 말한다** — 노출·정산이 왜 아직인지 화면이 설명하지 않으면 사장님은 고장으로 읽는다.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'
// 🎨 2026-09-28: 판매 도구 여덟 칸의 뜻 아이콘. lucide 로 남긴 넷은 전부 **조작**이다
//    (펼치기·이동·로딩·검색) — 어느 앱에서나 같은 모양이라 직접 그릴 값이 없다.
import {
  OrdersIcon, TicketStubIcon, WonCoinIcon, UrShopIcon, ScanIcon,
} from '@/components/icons/urdeal-icons'
import { formatNumber } from '@/utils/format'
import { currentSeatId, onSeatChange, switchSeat } from '@/lib/seller-seat'
import { clearMyReturn, withMyReturn } from '@/lib/seller-return'
import { toast } from '@/hooks/useToast'
import type { MyStoresState } from './useMyStores'
import { writeReservedHeight } from './seller-reserve'
import { useSellerWork } from './seller-section/useSellerWork'
import PendingOrders from './seller-section/PendingOrders'
// 🧾 2026-09-28: 묶음 라벨·줄은 손님 쪽 목록과 **같은 부품**이다(`list-grammar`).
//   종전엔 이 파일 안에 `GroupLabel`/`ToolRow` 가 따로 있었고, 손님 쪽은 또 다른 문법이라
//   같은 화면에 목록 문법이 두 벌이었다 — 대표 *"허술해"*(09-28)의 실체 중 하나.
import { LIST_PLATE_CLS, SECTION_TITLE_CLS, ListRow as ToolRow } from './list-grammar'

/**
 * ⏳ **시트는 전부 열 때 받는다** (2026-09-26 — 대표 *"로딩 속도를 줄이고"*).
 *
 * 종전엔 열세 시트를 전부 정적으로 import 했다. 그래서 마이를 여는 것만으로 **판매 화면 전부의
 * 코드를 받았다** — 실측 `UserProfilePage` 청크 221KB 중 **129KB(58%)가 셀러 전용**이었고,
 * 마이를 쓰는 사람 대다수는 판매를 안 한다(라이브 승인 셀러 9곳). 그 값을 그들이 치르고 있었다.
 *
 * `lazy` 로 가르면 각 시트가 **눌린 순간** 별도 청크로 내려온다. 시트는 이미 로딩 표시를 갖고
 * 있고(각자 `loading` 상태), 아래 `Suspense` 폴백은 `null` 이다 — 시트가 열리기 전엔
 * 배경 스피너를 띄우지 않는다(누른 직후 화면이 깜빡이는 것보다 낫다).
 */
const StoreSwitchSheet = lazy(() => import('./StoreSwitchSheet'))
const RefundSheet = lazy(() => import('./seller-section/RefundSheet'))
const AnalyticsSheet = lazy(() => import('./seller-section/AnalyticsSheet'))
const WithdrawSheet = lazy(() => import('./seller-section/WithdrawSheet'))
const AllToolsSheet = lazy(() => import('./seller-section/AllToolsSheet'))
const PinSheet = lazy(() => import('./seller-section/PinSheet'))
const BankSheet = lazy(() => import('./seller-section/BankSheet'))
const OrdersSheet = lazy(() => import('./seller-section/OrdersSheet'))
const VoucherSheet = lazy(() => import('./seller-section/VoucherSheet'))
const StoreSheet = lazy(() => import('./seller-section/StoreSheet'))
const PartnersSheet = lazy(() => import('./seller-section/PartnersSheet'))
const MessagesSheet = lazy(() => import('./seller-section/MessagesSheet'))
const SettlementsSheet = lazy(() => import('./seller-section/SettlementsSheet'))
const ToolPageSheet = lazy(() => import('./seller-section/ToolPageSheet'))

const STATUS_NOTE: Record<string, string> = {
  pending: '승인 대기 중이에요. 준비는 지금 하고, 메인 노출과 정산은 승인 뒤에 시작됩니다.',
  rejected: '서류가 반려됐어요. 사업자등록증을 다시 올리면 바로 다시 심사합니다.',
}

function todayLabelKST(): string {
  // 워커도 브라우저도 TZ 를 믿을 수 없다 — KST 로 명시해 읽는다(CLAUDE.md 시각 룰).
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
  })
}

/** 마이 안에서 열리는 묶음·도구. 하나가 늘면 여기와 `openTool` 두 곳이 같이 바뀐다. */
type Tool = 'orders' | 'vouchers' | 'withdraw' | 'analytics' | 'store' | 'refund' | 'tools' | 'pin' | 'bank'
  | 'partners' | 'messages' | 'settlements' | 'page'

/**
 * 🔀 **같은 일에 화면이 둘이 되지 않게** (2026-09-26 — 대표 *"전체적으로 이상적이지 않은 것 같은데?"*)
 *
 * ## 무엇이 잘못됐었나
 * 마이에 문이 둘 생겼다. 묶음 줄은 **손수 만든 폰 시트**를 열고, 전체 도구는 같은 일의
 * **대시보드 화면**을 열었다 — 일곱 개 전부. 사장님이 어느 문으로 들어왔느냐에 따라 "주문" 이
 * 다른 화면으로 뜬다. 그리고 버그가 오면 한쪽만 고친다.
 * **이 레포가 반복해 당한 클래스이고, 이번엔 내가 만들었다**(범용 도구 시트를 손수 시트 위에 얹었다).
 *
 * ## 처방: 문은 둘이어도 **도착지는 하나**
 * 전체 도구에서 이 주소들을 고르면 대시보드 화면이 아니라 **그 손수 시트로** 보낸다.
 * 색인에서 빼지 않는 이유 — 빼면 "전체 도구" 가 전체가 아니게 되고, 찾던 사람이 못 찾는다.
 *
 * ## ⚠️ 이건 종착지가 아니라 다리다
 * 손수 시트가 존재하는 이유는 **대시보드 화면이 폰에서 나쁘기 때문**이다. UI 정리로 그 화면들이
 * 폰에서 좋아지면 이 표와 시트 일곱은 **내려와야 한다** — 그때까지만 두 벌을 유지한다.
 * 그 판단이 필요해지면 이 주석이 근거다.
 */
const COVERED_BY_SHEET: Record<string, Tool> = {
  '/seller/orders': 'orders',
  '/seller/group-buy': 'vouchers',
  '/seller/settlements': 'withdraw',
  '/seller/store': 'store',
  '/seller/analytics': 'analytics',
  '/seller/influencer-deals': 'partners',
  '/seller/alimtalk': 'messages',
}

/** 묶음 한 줄 — 전부 같은 모양이어야 무엇이 있는지 한눈에 읽힌다. */

/** ⚠️ 좌석은 **페이지가 한 번만** 묻고 내려 준다 — 여기서 또 부르면 같은 화면에 두 개의 진실이 생긴다. */
export default function SellerSection({ state }: { state: MyStoresState }) {
  const { stores, currentSellerId, loading, failed } = state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [entering, setEntering] = useState(false)
  /** 열려 있는 판매 시트. 좌석이 바뀌면 시트는 스스로 닫는다(§15-3). */
  const [tool, setTool] = useState<Tool | null>(null)
  /**
   * 🔑 PIN 을 **누가 요구했나**. 출금도 계좌 변경도 412 를 준다 — 한 곳으로만 돌아가면
   *   계좌를 넣다 PIN 을 푼 사람이 엉뚱하게 출금 화면에 떨어진다.
   */
  const [pinReturn, setPinReturn] = useState<'withdraw' | 'bank'>('withdraw')
  /**
   * 🪟 전체 도구에서 고른 화면. **대시보드 페이지를 그대로** 시트 안에 연다(`ToolPageSheet`).
   *   `title` 을 같이 들고 다니는 이유: 시트 머리 이름을 여기서 다시 짓지 않기 위해서다 —
   *   나브 색인이 정본이고, 두 벌이 되면 메뉴 이름과 시트 이름이 갈린다.
   */
  const [page, setPage] = useState<{ path: string; title: string } | null>(null)
  /**
   * 🪑 지금 토큰이 앉아 있는 좌석. **서버 응답이 아니라 토큰에서 읽는다** — 전환 직후에도 즉시 맞는다
   *   (`useMyStores` 의 `current_seller_id` 는 재조회 뒤에야 따라온다).
   */
  const seatId = useSyncExternalStore(onSeatChange, currentSeatId, () => null)

  /**
   * 지금 보고 있는 가게. 토큰이 앉아 있는 좌석이 목록에 있으면 그것, 아니면 첫 칸.
   * ⚠️ 여기서 토큰을 **새로 발급하지 않는다** — 마이를 여는 것만으로 남의 대시보드 세션을
   *   끊을 수 있다(`startDashboardSession`). 좌석 이동은 사람이 시트에서 고를 때만.
   */
  const store = useMemo(() => {
    if (stores.length === 0) return null
    return stores.find((s) => s.seller_id === currentSellerId) ?? stores[0]
  }, [stores, currentSellerId])

  const seated = store != null && seatId === store.seller_id
  /** 좌석에 앉았을 때만 일감을 부른다(안 앉았으면 요청 0). 좌석이 어긋나면 안내하고 다시 부른다. */
  const work = useSellerWork(store?.seller_id ?? 0, seated, () => {
    toast.error('가게가 바뀌었어요. 목록을 다시 불러옵니다')
  })

  /**
   * 🪑 사람이 누르는 순간에만 좌석에 앉는다(발급은 사용자 행동일 때만).
   * 경로의 id 가 아니라 **토큰**이 권한 근거다(§15-3 규칙 ③). 좌석이 이미 맞으면 발급도 안 한다.
   * @param to 주면 앉은 뒤 그 주소로 하드 진입(대시보드는 전역이 옛 매장을 캐싱하므로 — `StoreSwitcher` 와 같은 판단).
   */
  async function enterSeat(to?: string) {
    if (!store || entering) return
    setEntering(true)
    const ok = currentSeatId() === store.seller_id || await switchSeat(store.seller_id, store.name).catch(() => false)
    setEntering(false)
    if (!ok) { toast.error('가게로 들어가지 못했습니다'); return }
    // ↩️ 2026-09-26: 표시를 달고 보낸다 — 그 화면 맨 위에 "마이로 돌아가기" 띠가 뜬다.
    //   안 달면 일이 끝나는 화면(등록 폼은 저장 후 `/seller/group-buy` 로 간다)에서 길을 잃는다.
    if (to) window.location.assign(withMyReturn(to))
  }
  // ↩️ 마이에 도착했다 = 여정이 끝났다. 흔적을 지워야 다음 대시보드 방문에 띠가 안 남는다.
  useEffect(() => { clearMyReturn() }, [])

  /**
   * 📐 2026-09-30 — 이 구역의 **실제 높이**를 적어 둔다. 다음 방문의 첫 프레임이 그만큼을 비워 둬서
   * 손님 줄이 안 밀린다(대표 신고 *"2번째 이미지가 … 첫번째 이미지로 바뀌더라?"* — `SellerSectionLazy` 머리말).
   * ⚠️ 시트가 열린 상태의 높이를 적지 않으려고 **마운트/내용 변화 직후 한 프레임**만 잰다.
   */
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = rootRef.current
    // ⏳ 껍데기(awaiting)의 높이는 적지 않는다 — 상태 안내문(`note`)이 빠져 있어 진짜보다 짧다.
    //   짧은 값을 적어 두면 다음 방문의 예약이 모자라 그만큼 또 밀린다.
    if (!el || !store) return
    const id = requestAnimationFrame(() => writeReservedHeight(el.offsetHeight))
    return () => cancelAnimationFrame(id)
  }, [stores.length, store?.seller_id, store?.status])

  const onWorkDone = () => { state.refetch() }

  /**
   * 🪑 판매 시트는 **좌석이 맞을 때만** 열린다 — 시트가 부르는 API 는 전부 좌석 토큰으로 스코프된다.
   *   안 맞으면 먼저 앉히고(사람이 누른 행동이다), 실패하면 열지 않는다.
   */
  async function openTool(which: Tool) {
    if (!store || entering) return
    if (currentSeatId() !== store.seller_id) {
      setEntering(true)
      const ok = await switchSeat(store.seller_id, store.name).catch(() => false)
      setEntering(false)
      if (!ok) { toast.error('가게로 들어가지 못했습니다'); return }
    }
    setTool(which)
  }

  // 좌석 0곳(= 셀러가 아님) · 실패 → 아무것도 그리지 않는다.
  //   실패를 0 으로 그리면 "오늘 매출 0원" 이라는 거짓말이 된다(머니 표면 룰).
  if (failed) return null
  if (!loading && !store) return null

  /**
   * ⏳ **기다리는 중에도 같은 자리를 차지한다** (2026-10-01 — 대표 *"저런 로딩이 발생되는 근본적인
   *   원인을 모두 없애줘"*).
   *
   * 09-30 의 처방은 *지난 렌더에서 잰 높이만큼 빈 칸*을 두는 것이었고, 그건 **재방문만** 고쳤다.
   * 하네스 전수 측정(2026-10-01, 19개 화면)에서 소비자 화면 중 **보이는 곳이 밀리는 건 여기 하나**였고,
   * 첫 방문은 여전히 `이동 29(보이는 곳 15) · +404px` 였다 — 대표가 찍은 바로 그 그림이다.
   *
   * ⇒ 빈 칸 대신 **이 구역의 진짜 마크업**을 그리고 **숫자만 비운다**(2026-09-16 `DealBalanceCard`
   *   가 잔액에 쓴 그 처방). 높이가 같은 CSS 에서 나오므로 디자인이 바뀌어도 저절로 따라온다 —
   *   마크업을 복제하지 않았으니 두 벌이 갈릴 자리도 없다.
   *
   * ⚠️ **0 을 적지 않는다.** 모르는 값과 0 은 다르고, 잠깐이라도 `0원` 을 보여 주면 매출이 있는
   *   사장님에게 "오늘 0원" 이라고 말하는 셈이다(머니 표면 룰). `invisible` 로 자리만 남긴다.
   * ⚠️ 기다리는 동안 **눌러도 아무 일도 안 일어난다** — 좌석·시트가 전부 `store` 를 요구한다.
   *   그래서 `pointer-events-none` 으로 아예 안 눌리게 한다(말없이 삼키는 탭을 만들지 않는다).
   *   흐리게(`opacity`) 하지는 않는다 — 도착 순간 화면이 또 한 번 바뀐다.
   *
   * ## 이 처방이 **못** 하는 것
   * - 상태 안내문(`note`, 승인 대기·반려)은 상태를 알아야 그릴 수 있어 껍데기에 없다. 그 매장은
   *   도착 순간 그 줄만큼(≈2줄) 밀린다 — 404 가 40 이 된 것이지 0 이 된 것은 아니다.
   * - 청크(`lazy`)가 오기 전 **첫 100ms 안팎**은 여전히 `SellerSectionLazy` 의 예약(첫 방문엔 0)이다.
   *   그 구간은 사람이 아직 읽기 전이고, 하네스의 첫 스냅(750ms)보다도 앞이라 측정에 안 잡힌다.
   *   **"첫 방문 0 밀림" 이라고 단정하지 말 것** — 측정이 못 본 구간이 있다.
   */
  const awaiting = !store
  /** 모르는 값의 자리. 글자는 있고 안 보인다 — 높이가 진짜와 같아진다. */
  const blank = (v: string) => (awaiting ? <span className="invisible">{v}</span> : v)

  const note = store?.status ? STATUS_NOTE[store.status] : undefined

  return (
    <div
      ref={rootRef}
      aria-busy={awaiting || undefined}
      className={`ur-content-medium lg:px-4 pt-4${awaiting ? ' pointer-events-none' : ''}`}
    >
      {/* 🔵 2026-09-29 (대표 확정 **안 C**) — **구역 띠를 걷었다.**
          09-28 의 띠(`w-[3px] bg-brand`)는 *"제목이 붙은 구역이 파는 쪽"* 이라는 이름 E 규칙을 구역
          전체로 늘린 표시였다. 안 C 는 **모든 구역**에 24px 제목을 주므로 그 규칙이 성립하지 않고,
          표시자는 **판**(흰 카드 + 파란 사용처리 줄)이 맡는다.
          그리고 표면 규칙 ②(*"강조색 하나, 자리 셋"*)로도 띠를 남길 수 없다 — 이 구역의 파란 자리는
          이미 셋이다(사용처리 면 · 확인 대기 숫자 · 받을 돈). 띠가 넷째가 된다.
          ⚠️ 되살린다면 PC 는 **음수 오프셋**이어야 한다(`lg:-left-3`) — 마이 PC 칸은
             `.ur-account-pane .ur-content-medium` 이 좌우 패딩을 0 으로 지워서, 양수면 띠가
             카드 **안쪽**을 세로로 관통한다(2026-09-28 에 하네스로 실측해 고친 결함이다). */}
      {/* 섹션 머리 — 오른쪽이 곧 가게 전환(2곳 이상일 때만 누를 수 있다) */}
      <div className="flex items-center gap-2 mb-2 px-4">
        {/* ⚠️ 크기·무게·색은 `SECTION_TITLE_CLS` 한 곳에서 온다 — 여기에 손으로 적으면
            2026-09-30 오전처럼 이 제목만 옛 값으로 남는다(시험이 대조한다). */}
        <h2 className={`leading-tight ${SECTION_TITLE_CLS}`}>내 가게</h2>
        <div className="flex-1" />
        {!awaiting && stores.length >= 2 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1 max-w-[60%] text-[12px] font-semibold text-gray-500 dark:text-gray-400 active:opacity-70"
          >
            {/* 🩸 2026-09-28 (하네스 실측) — 이름과 개수를 **다른 span** 으로 나눈다.
                한 span 에 `{이름} · N곳` 으로 붙여 놓으면 긴 가게 이름에서 말줄임이 **개수부터** 먹는다
                (`합정 살롱드합정 헤어&메이크업 본점 · …`). 그런데 이 줄이 눌리는 이유가 바로 그 개수다 —
                2곳 이상일 때만 전환 버튼이 되니까. 잘려야 하는 건 이름이지 개수가 아니다. */}
            <span className="truncate">{store.name}</span>
            <span className="shrink-0">· {stores.length}곳</span>
            <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 max-w-[60%] text-[12px] font-semibold text-gray-500 dark:text-gray-400">
            <UrShopIcon className={`w-3 h-3 shrink-0${awaiting ? ' invisible' : ''}`} aria-hidden="true" />
            <span className="truncate">{blank('가게 이름')}</span>
          </span>
        )}
      </div>

      {/* 🔵 2026-09-29 (대표 확정 **안 C**) — 판매 구역이 **판 하나**가 됐다.
          종전엔 [오늘 카드] [파란 사용처리 버튼] [매일 판] [가끔 판] [전체 도구 판] 으로 흰 판이 넷,
          그 사이 여백이 세 번이었다. 폰 한 화면(844px)에 판매 도구 3줄이 들어가고 손님 메뉴는
          **0줄**이었다(실측 `out/visual/my-firstscreen.png`).
          ⇒ 오늘 머리 + 파란 줄 + 도구 여덟 줄을 **한 판**에 담는다. 같은 화면에 판매 5줄 + 손님 3줄이
            들어오고, 그 판이 곧 *"여기가 파는 쪽"* 이라는 표시자다(종전엔 25px 제목이 하던 일 —
            안 C 는 모든 구역에 제목을 주므로 제목이 그 일을 못 한다).
          ⚠️ **PC 도 같은 판이다.** 09-28 의 `lg:flex` [오늘 | 사용처리] 가로 배치를 걷었다 —
             안 C 의 PC 시안이 세로로 쌓고, "오늘이 머리" 라는 그 결정의 내용은 그대로 지켜진다. */}
      <div className={LIST_PLATE_CLS}>
        {/* 🎨 파란 밴드 없음(2026-09-28 판단 승계): 바로 아래 파란 사용처리 줄과 면이 둘이 되면
            어느 쪽도 강조가 아니다. 주인공은 규칙 ③ 그대로 **숫자**다. */}
        <div className="border-b border-rule">
          {/* 🔢 2026-09-30 (대표 "다 순서대로 이상적으로") — **오늘 카드가 곧 매출 분석의 입구다.**
              종전엔 이 숫자 아래에 `매출 분석` 줄이 따로 있었다. 같은 데이터의 드릴다운인데
              줄 하나를 더 쓰고 있었던 셈이라, 그 줄을 지우고 **숫자를 누르면 열리게** 했다.
              ⚠️ 말 없는 클릭면을 만들지 않는다 — 오른쪽에 `매출 분석 ›` 라고 **적는다**.
                 (2026-07-02 상세의 "ChevronRight 로 클릭 유도하면서 onClick 없던 dead 어포던스" 의
                  정반대 실수 = onClick 은 있는데 아무 표시가 없는 것. 둘 다 안 된다.) */}
          <button
            type="button"
            disabled={entering}
            onClick={() => openTool('analytics')}
            className="w-full text-left px-4 pt-4 pb-4 active:opacity-70 disabled:opacity-60"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-bold text-gray-400">오늘</span>
              <span className="text-[12px] text-gray-400 tabular-nums">{blank(todayLabelKST())}</span>
            </div>
            {/* 🖥️ `whitespace-nowrap`: 좁은 칸에서 `412,000` 과 `원` 이 두 줄로 갈라지면 안 된다. */}
            <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap text-gray-900 dark:text-white">
              {blank(formatNumber(store?.today_revenue))}
              <span className={`text-[15px] font-bold text-gray-500 dark:text-gray-400 ml-1${awaiting ? ' invisible' : ''}`}>원</span>
            </p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-[13px] text-gray-500 dark:text-gray-400 min-w-0 truncate">
                {blank(`주문 ${formatNumber(store?.today_orders)}건`)}
                {!awaiting && store.pending > 0 && <> · 확인 대기 {formatNumber(store.pending)}건</>}
              </p>
              <span className="shrink-0 flex items-center gap-1 text-[13px] text-gray-500 dark:text-gray-400">
                매출 분석
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
          </button>
          {note && (
            <p className="text-[13px] leading-[1.55] text-gray-500 dark:text-gray-400 px-4 pb-4 -mt-1">
              {note}
            </p>
          )}
        </div>

        {/* 🎟️ 사용처리 — 하루에 가장 많이 누르는 버튼이라 도구들보다 위다. 화면에서 **유일한 파란 면**.
            ⚠️ **어느 가게로 소각되는지는 좌석이 정한다.** 그래서 먼저 이 가게 좌석에 앉히고 보낸다 —
            안 그러면 화면엔 A 가 떠 있는데 B 의 이용권이 소각된다(되돌릴 수 없다). */}
        <button
          type="button"
          disabled={entering}
          onClick={() => enterSeat('/store/scan')}
          className="w-full flex items-center gap-3 px-4 min-h-[52px] py-2 bg-brand text-white text-left active:opacity-90 disabled:opacity-60"
        >
          <ScanIcon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-[15px] font-extrabold truncate">이용권 사용처리</span>
          <span className="shrink-0 text-[13px] text-white/75">손님 QR</span>
          {entering
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-white/70" aria-hidden="true" />}
        </button>

        {/* 🧰 도구 여덟 줄 — 2026-09-26 의 **매일 셋 / 가끔 넷** 그룹 라벨을 걷었다.
            그 나눔의 근거는 *하루에 몇 번 여는가* 였는데, 48px 행이면 여덟 줄이 384px 에 다 들어와
            **한눈에 보이는 목록을 다시 쪼갤 이유가 없다**(라벨 둘이 먹던 48px 도 돌려받는다).
            순서는 그대로다 — 자주 쓰는 셋이 여전히 맨 위라 옛 근육기억이 안 깨진다. */}
        <ToolRow
          icon={<OrdersIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="주문"
          hint={work.orders.length > 0 ? `확인 대기 ${formatNumber(work.orders.length)}건` : '지난 주문 · 환불'}
          busy={entering}
          onClick={() => openTool('orders')}
        />
        <ToolRow
          icon={<TicketStubIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="이용권"
          hint={work.products.length > 0
            ? `판매 중 ${formatNumber(work.products.filter((p) => p.isActive).length)}개`
            : '등록 · 가격 · 수량'}
          busy={entering}
          onClick={() => openTool('vouchers')}
        />
        <ToolRow
          icon={<WonCoinIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="정산"
          hint="쌓인 돈 받기"
          busy={entering}
          onClick={() => openTool('withdraw')}
        />
        {/* 🧹 2026-09-30 — **바로가기 넷 + 전체 도구.** 여기 있던 `매출 분석 · 가게 · 소개 파트너 ·
            브랜드메시지` 를 뺐다. 지운 게 아니라 **바로 아래 `전체 도구` 가 같은 시트로 보낸다**
            (`COVERED_BY_SHEET` 가 네 주소를 전부 덮는다 — 한 번의 탭이 두 번이 될 뿐이다).
            매출 분석은 아예 사라지지도 않았다: 위 오늘 숫자가 그 입구가 됐다.
            **왜**: 바로가기가 아홉이면 바로가기가 아니다. 2026-09-26 이 그룹 라벨을 걷을 때의 근거는
            *"48px 행이면 여덟 줄이 384px 에 다 들어온다"* 였는데, 그건 이 목록만 떼어 본 계산이다.
            위(헤더 84 + 스탯 76 + 제목 44 + 오늘 카드 100)와 아래(탭 76)를 같이 재면
            **폰 한 화면(844px)이 `전체 도구` 에서 정확히 끝난다** — 손님 줄은 0, "내가 산 것" 제목조차
            안 보였다(실측 `--width=430 --height=844 --stores=1`).
            ⚠️ 남긴 넷의 기준은 **하루에 몇 번 여는가**다: 사용처리(손님마다) · 주문(매일) ·
               이용권(수량·가격) · 정산(주 1회). 뺀 넷은 전부 가끔이거나 한 번 정하면 끝인 것들이다. */}
        {/* 🩸 예시를 **문자열로 적어 두는 것을 그만뒀다** — 메뉴가 바뀔 때마다 어긋났고(쿠폰·숙소를
            내렸을 때 두 번), 개수를 세려면 나브 색인을 정적으로 읽어야 하는데 그 순간 청크가 딸려 온다. */}
        <ToolRow
          icon={<Search className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="전체 도구"
          hint="찾아서 바로 열기"
          busy={entering}
          onClick={() => openTool('tools')}
        />
      </div>

      {/* 🧰 할 일 — 좌석에 앉아 있을 때만, 그리고 **확인 대기가 있을 때만** 그린다
          (`PendingOrders` 는 0건이면 `null` 이라 평소엔 판이 하나로 남는다).
          ⚠️ **마이를 여는 것만으로 좌석을 발급하지 않는다**(`startDashboardSession` 이 단일 세션을
          갱신해 다른 기기의 대시보드를 끊는다). 사람이 펼치는 순간에만 앉는다 —
          오늘 숫자는 좌석 없이도 보이므로, 앉지 않은 사람도 "볼 것" 은 다 본다. */}
      {/* 🪑 기다리는 중엔 **좌석 토큰**으로 가른다 — `seatId` 는 동기라 첫 프레임에 이미 안다.
          ⚠️ 이 줄이 없으면 껍데기가 늘 '주문 확인' 버튼(60px)을 그리고, 좌석에 앉은 사람은
             도착 순간 그 60px 이 사라지며 손님 줄이 위로 당겨진다(2026-10-01 실측 −60px —
             빈 칸 예약으로 이미 0 이던 **재방문까지** 나빠졌다). 측정이 그걸 잡았다. */}
      {(awaiting ? seatId != null : seated) ? (
        awaiting ? null : (
        <>
          <PendingOrders work={work} onDone={onWorkDone} />
          {work.failed && (
            <p className="mt-2 px-4 text-[12px] text-gray-500 dark:text-gray-400">
              목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
            </p>
          )}
        </>
        )
      ) : (
        <button
          type="button"
          disabled={entering}
          onClick={() => enterSeat()}
          className="w-full flex items-center gap-2 mt-3 px-4 h-12 rounded-2xl bg-surface shadow-lift text-left active:opacity-70 disabled:opacity-50"
        >
          <span className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate">
            {awaiting ? <span className="invisible">주문 확인</span> : `주문 확인${store.pending > 0 ? ` ${formatNumber(store.pending)}건` : ''}`}
          </span>
          {entering
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />}
        </button>
      )}

      {/* ⏳ 시트는 전부 lazy 다 — 폴백이 `null` 인 이유는 머리말에 적었다(누른 직후 깜빡임 방지).
          시트 자신이 각자 로딩 표시를 갖고 있으므로 여기서 또 그리면 표시가 두 겹이 된다. */}
      {/* 🪟 판매 시트는 **가게를 알 때만** 존재한다 — 기다리는 중(껍데기)엔 `store` 가 null 이고,
          그 사이에는 열 수 있는 길도 없다(`pointer-events-none` + 모든 핸들러가 `!store` 가드). */}
      {store && (
      <Suspense fallback={null}>
      {/* 🧾 주문 — 확인 전이는 `useSellerWork` 것을 쓴다(전이 규칙이 두 벌이 되지 않게).
          환불은 시트 안에서 부르되 **별도 시트**로 연다(사유를 적어야 하는 일이라 섞지 않는다). */}
      {tool === 'orders' && (
        <OrdersSheet
          sellerId={store.seller_id}
          work={work}
          onClose={() => setTool(null)}
          onDone={onWorkDone}
          onRefund={() => setTool('refund')}
        />
      )}
      {tool === 'vouchers' && (
        <VoucherSheet
          sellerId={store.seller_id}
          work={work}
          onClose={() => setTool(null)}
          onOpenPath={(path) => { setTool(null); enterSeat(path) }}
        />
      )}
      {tool === 'store' && (
        <StoreSheet
          sellerId={store.seller_id}
          statusNote={note}
          canSwitch={stores.length >= 2}
          onSwitch={() => { setTool(null); setSheetOpen(true) }}
          onClose={() => setTool(null)}
          onSaved={() => state.refetch()}
        />
      )}
      {/* ↩️ 환불은 **주문에서만** 열린다 — 닫으면 그 목록으로 돌아온다(어디서 왔는지 잊지 않게). */}
      {tool === 'refund' && <RefundSheet sellerId={store.seller_id} onClose={() => setTool('orders')} onDone={() => { state.refetch(); work.refetch(); setTool('orders') }} />}
      {tool === 'analytics' && <AnalyticsSheet sellerId={store.seller_id} storeName={store.name} onClose={() => setTool(null)} />}
      {/* 🔑🏦 2026-09-26 (§20-5): 출금이 막히면 **그 자리에서** 푼다 — 돈이 나가는 흐름 한복판에서
          대시보드로 보내지 않는다. 풀고 나면 요구한 시트로 되돌아온다(`pinReturn`). */}
      {tool === 'withdraw' && (
        <WithdrawSheet
          sellerId={store.seller_id}
          onClose={() => setTool(null)}
          onDone={() => state.refetch()}
          onFixPin={() => { setPinReturn('withdraw'); setTool('pin') }}
          onFixBank={() => setTool('bank')}
          onHistory={() => setTool('settlements')}
        />
      )}
      {tool === 'pin' && <PinSheet sellerId={store.seller_id} onClose={() => setTool(null)} onDone={() => setTool(pinReturn)} />}
      {/* 🔑 계좌 변경도 412 를 준다(서버가 계좌 탈취를 막는다) — 그때는 **계좌로** 돌아와야 한다. */}
      {tool === 'bank' && (
        <BankSheet
          sellerId={store.seller_id}
          onClose={() => setTool(null)}
          onDone={() => setTool('withdraw')}
          onFixPin={() => { setPinReturn('bank'); setTool('pin') }}
        />
      )}
      {tool === 'partners' && (
        <PartnersSheet
          sellerId={store.seller_id}
          onClose={() => setTool(null)}
          onOpenPath={(path) => { setTool(null); enterSeat(path) }}
        />
      )}
      {tool === 'messages' && (
        <MessagesSheet
          sellerId={store.seller_id}
          onClose={() => setTool(null)}
          onOpenPath={(path) => { setTool(null); enterSeat(path) }}
        />
      )}
      {/* ↩️ 지난 정산은 **출금에서만** 열린다 — 닫으면 출금으로 돌아온다(주문 → 환불과 같은 배치). */}
      {tool === 'settlements' && <SettlementsSheet sellerId={store.seller_id} onClose={() => setTool('withdraw')} />}
      {tool === 'tools' && (
        <AllToolsSheet
          storeName={store.name}
          onClose={() => setTool(null)}
          onPick={(path, label, inSheet) => {
            // 🔀 손수 시트가 덮는 일이면 **그리로** 보낸다 — 같은 일에 화면이 둘이 되지 않게(위 표).
            const covered = COVERED_BY_SHEET[path]
            if (covered) { setTool(covered); return }
            // 🪟 나머지는 시트 안에서 열린다 — 나가는 둘만 종전처럼 전체화면으로
            //   (이유는 `tool-pages.ts` 의 FULL_SCREEN_ONLY 에 값으로 적혀 있다).
            //   ⚠️ 판정은 시트가 해서 넘겨준다 — 여기서 `tool-pages` 를 읽으면 그 지도가
            //      **정적 의존**이 되어 시트 청크 전체가 마이에 붙는다(lazy 가 무의미해진다).
            if (inSheet) { setPage({ path, title: label }); setTool('page'); return }
            setTool(null); enterSeat(path)
          }}
        />
      )}
      {/* ↩️ 닫으면 **전체 도구로** 돌아온다 — 도구를 하나 보고 다음 도구를 보는 흐름이 끊기지 않게. */}
      {tool === 'page' && page && (
        <ToolPageSheet
          path={page.path}
          title={page.title}
          onClose={() => { setPage(null); setTool('tools') }}
          /* 🚪 안쪽이 셀러 밖(`/`·`/u/me` …)을 가리켰다 — 시트를 닫고 진짜로 보낸다.
             그대로 두면 메모리 라우터엔 그 주소가 없어 **빈 화면**이 된다. */
          onLeave={(to) => { setPage(null); setTool(null); window.location.assign(to) }}
        />
      )}

      {sheetOpen && (
        <StoreSwitchSheet currentSellerId={store.seller_id} onClose={() => setSheetOpen(false)} />
      )}
      </Suspense>
      )}

      {/* ─ 구역 경계 (2026-09-28 이름 E) — 여기까지가 **파는 쪽**이고 아래는 손님 쪽이다.
          선을 이 컴포넌트 안에 두는 이유: 이 섹션은 좌석이 없거나 조회가 실패하면 `null` 을 돌려주는데,
          페이지가 `stores.length` 로 따로 판정해 선을 그리면 **위에 아무것도 없는 선**이 뜨는 날이 온다
          (판정이 두 곳이면 갈린다 — 이 레포가 반복해 당한 클래스). 같은 렌더에 붙여 두면 갈릴 수가 없다.
          🖥️ 2026-09-28 `lg:hidden`: PC 는 09-28 부터 **두 열**이라 손님 쪽이 아래가 아니라 **옆**에 있다.
             그 화면에서 이 선은 아무것도 가르지 않고 판매 열 끝에 뜬 유리선으로 보였다(하네스 실측).
             선을 **지우지는 않는다** — 세로로 흐르는 폰에서는 이 선이 이름 E 의 경계 그 자체다. */}
      {/* 🔵 2026-09-29 (안 C): 구역 경계선을 걷었다 — 아래 구역이 **자기 24px 제목**으로 시작하므로
          선이 할 일이 없다(09-28 에는 손님 구역에 제목이 없어서 선이 그 경계를 대신했다). */}
    </div>
  )
}
