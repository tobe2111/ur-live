import { useEffect } from 'react'
import { AlertIcon } from '@/components/icons/urdeal-icons'
import Udal from '@/components/mascot/Udal'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'
import { parseUTCDate } from '@/utils/date'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import BrandLoader from '@/components/brand/BrandLoader'
import SEO from '@/components/SEO'
import { requireLogin, isLoggedInSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'
import { useMyCoupons, type Coupon } from '@/hooks/queries/useMyCoupons'

export default function MyCouponsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query (목록 캐싱).
  const { data: coupons = [], isLoading: loading, isError, refetch } = useMyCoupons()
  const error = isError ? t('myCoupons.loadFailed') : null

  useEffect(() => {
    if (!isLoggedInSync()) {
      requireLogin(navigate, t('myCoupons.loginRequired'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function formatDiscount(c: Coupon) {
    if (c.type === 'percent') {
      return `${c.value}%`
    }
    return `${formatNumber(c.value)}원`
  }

  function formatExpiry(expires_at: string | null) {
    if (!expires_at) return t('myCoupons.always')
    const d = parseUTCDate(expires_at)
    const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const dateStr = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    if (diffDays <= 0) return t('myCoupons.expired')
    if (diffDays <= 7) return t('myCoupons.expiresAtDays', { date: dateStr, days: diffDays })
    return t('myCoupons.expiresAt', { date: dateStr })
  }

  return (
    <div className={SUB_PAGE_CLS}>
      <SEO title={t('myCoupons.seoTitle')} description={t('myCoupons.seoDesc')} url="/my-coupons" noindex />
      <SubPageHeader title={t('myCoupons.title')} backLabel={t('myCoupons.back')} />

      <main className="ur-content-narrow px-4 py-4 pb-20">
        {loading ? (
          <BrandLoader />  /* 🎯 2026-07-18 로딩 단일화 (헤더 유지 → 인라인) */
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertIcon className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-[15px] text-gray-900 dark:text-white mb-4">{error}</p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2 bg-brand text-white text-[13px] font-medium rounded-full"
            >
              {t('myCoupons.retry')}
            </button>
          </div>
        ) : coupons.length === 0 ? (
          /* 🧹 2026-10-19: 빈 화면이 같은 말을 두 번 했다(제목 "사용 가능한 쿠폰이 없습니다" + 설명 "받은 쿠폰이 없어요").
             설명은 **다음에 할 일**만 말한다 — 다른 빈 화면들과 같이 유달이 + 들림 카드. */
          <div className="bg-surface rounded-2xl shadow-lift dark:shadow-none px-6 py-10 text-center">
            <Udal mood="empty" size={96} className="block mx-auto mb-4" />
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">{t('myCoupons.empty')}</h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{t('myCoupons.emptySub')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-2">{t('myCoupons.available', { count: coupons.length })}</p>
            {coupons.map(c => {
              const expiry = formatExpiry(c.expires_at)
              const isUrgent = !!c.expires_at && (() => {
                const d = parseUTCDate(c.expires_at!)
                const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return diffDays > 0 && diffDays <= 7
              })()
              return (
                <article
                  key={c.id}
                  className="relative bg-surface rounded-2xl shadow-lift dark:shadow-none overflow-hidden"
                >
                  <div className="flex">
                    {/* 할인 금액 */}
                    <div className="flex flex-col items-center justify-center px-5 py-4 bg-brand text-white min-w-[100px]">
                      <p className="text-[12px] font-medium tracking-wide opacity-90">
                        {c.type === 'percent' ? t('myCoupons.labelDiscountRate') : t('myCoupons.labelDiscount')}
                      </p>
                      <p className="text-[24px] font-bold leading-tight mt-1">
                        {formatDiscount(c)}
                      </p>
                      {c.type === 'percent' && c.max_discount && (
                        <p className="text-[12px] opacity-80 mt-1">{t('myCoupons.labelMaxDiscount', { amount: formatNumber(c.max_discount) })}</p>
                      )}
                    </div>
                    {/* Notched divider */}
                    {/* 티켓 홈 — 페이지 바탕색으로 뚫는다(테두리를 그리면 카드 테두리 0 규칙이 깨진다). */}
                    <div className="relative w-px border-l border-dashed border-rule-strong">
                      <span className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-warm" aria-hidden="true" />
                      <span className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-warm" aria-hidden="true" />
                    </div>
                    {/* 내용 */}
                    <div className="flex-1 px-4 py-4 min-w-0">
                      <p className="text-[15px] font-bold text-gray-900 dark:text-white line-clamp-2">
                        {c.name}
                      </p>
                      <div className="mt-2 space-y-1">
                        {c.min_order_amount > 0 && (
                          <p className="text-[12px] text-gray-500 dark:text-gray-400">
                            {t('myCoupons.minOrder', { amount: formatNumber(c.min_order_amount) })}
                          </p>
                        )}
                        <p className={`text-[12px] font-medium ${isUrgent ? 'text-tone-bad' : 'text-gray-500 dark:text-gray-400'}`}>
                          {expiry}
                        </p>
                      </div>
                      <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full bg-wash">
                        <span className="text-[12px] tabular-nums font-medium text-gray-700 dark:text-gray-200">{c.code}</span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}

            <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center pt-2">
              {t('myCoupons.footerNote')}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
