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
 * ## 💰 돈은 사장님 몫
 * 정산은 **보기만** 열린다. 출금·계좌·PIN 은 서버가 매장 주인만 받는다(`store-actor`) — 그래서 마이의
 * 출금 시트(`WithdrawSheet`)를 여기 두지 않고 정산 화면을 시트로 연다.
 */
import { Suspense, lazy, useState } from 'react'
import { ChevronRight, Loader2, Plus, Search } from 'lucide-react'
import { OrdersIcon, WonCoinIcon } from '@/components/icons/urdeal-icons'
import { QrScanIcon } from '@/components/icons/qr-scan-icon'
import { formatNumber } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import { LIST_PLATE_CLS, ListRow as ToolRow } from '@/pages/user-profile/list-grammar'
import { dashboardFallback } from '@/lib/seller-deep-link'
import { STORE_SCAN_PATH } from '@/pages/user-profile/seller-section/tool-pages'
import { enterAgencyStore, isMyAgencySeat } from './agency-api'
import type { StoreRow } from './agency-stores-model'

const ToolPageSheet = lazy(() => import('@/pages/user-profile/seller-section/ToolPageSheet'))
const AllToolsSheet = lazy(() => import('@/pages/user-profile/seller-section/AllToolsSheet'))
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

export default function AgencyStorePlate({ store, staffId, initialPath }: {
  store: StoreRow
  staffId: number
  /**
   * 🚪 깊은 링크(`/agency?tool=`)로 온 화면 — 처음부터 시트로 열어 둔다. **좌석 판정은 호출부(패널)가 이미 했다**
   *   (이 직원의 이 매장 좌석일 때만 넘긴다). 그래서 여기서는 발급하지 않고 effect 도 없다.
   *   머리 이름은 비워 둔다 — 시트가 나브 색인에서 찾는다(`titleForPath`).
   */
  initialPath?: string
}) {
  const [entering, setEntering] = useState(false)
  const [tool, setTool] = useState<'tools' | 'page' | 'voucherNew' | null>(initialPath ? 'page' : null)
  const [page, setPage] = useState<{ path: string; title: string } | null>(initialPath ? { path: initialPath, title: '' } : null)
  /** 전체 도구에서 연 화면은 닫으면 그 목록으로 돌아간다(마이와 같은 흐름). */
  const [pageFrom, setPageFrom] = useState<'tools' | null>(null)
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

  async function openPage(path: string, title: string, from: 'tools' | null = null) {
    if (!(await ensureSeat())) return
    setPage({ path, title })
    setPageFrom(from)
    setTool('page')
  }

  async function goFull(path: string) {
    if (!(await ensureSeat())) return
    // 🧾 계산대는 대시보드 밖 화면이라 `dash=1` 이 필요 없다(껍데기를 안 탄다). 뒤로가기가 콘솔로 돌아온다.
    if (path === STORE_SCAN_PATH) { window.location.assign(path); return }
    // 🔁 `dash=1` — 껍데기가 이 직원을 다시 콘솔로 돌려보내지 않게(일부러 연 전체화면이다).
    window.location.assign(dashboardFallback(path))
  }

  return (
    <>
      <div className={LIST_PLATE_CLS}>
        {/* 🖥️ PC 는 [오늘 | 사용처리] 두 칸(안 A PC 시안). 폰은 세로로 쌓는다. */}
        <div className="border-b border-rule lg:grid lg:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => openPage('/seller/analytics', '매출 분석')}
            className="w-full text-left px-4 pt-4 pb-4 lg:px-5 lg:py-5 lg:border-r lg:border-rule active:opacity-70 disabled:opacity-60"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-bold text-gray-400">오늘</span>
              <span className="text-[12px] text-gray-400 tabular-nums">{todayLabelKST()}</span>
            </div>
            <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap text-gray-900">
              {today ? formatNumber(today.todayRevenue) : '—'}
              <span className="text-[15px] font-bold text-gray-500 ml-1">원</span>
            </p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-[13px] text-gray-500 min-w-0 truncate">
                {today ? `주문 ${formatNumber(today.todayOrders)}건` : '오늘 숫자를 불러오지 못했어요'}
                {today && today.pending > 0 && <> · 확인 대기 {formatNumber(today.pending)}건</>}
              </p>
              <span className="shrink-0 flex items-center gap-1 text-[13px] text-gray-500">
                매출 분석
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
          </button>
          <div className="p-3 border-t border-rule lg:border-t-0 lg:flex">
            <button
              type="button"
              disabled={busy}
              onClick={() => goFull(AGENCY_SCAN_PATH)}
              className="relative w-full flex items-stretch min-h-[64px] rounded-[10px] bg-brand-tint text-gray-900 text-left overflow-hidden active:opacity-80 disabled:opacity-60"
            >
              <span aria-hidden="true" className="absolute -left-[9px] top-1/2 -mt-[9px] w-[18px] h-[18px] rounded-full bg-surface" />
              <span aria-hidden="true" className="absolute -right-[9px] top-1/2 -mt-[9px] w-[18px] h-[18px] rounded-full bg-surface" />
              <span className="flex-1 min-w-0 flex flex-col justify-center pl-5 pr-4 py-3">
                <span className="text-[15px] font-extrabold truncate">이용권 사용처리</span>
                <span className="mt-1 text-[12px] text-gray-500 truncate">손님 QR을 찍어요</span>
              </span>
              <span aria-hidden="true" className="border-l-2 border-dashed border-brand/35" />
              <span className="shrink-0 flex items-center justify-center w-[72px] text-brand-text">
                {entering
                  ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  : <QrScanIcon size={32} aria-hidden="true" />}
              </span>
            </button>
          </div>
        </div>
        {note && <p className="text-[13px] leading-[1.55] text-gray-500 px-4 py-3 border-b border-rule lg:px-5">{note}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => openPage('/seller/group-buy', '이용권')}
          className="w-full flex items-center gap-3 px-4 lg:px-5 min-h-[52px] py-2 bg-brand text-white text-left active:opacity-90 disabled:opacity-60"
        >
          <Plus className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-[15px] font-extrabold truncate">이용권 등록 · 관리</span>
          {today && (
            <span className="shrink-0 text-[13px] text-white/75 tabular-nums">
              {today.activeProducts > 0 ? `판매 중 ${formatNumber(today.activeProducts)}개` : '아직 0개'}
            </span>
          )}
          <ChevronRight className="w-4 h-4 shrink-0 text-white/70" aria-hidden="true" />
        </button>
        {/* 🖥️ PC 는 세 줄을 한 줄 세 칸으로 — 넓은 칸에 48px 줄 셋이 세로로 서면 오른쪽이 텅 빈다.
            ⚠️ 칸이 좁아 오른쪽 값은 짧게만(여덟 자 안팎). 길면 제목이 0px 로 눌려 **'정산' 글자가 사라졌다**(하네스 실측).
            출금이 사장님 몫이라는 말은 정산 화면이 직접 한다(서버가 주인만 받는다). */}
        <div className="lg:grid lg:grid-cols-3 lg:[&>*:not(:last-child)]:border-r lg:[&>*]:border-rule">
          <ToolRow
            icon={<OrdersIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
            label="주문"
            hint={today && today.pending > 0 ? `확인 대기 ${formatNumber(today.pending)}건` : '지난 주문 · 환불'}
            busy={busy}
            onClick={() => openPage('/seller/orders', '주문')}
          />
          <ToolRow
            icon={<WonCoinIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
            label="정산"
            hint="보기만"
            busy={busy}
            onClick={() => openPage('/seller/settlements', '정산')}
          />
          <ToolRow
            icon={<Search className="w-[18px] h-[18px]" aria-hidden="true" />}
            label="전체 도구"
            busy={busy}
            onClick={async () => { if (await ensureSeat()) setTool('tools') }}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        {tool === 'tools' && (
          <AllToolsSheet
            storeName={store.name}
            onClose={() => setTool(null)}
            onPick={(path, label, inSheet, own) => {
              // 🚪 계산대·등록은 대시보드 틀이 아니라 전용 길로(`tool-pages.ts` `OWN_PATH` — 마이와 같은 판정).
              if (own === 'scan') { setTool(null); void goFull(STORE_SCAN_PATH); return }
              if (own === 'voucherNew') { setTool('voucherNew'); return }
              if (inSheet) { setPage({ path, title: label }); setPageFrom('tools'); setTool('page'); return }
              setTool(null); void goFull(path)
            }}
          />
        )}
        {tool === 'voucherNew' && (
          /* 등록 완료 화면의 '내 이용권 보기' 가 부른다 — 대시보드 대신 같은 이용권 목록을 시트로. */
          <VoucherNewSheet onClose={() => setTool('tools')} onCreated={() => { setPage({ path: '/seller/group-buy', title: '이용권' }); setPageFrom(null); setTool('page') }} />
        )}
        {tool === 'page' && page && (
          <ToolPageSheet
            path={page.path}
            title={page.title}
            onClose={() => { const back = pageFrom; setPage(null); setPageFrom(null); setTool(back) }}
            /* 🚪 안쪽이 셀러 밖을 가리켰다 — 메모리 라우터엔 그 주소가 없어 빈 화면이 된다. 닫고 진짜로 보낸다. */
            onLeave={(to) => { setPage(null); setPageFrom(null); setTool(null); window.location.assign(to) }}
          />
        )}
      </Suspense>
    </>
  )
}
