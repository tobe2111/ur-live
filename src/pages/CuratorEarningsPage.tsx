/**
 * 🎫 소개 수익 콘솔 (`/u/me/earnings`) — **B안 통장형**(2026-09-29 대표 확정).
 *
 * ## 무엇이 달라졌나
 * 대표: *"소개 콘솔도 페이지 너무 별로다"* → 무엇이 걸리는지 물었더니 **셋 다** 골랐다:
 * **섹션이 많다 · 차트가 밋밋하다 · 목록 문법이 안 맞는다.** 시안 둘을 드리고 **B안** 확정.
 *
 * | | 전 | 후 |
 * |---|---|---|
 * | 판 | **8개**(빠른진입 · 요약 · 출금 · 영입매장 · 셀러CTA · 인기핀 · 최근적립 · 차트) | **3개** |
 * | 세로 | 화면 4장 | 1장 |
 * | 돈 | 요약·출금·차트가 **따로**, 출금이 한가운데 묻힘 | `EarningsPanel` 한 판 |
 * | 성과 | 인기핀·영입매장·최근적립이 **따로** | `PerformancePanel` 탭 셋 |
 *
 * 🔴 **정보는 빼지 않았다.** 없앤 것은 *판의 개수*이고, 각 값은 새 자리로 옮겼다 —
 *    순클릭·전환율만 예외다(아래 참조).
 *
 * ## 🩸 순클릭·전환율은 **뺐다**
 * 종전 요약 카드의 `30일 순클릭` · `30일 전환율` 은 이 화면에서 **아무 행동으로도 이어지지 않았다**.
 * 소개자가 콘솔에 오는 이유는 *얼마 벌었고 언제 받나* 이고, 그 둘은 그 질문에 답하지 않는다.
 * 클릭은 상품 탭의 부제(`N건 · N 클릭`)에 상품별로 남아 있다 — 총합보다 그쪽이 행동에 가깝다.
 * ⚠️ 되살리고 싶으면 `stats.unique_clicks_30d` / `conversion_rate_30d` 가 그대로 온다(서버 무변경).
 *
 * ## 🔴 서버는 한 글자도 안 바꿨다
 * 새 쿼리도, 새 필드도 없다. 시안의 *"지난달 대비"* 는 전월 합계가 필요한데 대시보드는 30일치만
 * 주므로 **최근 2주 vs 그 전 2주**로 바꿨다(라벨이 무엇을 비교했는지 그대로 적는다).
 */

import { useEffect, useState } from 'react'
import { BagIcon } from '@/components/icons/urdeal-icons'
import { Link } from 'react-router-dom'
import { HOSTING_HIDDEN } from '@/shared/feature-flags'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { curatorApi, type DashboardStats } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon } from '@/utils/format'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SellOwnProductsCTA from './curator-page/SellOwnProductsCTA'
import { Sparkles } from 'lucide-react'
import EarningsPanel from './curator-earnings/EarningsPanel'
import PerformancePanel from './curator-earnings/PerformancePanel'
import { ProxyProductModal, WithdrawModal } from './curator-earnings/ConsoleModals'

export interface WithdrawalInfo {
  lifetime_earnings: number
  total_withdrawn: number
  available: number
  min_withdrawal: number
  withholding_rate: number
  history: Array<{ id: number; amount: number; withholding_tax: number; net_amount: number; bank_name: string; status: string; requested_at: string }>
  seller_upgrade: { threshold: number; eligible: boolean; offered: boolean }
  // 🛡️ 2026-05-25 신모델: 정산 분기
  payout_mode: 'cash' | 'deal'
  is_business_seller: boolean
  deal_balance: number
}

