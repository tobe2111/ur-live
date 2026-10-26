/**
 * 🏢 에이전시 콘솔 — 고른 매장의 **판** (2026-10-12, 셀러 대시보드 제거 2단계 · 대표 확정 안 A)
 *   대표: *"A안으로 해줘. 이건 PC버전도 중요해"*
 *
 * 마이의 판매 구역(`src/pages/user-profile/SellerSection.tsx`)과 **같은 판**이다 —
 * 오늘 숫자(누르면 매출 분석) · 이용권 사용처리 티켓 · 이용권 등록·관리(유일한 진한 블루) · 주문 · 정산 · 전체 도구.
 * 도구는 대시보드로 보내지 않고 **같은 시트**(`ToolPageSheet` = 대시보드 화면을 시트 안에 그대로)로 연다.
 * 그래서 에이전시 직원이 셀러 대시보드 껍데기를 볼 일이 없어진다 — 그게 이 단계의 목적이다.
 *
 * ## 왜 마이 판을 그대로 import 하지 않나
 * 마이 판은 사람의 좌석 목록(`/my-stores/summary`)과 카카오 소비자 계정에 묶여 있고, 테스트 42곳이 그 파일을
 * 붙들고 있다. 대신 **생김새를 정하는 클래스**를 두 파일이 같게 쓰고, 시험이 그 짝을 대조한다
 * (`agency-console-plate-2026-10-12.test.ts`). 한쪽만 바뀌면 빨간불이다.
 *
 * ## 🪑 좌석은 누를 때만
 * 콘솔을 여는 것만으로 매장 좌석을 받지 않는다(마이와 같은 규칙). 오늘 숫자는 목록 응답에 실려 와서
 * 좌석 없이도 보인다. 도구를 누르는 순간 그 매장 좌석에 앉고(`enterAgencyStore`), 이미 이 직원의 그 매장
 * 좌석이면 다시 받지 않는다(`isMyAgencySeat` — 직원 id 까지 본다).
 *
 * ## 🤝 2026-10-24 — 한 매장 · 여러 에이전시 · **자기 이용권만** (대표 확정)
 * 대표: *"사장님 직접 관리와 에이전시 관리가 동시에 … 성과나 이런건 분리가 철저히 되고. 한 매장이 여러 에이전시와
 * 함께 할 수 있는거지."* → 성과 = 이용권 단위 · 에이전시는 자기 것만 본다.
 * 그래서 판은 **이 에이전시가 맡은 이용권**만 다룬다: 오늘 숫자도 그 이용권 몫이고(`agency-store-today`),
 * 매장 전체를 여는 도구(주문 · 정산 · 매출 분석 · 전체 도구 · 사용처리)는 판에서 뺐다 — 서버도 에이전시 좌석에게
 * 그 API 를 막는다(`agency-product-scope` 기본 차단). 화면만 숨기면 깊은 링크로 열리고, 서버만 막으면 누를 때마다
 * 403 이 뜬다 — 둘이 짝이다.
 *
 * ## 💰 돈은 사장님 몫
 * 정산은 **보기만** 열린다. 출금·계좌·PIN 은 서버가 매장 주인만 받는다(`store-actor`) — 그래서 마이의
 * 출금 시트(`WithdrawSheet`)를 여기 두지 않고 정산 화면을 시트로 연다.
 */
import { Suspense, lazy, useState } from 'react'
import { ChevronRight, Loader2, Plus } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import { LIST_PLATE_CLS } from '@/pages/user-profile/list-grammar'
import { STORE_SCAN_PATH, ownPathFor } from '@/lib/seller-deep-link'
import { enterAgencyStore, isMyAgencySeat } from './agency-api'
import { AGENCY_PLATE_SCOPE_NOTE, isAgencyScreen, type StoreRow } from './agency-stores-model'

const ToolPageSheet = lazy(() => import('@/pages/user-profile/seller-section/ToolPageSheet'))
const VoucherNewSheet = lazy(() => import('@/pages/user-profile/seller-section/VoucherNewSheet'))

/** 매장 상태를 판이 **직접 말한다** — 왜 노출·정산이 아직인지 화면이 안 말하면 고장으로 읽힌다. */
export const AGENCY_STATUS_NOTE: Record<string, string> = {
  pending: '유어딜 승인 대기 중이에요. 이용권은 지금 준비하고, 메인 노출과 정산은 승인 뒤에 시작돼요.',
  rejected: '서류가 반려됐어요. 사장님이 사업자등록증을 다시 올리면 바로 다시 심사해요.',
  suspended: '이용이 정지된 매장이에요. 지금은 도구를 열 수 없어요.',
}

/**
 * 사용처리는 카메라 화면이라 시트가 아니라 전체화면이다(`tool-pages.ts` `FULL_SCREEN_ONLY`).
 * 🚪 2026-10-12 — 마이와 **같은 계산대**(`/store/scan`)로 간다. 종전엔 `/store/scan` 라우트가 소비자 로그인
 *   (`requireUser`)을 요구해서 소비자 계정이 없는 에이전시 직원은 대시보드 `/seller/scan` 으로 보내야 했다.
 *   그 화면은 원래 좌석 토큰(또는 스캔 기기 키)만 보고 서버가 그 토큰으로 매장을 고르므로, 라우트 쪽 요구를 걷었다.
 */
export const AGENCY_SCAN_PATH = STORE_SCAN_PATH

function todayLabelKST(): string {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })
}

