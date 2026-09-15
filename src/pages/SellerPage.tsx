/**
 * 🏠 **셀러 홈 = M2** (2026-09-14 대표 승인 — 모바일 우선 재설계 "좋네. 지금 형태 좋다" → "그대로 모두 진행").
 *   시안·근거: `docs/design/seller-dashboard-mobile-first-2026-09.md`.
 *
 * ## 무엇이 바뀌었나
 *   종전엔 블록 **14개**가 세로 한 줄로 쌓여 있었다(매장 → 타일5 → 트리오3 → 숫자4 → 영입자 → 공구현황 → 인사이트 →
 *   KPI → 차트 → 인기상품 → 할일 → 신규스텝 → 공개페이지 → 문의). 신규 셀러는 그 대부분을 0 이나 빈 채로 봤다.
 *   대표: *"그냥 다 때려박은 느낌이잖아 · 카드·섹션 자체가 마음에 들지 않아 · 이용권 등록·관리·매출이 가장 중요"*.
 *
 *   이제 홈은 **한 화면**에 넷이다(스크롤해야 보이는 것은 홈에 두지 않는다):
 *     ① 오늘 티켓(매출·주문·처리 대기 / PC +정산 가능) ② 지금 처리할 일 ③ 내 이용권(끝에 ＋등록) ④ 이번 주
 *   PC(lg+)는 같은 넷을 2열로: 좌 ①③④ · 우 sticky ②+내 매장(P-홈).
 *   지운 블록의 데이터는 사라진 게 아니라 **각자의 탭**으로 갔다 — 성과는 정산 › 매출 분석, 매장은 더보기 › 매장.
 *
 * ## 지키는 것
 *   - 🚪 2026-08-24 대표: "첫 단계는 매장 등록 — 무조건 선행." 등록 매장이 0 이면 STEP 1 티켓 하나만 남고 나머지는 잠긴다
 *     (`storeGated === true` — 느슨한 truthy 게이트는 로딩/실패 중 정상 셀러를 잠근다, fail-open).
 *   - 🔔 새 주문 알림(10초 폴링 + 사운드)은 그대로 — `useNewOrderAlert`.
 *   - ☎️ 운영자 문의(`SellerSupportContact`)는 게이트 밖 — 매장 등록 전에도 열려 있어야 한다.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import SellerLayout from '@/components/SellerLayout'
import SellerSupportContact from '@/components/seller/SellerSupportContact'
import MyStoresPanel from './seller-page/MyStoresPanel'
import TodayTicket from './seller-page/TodayTicket'
import TodoRows from './seller-page/TodoRows'
import MyVouchersRail from './seller-page/MyVouchersRail'
import WeekSummary from './seller-page/WeekSummary'
import { useSellerHome } from './seller-page/useSellerHome'
import { useNewOrderAlert } from './seller-page/useNewOrderAlert'

export default function SellerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isPc = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (!isSellerAuthenticated()) redirectToLogin(navigate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const home = useSellerHome()
  useNewOrderAlert(home.orders)

  // 🚪 매장 게이트 — MyStoresPanel 이 서버 판정(store_ready + 매장 목록)으로 알려 준다. null(판정 중)엔 잠그지 않는다.
  const [storeGated, setStoreGated] = useState<boolean | null>(null)
  const onGateChange = useCallback((g: boolean | null) => setStoreGated(g), [])

  const storeName = localStorage.getItem('seller_name') || t('seller.home.myStore', { defaultValue: '내 매장' })

  // 폰에서는 매장 패널이 게이트 판정·STEP 1 티켓만 맡는다(시안엔 매장 블록이 없다). PC 는 우측 열에 카드로.

  return (
    <SellerLayout title={t('seller.dashboard')} pendingOrders={home.pendingOrders}>
      <div className="mx-auto min-w-0 max-w-5xl space-y-5">
        {/* ⚠️ 매장 패널은 **한 자리에만** 둔다(게이트 여부로 부모를 바꾸면 안 된다). 부모가 바뀌면 React 가 패널을
            다시 마운트하고, 새 인스턴스가 '판정 중(null)'을 보고해 게이트가 풀렸다 잠겼다를 반복한다 — 첫 렌더 실측에서
            STEP 1 티켓이 아예 안 보이던 원인. 그래서 격자는 늘 그대로 두고 **열 안의 내용만** 게이트로 바꾼다. */}
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {/* min-w-0: 가로 스크롤 레일(내 이용권)이 그리드 칸을 콘텐츠 폭으로 넓혀 화면 밖으로 밀던 것 차단(폰 실측). */}
          <div className="min-w-0 space-y-5">
            {storeGated === true ? (
              <p className="py-6 text-center text-[12px] text-gray-400 lg:py-10">
                <Lock className="mr-1 inline-block h-3.5 w-3.5 align-[-2px] text-gray-400" aria-hidden="true" />
                {t('seller.stores.lockedNote', { defaultValue: '매장 등록을 마치면 이용권 등록 · 주문 · 정산 · 소개 협업이 열려요' })}
              </p>
            ) : (
              <>
                <TodayTicket
                  loading={home.loading}
                  storeName={storeName}
                  todayRevenue={home.todayRevenue}
                  todayOrders={home.todayOrders}
                  pendingOrders={home.pendingOrders}
                  withdrawable={home.withdrawable}
                  summary={home.storesSummary}
                />
                {/* 📱 폰: 할 일은 티켓 바로 아래(M2). PC: 우측 열로 간다(P-홈). 같은 부품 하나를 자리만 바꿔 그린다. */}
                {!isPc && <TodoRows pendingOrders={home.pendingOrders} withdrawable={home.withdrawable} hasVouchers={home.vouchers.length > 0} />}
                <MyVouchersRail vouchers={home.vouchers} loaded={home.vouchersLoaded} />
                <WeekSummary revenue={home.weekRevenue} orders={home.weekOrders} delta={home.weekDelta} week7={home.week7} hasDaily={home.hasDaily} />
              </>
            )}
          </div>
          {/* 게이트 중엔 폰에서 STEP 1 티켓이 잠금 안내보다 위로 온다(order-first). */}
          <div className={`min-w-0 space-y-5 lg:sticky lg:top-0 ${storeGated === true ? 'order-first lg:order-none' : ''}`}>
            {isPc && storeGated !== true && <TodoRows pendingOrders={home.pendingOrders} withdrawable={home.withdrawable} hasVouchers={home.vouchers.length > 0} />}
            <MyStoresPanel onGateChange={onGateChange} gateOnly={!isPc} />
          </div>
        </div>

        {/* ☎️ 2026-08-01 O9 — 운영자 문의 경로. 미설정이면 자기가 안 그린다. 게이트 밖. */}
        <SellerSupportContact />
      </div>
    </SellerLayout>
  )
}
