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
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { BarChart3, ChevronDown, ChevronRight, ClipboardList, Handshake, Loader2, MessageSquare, ScanLine, Store, Ticket, Wallet } from 'lucide-react'
import { TicketCard } from '@/components/ticket/TicketCard'
import { formatNumber } from '@/utils/format'
import { currentSeatId, onSeatChange, switchSeat } from '@/lib/seller-seat'
import { clearMyReturn, withMyReturn } from '@/lib/seller-return'
import { toast } from '@/hooks/useToast'
import type { MyStoresState } from './useMyStores'
import StoreSwitchSheet from './StoreSwitchSheet'
import { useSellerWork } from './seller-section/useSellerWork'
import PendingOrders from './seller-section/PendingOrders'
import RefundSheet from './seller-section/RefundSheet'
import AnalyticsSheet from './seller-section/AnalyticsSheet'
import WithdrawSheet from './seller-section/WithdrawSheet'
import AllToolsSheet from './seller-section/AllToolsSheet'
import PinSheet from './seller-section/PinSheet'
import BankSheet from './seller-section/BankSheet'
import OrdersSheet from './seller-section/OrdersSheet'
import VoucherSheet from './seller-section/VoucherSheet'
import StoreSheet from './seller-section/StoreSheet'
import PartnersSheet from './seller-section/PartnersSheet'
import MessagesSheet from './seller-section/MessagesSheet'
import SettlementsSheet from './seller-section/SettlementsSheet'

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
  | 'partners' | 'messages' | 'settlements'

