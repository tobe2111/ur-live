/**
 * 🛡️ 2026-05-25 (migration 0278): 소개 수익 대시보드 (/u/me/earnings).
 *
 * Phase 1-C 핵심 UX — 수익 가시화.
 * 30일 적립 / 클릭 / 구매 / 인기 핀 top 3 / 일별 차트.
 * 출금은 기존 user_withdrawals 시스템 재활용 (Phase 4 에서 본격 통합).
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HOSTING_HIDDEN } from '@/shared/feature-flags'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { curatorApi, type DashboardStats } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon, formatNumber, safeNum } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SellOwnProductsCTA from './curator-page/SellOwnProductsCTA'
import { parseUTCDate } from '@/utils/date'
import { Store, ShoppingBag, Sparkles } from 'lucide-react'
import { GroupLabel, ListPlate, ListRow } from './user-profile/list-grammar'
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
  const [handle, setHandle] = useState<string | null>(() => {
    const fromUser = (user as any)?.handle
    if (fromUser) return fromUser
    try { return localStorage.getItem('user_handle') || null } catch { return null }
  })
  const [wdInfo, setWdInfo] = useState<WithdrawalInfo | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)

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

  // best-effort: handle 가져오기
  useEffect(() => {
    if (handle || !user) return
    // user store 에 handle 없을 수 있음. /api/curator/me/dashboard 응답에는 없으나 user store sync 가
    // 미반영일 수 있어 굳이 안 받아옴. 핀 추가하면 자동 동기.
  }, [handle, user])

  return (
    <>
      <SEO title={t('curator.console.title', { defaultValue: '소개 콘솔' })} noindex />
      <div className="min-h-screen bg-white dark:bg-[#11141C] text-gray-900 dark:text-white pb-24">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">{t('curator.console.title', { defaultValue: '소개 콘솔' })}</h1>
            {handle && (
              <Link to={`/u/${handle}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                @{handle}
              </Link>
            )}
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* 🏁 2026-06-15 (옵션 1 콘솔): 크리에이터 핵심 동선 빠른 진입 — 유어샵. 🏁 2026-06-17: 공구 호스팅 숨김(HOSTING_HIDDEN)
              🎫 2026-09-29 — 회색 타일 → 마이와 같은 **목록 문법**(GroupLabel + ListPlate + ListRow).
                 같은 뜻의 줄을 화면마다 다르게 그리면 반드시 갈린다. */}
          <GroupLabel>내 가게</GroupLabel>
          <ListPlate className="mb-1">
            <ListRow
              icon={<ShoppingBag className="w-5 h-5" aria-hidden="true" />}
              label="내 유어샵"
              hint="담은 상품과 순서 관리"
              to={handle ? `/u/${handle}` : '/u/me'}
            />
            {!HOSTING_HIDDEN && (
              <ListRow
                icon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
                label="공구 호스팅"
                hint="동네 공구 직접 제안"
                to="/host"
              />
            )}
          </ListPlate>
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">{error}</p>
          ) : !stats ? null : (
            <>
              <SummaryCards stats={stats} />
              {wdInfo && (
                <WithdrawalCard
                  info={wdInfo}
                  onWithdraw={() => setShowWithdraw(true)}
                  onAckUpgrade={async () => {
                    await curatorApi.acknowledgeUpgradeOffer()
                    setWdInfo({ ...wdInfo, seller_upgrade: { ...wdInfo.seller_upgrade, offered: true } })
                  }}
                />
              )}
              <IntroducedStoresSection />
              <SellOwnProductsCTA />
              <TopPinsSection stats={stats} />
              <RecentEarningsSection stats={stats} />
              <DailyChart stats={stats} />
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
      </div>
    </>
  )
}

/**
 * 🏪 내가 영입한 매장 — **목록 문법**(2026-09-29 대표 시안).
 *
 * 종전엔 한 행에 [매장명 · 실적 · 초록 알약 · 파란 버튼] 넷이 들어가 폰에서 되감겼고,
 * 초록(emerald) 알약은 표면 규칙 ⑥(색깔 정보상자 0)·②(강조색 하나) 위반이었다.
 * ⇒ 마이에서 쓰는 `GroupLabel` + `ListPlate` + `ListRow` 한 벌로 통일한다 — 같은 문법을
 *   두 벌 그리면 반드시 갈린다(2026-09-28 마이 목록이 셋으로 갈렸던 그 사고).
 *
 * 🔴 **`공구 대행 등록` 버튼은 목록에 두지 않는다**(2026-09-29 대표 확정 — 물었더니 "아니").
 *    행 전체가 그 동작이다. 커미션 기간은 알약이 아니라 `hint` 줄의 한 조각으로 내려간다 —
 *    만료 여부는 색이 아니라 **글자**로 말한다(색만으로 말하면 색맹·흑백에서 사라진다).
 *    주문 건수는 목록 문법의 **값 자리**(오른쪽)로 보낸다 — 그 자리가 숫자용이고, 0 은 스스로
 *    회색이 된다(`ListRow` 규칙: "아직 모르는 것을 0 이라고 말하지 않는다").
 */