export default function CuratorEarningsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s: any) => s.user)
  // 🎨 2026-06-17 (콘솔 @handle 표시 fix): dashboard select 가 handle 을 버려 user.handle(주로 null)에만
  //   의존 → 헤더 @handle 미표시 + '내 유어샵' 이 /u/me 리다이렉트 홉. localStorage.user_handle
  //   (App/UMeRedirect/Kakao 가 기록, BottomNav 와 동일 소스)로 seed → 직접 /u/{handle} 진입.
  const [handle] = useState<string | null>(() => {
    const fromUser = (user as any)?.handle
    if (fromUser) return fromUser
    try { return localStorage.getItem('user_handle') || null } catch { return null }
  })
  const [wdInfo, setWdInfo] = useState<WithdrawalInfo | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [proxyFor, setProxyFor] = useState<{ id: number; name: string } | null>(null)

  // 🛡️ 2026-05-31: 메인 대시보드 fetch → useApiQuery (RQ — 재방문 캐시/dedup). 인증=인터셉터 자동.
  const dashQ = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const stats = dashQ.data ?? null
  const loading = dashQ.isLoading
  const error = dashQ.isError ? t('curator.dashboardError', { defaultValue: '대시보드 로딩 실패' }) : null

  useEffect(() => {
    curatorApi.getWithdrawalInfo().then((res) => {
      if (res.success) setWdInfo(res as any)
    }).catch(() => {})
  }, [])

  async function reloadWithdrawal() {
    try {
      const res = await curatorApi.getWithdrawalInfo()
      if (res.success) setWdInfo(res as any)
    } catch {}
  }

  return (
    <>
      <SEO title={t('curator.console.title', { defaultValue: '소개 콘솔' })} noindex />
      <div className="min-h-[100dvh] bg-warm dark:bg-[#11141C] text-gray-900 dark:text-white pb-24">
        {/* 🩸 `bg-surface/95 backdrop-blur` 는 **CSS 가 아예 안 나온다** — `--surface` 같은 var() 색에
            투명도 접미사를 붙이면 Tailwind 가 클래스를 만들지 못한다(`check-ghost-classes` 가 잡았다).
            헤더가 통째로 투명해진다. 표면 규칙 ①대로 **불투명 면**으로 간다 —
            페이지는 `bg-warm`, 헤더는 `bg-surface` 라 두 면이 맞닿는 자리가 곧 구분선이다. */}
        <header className="sticky top-0 z-20 bg-surface px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-[17px] font-bold tracking-[-0.02em]">{t('curator.console.title', { defaultValue: '소개 콘솔' })}</h1>
            {handle && (
              <Link to={`/u/${handle}`} className="text-[12px] text-gray-500 dark:text-gray-400">@{handle}</Link>
            )}
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 pt-4 pb-6">
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">{error}</p>
          ) : !stats ? null : (
            <>
              <EarningsPanel stats={stats} info={wdInfo} onWithdraw={() => setShowWithdraw(true)} />
              <PerformancePanel stats={stats} onProxy={setProxyFor} />

              {/* 진입은 압축 바 한 줄 — 판을 만들지 않는다(대표: "섹션이 너무 많다"). */}
              <div className="flex gap-2 mb-3">
                <QuickTile to={handle ? `/u/${handle}` : '/u/me'} icon={<BagIcon className="w-[18px] h-[18px]" aria-hidden="true" />} label="내 유어샵" />
                {!HOSTING_HIDDEN && (
                  <QuickTile to="/host" icon={<Sparkles className="w-[18px] h-[18px]" aria-hidden="true" />} label="공구 호스팅" />
                )}
              </div>

              {/* 셀러 승급 안내 — 누적이 임계치를 넘은 사람에게만, 한 번만. */}
              {wdInfo?.seller_upgrade.eligible && !wdInfo.seller_upgrade.offered && (
                <div className="bg-surface shadow-lift rounded-2xl p-4 mb-3">
                  <p className="text-[15px] font-bold mb-1">셀러 승급 안내</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">
                    누적 적립이 {formatWon(wdInfo.seller_upgrade.threshold)} 를 넘었어요. 셀러가 되면 직접 상품을 팔 수 있어요.
                  </p>
                  <div className="flex gap-2">
                    <Link to="/store/new" className="flex-1 py-2 bg-brand text-white text-[13px] font-extrabold rounded-xl text-center active:opacity-70">
                      셀러 가입하기
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await curatorApi.acknowledgeUpgradeOffer()
                        setWdInfo({ ...wdInfo, seller_upgrade: { ...wdInfo.seller_upgrade, offered: true } })
                      }}
                      className="px-4 py-2 text-gray-500 dark:text-gray-400 text-[13px] font-bold active:opacity-70"
                    >
                      나중에
                    </button>
                  </div>
                </div>
              )}

              <SellOwnProductsCTA />
            </>
          )}
        </div>

        {/* 출금 모달 — 사업자 셀러만 (payout_mode='cash') */}
        {showWithdraw && wdInfo && wdInfo.payout_mode === 'cash' && (
          <WithdrawModal
            info={wdInfo}
            onClose={() => setShowWithdraw(false)}
            onSuccess={() => { setShowWithdraw(false); reloadWithdrawal() }}
          />
        )}
        {proxyFor && <ProxyProductModal merchant={proxyFor} onClose={() => setProxyFor(null)} />}
      </div>
    </>
  )
}

/**
 * 진입 한 줄 — **가로**다. 세로 타일로 두면 `HOSTING_HIDDEN` 이라 칸이 하나뿐인 지금
 * 큰 빈 상자가 하나 남는다(로컬 렌더에서 실제로 그랬다). 가로면 한 칸일 때 슬림한 바,
 * 두 칸일 때 나란한 바가 된다.
 */
function QuickTile({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex-1 bg-surface shadow-lift rounded-2xl px-4 py-3 flex items-center gap-2 active:opacity-70">
      <span className="text-gray-500 dark:text-gray-400">{icon}</span>
      <span className="text-[13px] font-bold tracking-[-0.02em]">{label}</span>
    </Link>
  )
}