/** 묶음 한 줄 — 전부 같은 모양이어야 무엇이 있는지 한눈에 읽힌다. */
function ToolRow({ icon, label, hint, busy, onClick }: {
  icon: React.ReactNode; label: string; hint: string; busy: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-rule last:border-b-0 active:opacity-70 disabled:opacity-50"
    >
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{label}</span>
        <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{hint}</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
    </button>
  )
}

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

  // 좌석 0곳(= 셀러가 아님) · 첫 로드 중 · 실패 → 아무것도 그리지 않는다.
  //   실패를 0 으로 그리면 "오늘 매출 0원" 이라는 거짓말이 된다(머니 표면 룰).
  if (loading || failed || !store) return null

  const note = store.status ? STATUS_NOTE[store.status] : undefined

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-4">
      {/* 섹션 머리 — 오른쪽이 곧 가게 전환(2곳 이상일 때만 누를 수 있다) */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-[13px] font-extrabold text-gray-900 dark:text-white">내 가게</h2>
        <div className="flex-1" />
        {stores.length >= 2 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1 max-w-[60%] text-[12px] font-semibold text-gray-500 dark:text-gray-400 active:opacity-70"
          >
            <span className="truncate">{store.name} · {stores.length}곳</span>
            <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 max-w-[60%] text-[12px] font-semibold text-gray-500 dark:text-gray-400">
            <Store className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{store.name}</span>
          </span>
        )}
      </div>

      <TicketCard bandLeft="오늘" bandRight={todayLabelKST()}>
        <div className="px-4 pt-4 pb-4">
          <p className="text-[30px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
            {formatNumber(store.today_revenue)}
            <span className="text-[16px] font-bold text-gray-500 dark:text-gray-400 ml-1">원</span>
          </p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">
            주문 {formatNumber(store.today_orders)}건
            {store.pending > 0 && <> · 확인 대기 {formatNumber(store.pending)}건</>}
          </p>
          {note && (
            <p className="text-[12.5px] leading-[1.55] text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-rule">
              {note}
            </p>
          )}
        </div>
      </TicketCard>

      {/* 🎟️ 사용처리 — 손님 앞에서 하루에 가장 많이 누르는 버튼이라 일감보다 위다.
          ⚠️ **어느 가게로 소각되는지는 좌석이 정한다.** 그래서 먼저 이 가게 좌석에 앉히고 보낸다 —
          안 그러면 화면엔 A 가 떠 있는데 B 의 이용권이 소각된다(되돌릴 수 없다). */}
      <button
        type="button"
        disabled={entering}
        onClick={() => enterSeat('/store/scan')}
        className="w-full flex items-center gap-3 mt-3 px-4 h-[60px] rounded-2xl bg-brand text-white text-left active:opacity-90 disabled:opacity-60"
      >
        <ScanLine className="w-6 h-6 shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold">이용권 사용처리</span>
          <span className="block text-[11.5px] text-white/80 mt-0.5">손님 QR 을 찍으세요</span>
        </span>
        {entering
          ? <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
          : <ChevronRight className="w-5 h-5 shrink-0 text-white/70" aria-hidden="true" />}
      </button>

      {/* 🧰 일감 — 좌석에 앉아 있을 때만 그린다.
          ⚠️ **마이를 여는 것만으로 좌석을 발급하지 않는다**(`startDashboardSession` 이 단일 세션을
          갱신해 다른 기기의 대시보드를 끊는다). 사람이 펼치는 순간에만 앉는다 —
          오늘 숫자는 좌석 없이도 보이므로, 앉지 않은 사람도 "볼 것"은 다 본다. */}
      {seated ? (
        <>
          <PendingOrders work={work} onDone={onWorkDone} />
          {work.failed && (
            <p className="mt-2 px-1 text-[12px] text-gray-500 dark:text-gray-400">
              목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
            </p>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={entering}
          onClick={() => enterSeat()}
          className="w-full flex items-center gap-2 mt-3 px-4 h-14 rounded-2xl bg-surface shadow-lift text-left active:opacity-70 disabled:opacity-50"
        >
          <span className="flex-1 min-w-0 text-[14px] font-bold text-gray-900 dark:text-white truncate">
            주문 확인{store.pending > 0 ? ` ${formatNumber(store.pending)}건` : ''}
          </span>
          {entering
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />}
        </button>
      )}

      {/* 🧰 묶음 다섯 — 대표 §21: *"일단 마이에서 대부분 끝내야 해"*.
          한 줄이 한 묶음이고, 그 안에서 일이 끝난다. 도구가 늘어도 줄은 안 늘어난다.
          ⚠️ 줄은 **좌석 없이도 보인다** — 좌석 토큰은 사람이 누른 순간에만 발급된다
             (마이를 여는 것만으로 발급하면 다른 기기의 대시보드 세션을 끊는다). */}
      <div className="mt-3 rounded-2xl bg-surface shadow-lift overflow-hidden">
        <ToolRow
          icon={<ClipboardList className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="주문"
          hint={work.orders.length > 0
            ? `확인 대기 ${formatNumber(work.orders.length)}건 · 지난 주문까지`
            : '지난 주문 · 손님 연락처 · 환불'}
          busy={entering}
          onClick={() => openTool('orders')}
        />
        <ToolRow
          icon={<Ticket className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="이용권"
          hint={work.products.length > 0
            ? `판매 중 ${formatNumber(work.products.filter((p) => p.isActive).length)}개 · 가격·수량 고치기`
            : '등록 · 가격 · 수량 · 판매 중지'}
          busy={entering}
          onClick={() => openTool('vouchers')}
        />
        <ToolRow
          icon={<Wallet className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="정산"
          hint="쌓인 돈 받기 · 계좌 · PIN"
          busy={entering}
          onClick={() => openTool('withdraw')}
        />
        <ToolRow
          icon={<BarChart3 className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="매출 분석"
          hint="최근 2주 추이와 이번 달 합계"
          busy={entering}
          onClick={() => openTool('analytics')}
        />
        <ToolRow
          icon={<Store className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="가게"
          hint={stores.length >= 2 ? '이름 · 연락처 · 주소 · 가게 전환' : '이름 · 연락처 · 주소 · 소개'}
          busy={entering}
          onClick={() => openTool('store')}
        />
        {/* 🤝 소개 파트너 — 라이브 실측으로 **살아 있는** 기능이라 묶음으로 올렸다
            (제안 1건 active · 팔로워 3). 쿠폰·숙소와 판정이 다르다. */}
        <ToolRow
          icon={<Handshake className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="소개 파트너"
          hint="내 이용권을 담아 파는 사람 · 받은 제안"
          busy={entering}
          onClick={() => openTool('partners')}
        />
        {/* 💬 브랜드메시지 — 여기서는 **보내지 않는다**(발송은 등급 C). 잔액·최근 발송만 읽고,
            충전·발송은 전용 화면으로 보낸다. 아직 안 쓴 가게에는 시트가 스스로 안내 한 장이 된다. */}
        <ToolRow
          icon={<MessageSquare className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="브랜드메시지"
          hint="단골에게 카카오톡 안내 · 남은 건수"
          busy={entering}
          onClick={() => openTool('messages')}
        />
      </div>

      {/* 🧰 나머지 전부 — 사업자등록증·운영자 위임·세금계산서처럼 **드물게 한 번** 하는 일.
          2026-09-26 에 알림톡·소개 파트너가 묶음으로 올라오고 쿠폰·숙소가 내려가서 이 줄의
          예시도 함께 바꿨다(문구가 실제 목록과 어긋나면 사장님이 없는 메뉴를 찾는다). */}
      <button
        type="button"
        disabled={entering}
        onClick={() => openTool('tools')}
        className="w-full flex items-center gap-2 mt-2 px-1 py-3 text-left active:opacity-70 disabled:opacity-50"
      >
        <span className="flex-1 min-w-0 text-[13px] font-semibold text-gray-500 dark:text-gray-400 truncate">
          전체 도구 · 사업자등록증 · 운영자 위임 · 운영 가이드
        </span>
        {entering
          ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
          : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />}
      </button>

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
          onPick={(path) => { setTool(null); enterSeat(path) }}
        />
      )}

      {sheetOpen && (
        <StoreSwitchSheet currentSellerId={store.seller_id} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