function IntroducedStoresSection() {
  const [data, setData] = useState<{ total_commission: number; stores: Array<{ id: number; business_name: string | null; status: string | null; referral_bonus_until: string | null; total_orders: number; total_sales: number }> } | null>(null)
  const [proxyFor, setProxyFor] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    curatorApi.getIntroducedStores().then((r) => { if (r.success) setData(r) }).catch(() => {})
  }, [])

  if (!data || data.stores.length === 0) return null

  return (
    <section className="mb-2">
      <GroupLabel>영입한 매장 · 누적 {formatWon(data.total_commission)}</GroupLabel>
      <ListPlate>
        {data.stores.map((s) => {
          const name = s.business_name || `매장 #${s.id}`
          const expired = !!(s.referral_bonus_until && parseUTCDate(s.referral_bonus_until) < new Date())
          const term = expired ? '커미션 만료' : (s.referral_bonus_until ? `~${s.referral_bonus_until.slice(0, 10)}` : '무기한')
          return (
            <ListRow
              key={s.id}
              icon={<Store className="w-5 h-5" aria-hidden="true" />}
              label={name}
              count={s.total_orders}
              hint={`${formatWon(s.total_sales)} · ${term}`}
              onClick={() => setProxyFor({ id: s.id, name })}
            />
          )
        })}
      </ListPlate>
      {proxyFor && <ProxyProductModal merchant={proxyFor} onClose={() => setProxyFor(null)} />}
    </section>
  )
}