export default function AgencyStorePlate({ store, staffId, initialPath, onOpenSales }: {
  store: StoreRow
  staffId: number
  /** 📊 우리 이용권 판매 내역·통계 시트(2026-10-24) — 패널이 연다(판매 알림을 눌러도 같은 시트). 좌석 없이 본다. */
  onOpenSales?: () => void
  /**
   * 🚪 깊은 링크(`/agency?tool=`)로 온 화면 — 처음부터 시트로 열어 둔다. **좌석 판정은 호출부(패널)가 이미 했다**
   *   (이 직원의 이 매장 좌석일 때만 넘긴다). 그래서 여기서는 발급하지 않고 effect 도 없다.
   *   머리 이름은 비워 둔다 — 시트가 나브 색인에서 찾는다(`titleForPath`).
   */
  initialPath?: string
}) {
  const [entering, setEntering] = useState(false)
  // 🚪 깊은 링크가 이용권 등록이면 대시보드 화면 대신 **등록 시트**로 연다(마이와 같은 판정 — `OWN_PATH`).
  //   🤝 에이전시가 열 수 있는 화면만 받는다 — 매장 전체 화면 주소가 오면 무시하고 판으로 연다.
  if (initialPath && !isAgencyScreen(initialPath)) initialPath = undefined
  const initialOwn = initialPath ? ownPathFor(initialPath) : null
  const [tool, setTool] = useState<'page' | 'voucherNew' | null>(initialOwn === 'voucherNew' ? 'voucherNew' : initialPath ? 'page' : null)
  const [page, setPage] = useState<{ path: string; title: string } | null>(initialPath && !initialOwn ? { path: initialPath, title: '' } : null)
  const today = store.today
  const suspended = store.storeStatus === 'suspended'
  const note = store.storeStatus ? AGENCY_STATUS_NOTE[store.storeStatus] : undefined
  const busy = entering || suspended

  async function ensureSeat(): Promise<boolean> {
    if (entering || suspended) return false
    if (isMyAgencySeat(store.sellerId, staffId)) return true
    setEntering(true)
    const r = await enterAgencyStore(store.sellerId, store.name)
    setEntering(false)
    if (!r.ok) { toast.error(r.error); return false }
    return true
  }

  async function openPage(path: string, title: string) {
    if (!(await ensureSeat())) return
    setPage({ path, title })
    setTool('page')
  }

  return (
    <>
      <div className={LIST_PLATE_CLS}>
        {/* 🤝 오늘 숫자 = **이 에이전시가 맡은 이용권** 몫. 매장 전체 매출이 아니라서 매출 분석(매장 전체)으로 보내지 않는다. */}
        <div className="border-b border-rule px-4 pt-4 pb-4 lg:px-5 lg:py-5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-gray-400 dark:text-gray-500">오늘 · 우리 이용권</span>
            <span className="text-[12px] text-gray-400 dark:text-gray-500 tabular-nums">{todayLabelKST()}</span>
          </div>
          <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap text-gray-900 dark:text-white">
            {today ? formatNumber(today.todayRevenue) : '—'}
            <span className="text-[15px] font-bold text-gray-500 dark:text-gray-400 ml-1">원</span>
          </p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 min-w-0 truncate">
            {today ? `주문 ${formatNumber(today.todayOrders)}건` : '오늘 숫자를 불러오지 못했어요'}
            {today && today.pending > 0 && <> · 확인 대기 {formatNumber(today.pending)}건</>}
          </p>
        </div>
        {note && <p className="text-[13px] leading-[1.55] text-gray-500 dark:text-gray-400 px-4 py-3 border-b border-rule lg:px-5">{note}</p>}
        <div className="p-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => openPage('/seller/group-buy', '우리 이용권')}
          className="w-full flex items-center gap-3 px-4 lg:px-5 min-h-[52px] py-2 rounded-[10px] bg-brand text-white text-left active:opacity-90 disabled:opacity-60"
        >
          <Plus className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-[15px] font-extrabold truncate">이용권 등록 · 관리</span>
          {today && (
            <span className="shrink-0 text-[13px] text-white/75 tabular-nums">
              {today.activeProducts > 0 ? `판매 중 ${formatNumber(today.activeProducts)}개` : '아직 0개'}
            </span>
          )}
          {entering
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-white/70" aria-hidden="true" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-white/70" aria-hidden="true" />}
        </button>
        {onOpenSales && (
          <button
            type="button"
            onClick={onOpenSales}
            className="mt-2 w-full flex items-center gap-3 px-4 lg:px-5 min-h-[48px] rounded-[10px] text-left active:bg-gray-50 dark:active:bg-white/5"
          >
            <span className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate">판매 내역 · 통계</span>
            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          </button>
        )}
        <p className="mt-3 px-1 text-[12px] leading-[1.55] text-gray-500 dark:text-gray-400">
          {AGENCY_PLATE_SCOPE_NOTE}
        </p>
        </div>
      </div>

      <Suspense fallback={null}>
        {tool === 'voucherNew' && (
          /* 등록 완료 화면의 '내 이용권 보기' 가 부른다 — 대시보드 대신 같은 이용권 목록을 시트로. */
          <VoucherNewSheet onClose={() => setTool(null)} onCreated={() => { setPage({ path: '/seller/group-buy', title: '우리 이용권' }); setTool('page') }} />
        )}
        {tool === 'page' && page && (
          <ToolPageSheet
            path={page.path}
            title={page.title}
            onClose={() => { setPage(null); setTool(null) }}
            /* 🚪 안쪽이 셀러 밖을 가리켰다 — 메모리 라우터엔 그 주소가 없어 빈 화면이 된다. 닫고 진짜로 보낸다. */
            onLeave={(to) => { setPage(null); setTool(null); window.location.assign(to) }}
          />
        )}
      </Suspense>
    </>
  )
}