function WithdrawalCard({ info, onWithdraw, onAckUpgrade }: { info: WithdrawalInfo; onWithdraw: () => void; onAckUpgrade: () => Promise<void> }) {
  // 🛡️ 2026-05-25 신모델: 사업자 셀러는 실제 돈 출금, 일반 user 는 딜 잔액 표시.
  const isCash = info.payout_mode === 'cash'
  return (
    <section className="mb-6">
      {isCash ? (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 text-white">
          <p className="text-xs opacity-80 mb-1">출금 가능 잔액 (현금)</p>
          <p className="text-3xl font-bold mb-3">{formatWon(info.available)}</p>
          <div className="flex justify-between text-xs opacity-90 mb-4">
            <span>누적 적립 {formatWon(info.lifetime_earnings)}</span>
            <span>출금 {formatWon(info.total_withdrawn)}</span>
          </div>
          <button
            onClick={onWithdraw}
            disabled={info.available < info.min_withdrawal}
            className="w-full py-2.5 bg-surface text-brand-text font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {info.available < info.min_withdrawal
              ? `최소 ${formatWon(info.min_withdrawal)} 부터 출금 가능`
              : '출금 신청'}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-5 text-white">
          <p className="text-xs opacity-80 mb-1">내 딜 잔액</p>
          <p className="text-3xl font-bold mb-3">{formatNumber(info.deal_balance)}딜</p>
          <p className="text-xs opacity-90 mb-3">
            누적 적립 {formatNumber(info.lifetime_earnings)}딜 — 1딜 = 1원으로 쇼핑/공구에 사용
          </p>
          <Link
            to="/browse"
            className="block w-full py-2.5 bg-surface text-orange-600 font-bold rounded-lg text-center"
          >
            쇼핑 둘러보기
          </Link>
        </div>
      )}

      {/* 셀러 승급 안내 */}
      {info.seller_upgrade.eligible && !info.seller_upgrade.offered && (
        <div className="mt-3 bg-surface shadow-lift rounded-2xl p-4">
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">셀러 승급 안내</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            누적 적립이 {formatWon(info.seller_upgrade.threshold)} 를 넘었어요! 셀러로 승급하시면 직접 상품 판매·라이브 송출이 가능해져요.
          </p>
          <div className="flex gap-2">
            <Link to="/store/new" className="flex-1 py-2 bg-brand text-white text-xs font-bold rounded-lg text-center active:opacity-70">
              셀러 가입하기
            </Link>
            <button onClick={onAckUpgrade} className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs font-bold active:opacity-70">
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 출금 이력 */}
      {info.history.length > 0 && (
        <div className="mt-3 bg-gray-50 dark:bg-[#1D1F29] rounded-xl p-4">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">최근 출금 이력</p>
          <div className="space-y-2">
            {info.history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-700 dark:text-gray-300">{formatWon(h.amount)}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-2">({h.bank_name})</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  h.status === 'paid' ? 'bg-wash text-gray-700 dark:text-gray-200' :
                  h.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300'
                }`}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * 📊 30일 요약 — **한 판, 강조색 하나**(2026-09-29 대표 시안).
 *
 * 종전엔 같은 크기 카드 셋이 나란히 있고 색이 **셋 다 달랐다**(브랜드 파랑 · blue-500 · emerald-500).
 * 셋이 같은 무게라 무엇이 중요한지 화면이 말해 주지 않았고, 강조색 셋은 표면 규칙 ②
 * (*강조색 하나, 자리 셋*) 위반이다. ⇒ 주인공(적립액)을 **34px 로 키워** 판 위에 올리고,
 * 순클릭·전환율은 그 아래 **회색 보조 줄**로 내렸다. 규칙 ③ "숫자가 주인공" 의 형태다.
 */
function SummaryCards({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const pending = safeNum(stats.pending_earnings)
  // 순클릭(ip+ua+일자 dedup) — raw 클릭은 새로고침/봇 부풀림을 포함한다.
  const uniqueClicks = stats.unique_clicks_30d != null ? safeNum(stats.unique_clicks_30d) : safeNum(stats.clicks_30d)
  const showRaw = stats.unique_clicks_30d != null && stats.clicks_30d > uniqueClicks
  return (
    <div className="bg-surface shadow-lift rounded-2xl p-4 mb-5">
      <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-1.5">
        {t('curator.earnings.monthEarning', { defaultValue: '30일 적립 (확정)' })}
      </p>
      <p className="text-[34px] leading-none font-black tracking-[-0.04em] text-brand-text tabular-nums">
        {formatWon(stats.month_earnings)}
      </p>
      {pending > 0 && (
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1.5">+ {formatNumber(pending)}딜 적립예정</p>
      )}
      <div className="flex gap-7 mt-4 pt-3.5 border-t border-rule">
        <span>
          <span className="block text-[11.5px] text-gray-400 dark:text-gray-500 mb-0.5">
            {t('curator.earnings.uniqueClicks30d', { defaultValue: '30일 순클릭' })}
          </span>
          <b className="text-[17px] font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(uniqueClicks)}</b>
          {showRaw && <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-1.5">전체 {formatNumber(stats.clicks_30d)}</span>}
        </span>
        <span>
          <span className="block text-[11.5px] text-gray-400 dark:text-gray-500 mb-0.5">
            {t('curator.earnings.conversion30d', { defaultValue: '30일 전환율' })}
          </span>
          <b className="text-[17px] font-bold tabular-nums text-gray-900 dark:text-white">{safeNum(stats.conversion_rate_30d)}%</b>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-1.5">구매 {formatNumber(stats.purchases_30d)}</span>
        </span>
      </div>
    </div>
  )
}

function TopPinsSection({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  if (!stats.top_pins?.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold mb-3">{t('curator.earnings.topPins', { defaultValue: '인기 핀 TOP 3' })}</h2>
      <div className="space-y-2">
        {stats.top_pins.map((pin, idx) => (
          <Link
            key={pin.id}
            to={`/products/${pin.product_id}`}
            className="flex items-center gap-3 bg-surface shadow-lift rounded-xl p-3 active:opacity-70 transition-opacity"
          >
            <div className="text-lg font-bold text-gray-400 dark:text-gray-500 w-6">{idx + 1}</div>
            {(pin.thumbnail || pin.image_url) && (
              <img
                src={cfImage(pin.thumbnail || pin.image_url || '', { width: 96, format: 'auto' }) || (pin.thumbnail || pin.image_url || '')}
                alt={pin.product_name}
                className="w-12 h-12 rounded object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => cfImageOnError(e.currentTarget, pin.thumbnail || pin.image_url || '')}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pin.product_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(pin.click_count)} 클릭</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function RecentEarningsSection({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const items = stats.recent_earnings || []
  if (!items.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold mb-3">{t('curator.earnings.recent', { defaultValue: '수익 내역 (원천별)' })}</h2>
      <div className="space-y-2">
        {items.map((e) => (
          <Link
            key={e.id}
            to={`/products/${e.product_id}`}
            className="flex items-center justify-between gap-3 bg-surface shadow-lift rounded-xl p-3 active:opacity-70 transition-opacity"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {e.product_name || t('curator.earnings.unknownProduct', { defaultValue: '상품' })}
                {e.status === 'holding' && (
                  <span className="ml-1.5 align-middle inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-wash text-gray-500 dark:text-gray-400">
                    적립예정
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {parseUTCDate(e.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })}
                {e.order_amount ? ` · 주문 ${formatWon(e.order_amount)}` : ''}
              </p>
            </div>
            <span className={`text-sm font-bold shrink-0 ${e.status === 'holding' ? 'text-gray-400 dark:text-gray-500' : 'text-brand-text'}`}>+{formatWon(e.commission)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function DailyChart({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const daily = stats.earnings_daily_30d || []
  if (!daily.length) return (
    <section className="bg-gray-50 dark:bg-[#1D1F29] rounded-xl p-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {t('curator.earnings.noData', { defaultValue: '아직 데이터가 없어요. 친구에게 핀을 공유해보세요!' })}
    </section>
  )

  const max = Math.max(...daily.map((d) => safeNum(d.amount)), 1)
  return (
    <section>
      <h2 className="text-sm font-bold mb-3">{t('curator.earnings.dailyChart', { defaultValue: '일별 적립 (30일)' })}</h2>
      <div className="bg-surface shadow-lift rounded-2xl p-4">
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => {
            const pct = (safeNum(d.amount) / max) * 100
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${formatWon(d.amount)}`}>
                <div className="w-full bg-brand/30 rounded-t group-hover:bg-brand" style={{ height: `${pct}%` }} />
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">{daily[0]?.date} → {daily[daily.length - 1]?.date}</p>
      </div>
    </section>
  )
}
