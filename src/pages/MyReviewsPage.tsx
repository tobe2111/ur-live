/**
 * 내 리뷰 — 쓸 수 있는 리뷰 + 내가 쓴 리뷰.
 *
 * 🩸 2026-10-19 (대표 *"모두 다 가장 이상적으로 개선해줘"*): 이 화면이 **서버의 리뷰 자격과 다른 목록**을 보여 줬다.
 *   - 목록: 배송 완료된 **쇼핑 주문** — 그런데 쇼핑 탭은 숨겨져 있고(`SHOPPING_TAB_HIDDEN`), 서버가 매장 이용권에
 *     리뷰를 허락하는 조건은 **이용권을 매장에서 쓴 것**이다(`checkReviewEligibility` → `vouchers.status='used'`).
 *     그래서 이용권을 써 본 사람에게 이 화면은 늘 "작성 가능한 리뷰가 없습니다" 였다.
 *   - 버튼: `/products/:id#review` — 그 앵커는 **어느 화면에도 없다.** 이용권 리뷰는 이용권 상세의
 *     `#gb-sec-reviews` 에 있다(누르면 상세 맨 위가 열리고 끝).
 *   - 제목: 마이의 줄 이름은 "내 리뷰" 인데 들어오면 "리뷰 작성". 내가 쓴 리뷰는 볼 곳이 없었다.
 *   ⇒ 목록을 **서버와 같은 기준**(쓴 매장 이용권, 아직 리뷰 안 쓴 상품)으로 만들고, 버튼은 상세의 리뷰 구역으로,
 *     내가 쓴 리뷰(`GET /api/reviews/my`)를 아래에 함께 둔다. 보상 금액은 서버 설정(`/reward-config`)에서 읽는다 —
 *     손으로 적은 금액은 2026-06-12 에 이미 한 번 실지급과 갈렸다.
 */
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StarIcon, AlertIcon } from '@/components/icons/urdeal-icons'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import Udal from '@/components/mascot/Udal'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { requireLogin, isLoggedInSync } from '@/utils/auth'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { isStoreVoucher } from '@/shared/voucher-wallet'
import { FLOW_CONFIG, detailHref } from '@/shared/product-flow'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import BrandLoader from '@/components/brand/BrandLoader'
import { formatKSTDate } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'

/** 이용권 상세의 리뷰 구역 — `GroupBuyDetailPage` 의 `id="gb-sec-reviews"` 와 같아야 한다(가드가 대조). */
export const PASS_REVIEW_ANCHOR = 'gb-sec-reviews'

type VoucherRow = {
  id: number
  product_id?: number
  status?: string
  deal_only?: number | null
  product_name?: string
  product_image?: string | null
  restaurant_name?: string | null
  used_at?: string | null
}
type WrittenReview = {
  id: number
  product_id: number
  rating: number
  content?: string | null
  created_at: string
  product_name?: string | null
  product_image?: string | null
}

/**
 * 쓸 수 있는 리뷰 — 서버 자격과 같은 기준: **매장에서 쓴**(used) 매장 이용권 중 아직 리뷰가 없는 상품, 상품당 하나.
 * 교환권(딜 결제)은 이 자격 경로가 아니라 빠진다.
 */
export function reviewableVouchers(vouchers: VoucherRow[], written: { product_id: number }[]): VoucherRow[] {
  const done = new Set(written.map((r) => Number(r.product_id)))
  const seen = new Set<number>()
  const out: VoucherRow[] = []
  for (const v of vouchers) {
    const pid = Number(v.product_id)
    if (!pid || v.status !== 'used' || Number(v.deal_only) === 1 || !isStoreVoucher(v)) continue
    if (done.has(pid) || seen.has(pid)) continue
    seen.add(pid)
    out.push(v)
  }
  return out
}

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-wash">
      {src ? (
        <img
          src={cfImage(src, { width: 112, quality: 80, format: 'auto' }) || src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => cfImageOnError(e.currentTarget, src)}
        />
      ) : null}
    </div>
  )
}

export default function MyReviewsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const vouchersQ = useMyVouchers()
  const writtenQ = useQuery<WrittenReview[]>({
    queryKey: ['my', 'reviews', 'written'],
    queryFn: () => api.get('/api/reviews/my').then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
  })
  const rewardQ = useQuery<{ text: number; image: number }>({
    queryKey: ['reviews', 'reward-config'],
    queryFn: () => api.get('/api/reviews/reward-config').then((r) => r.data?.data),
    staleTime: 10 * 60 * 1000,
  })

  const written = writtenQ.data ?? []
  const toWrite = useMemo(
    () => reviewableVouchers((vouchersQ.data ?? []) as VoucherRow[], written),
    [vouchersQ.data, written],
  )
  const loading = vouchersQ.isLoading || writtenQ.isLoading
  const isError = vouchersQ.isError || writtenQ.isError
  const reward = rewardQ.data
  const rewardHint = reward && Number.isFinite(reward.text)
    ? t('myReviews.rewardHintAmount', {
        defaultValue: '리뷰를 쓰면 {{text}}딜, 사진을 함께 올리면 {{image}}딜을 드려요',
        text: formatNumber(reward.text),
        image: formatNumber(reward.image),
      })
    : null

  useEffect(() => {
    if (!isLoggedInSync()) {
      requireLogin(navigate, t('myReviews.loginRequired'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={SUB_PAGE_CLS}>
      <SEO title={t('myReviews.seoTitle')} description={t('myReviews.seoDesc')} url="/my-reviews" noindex />
      <SubPageHeader title={t('myReviews.title')} backLabel={t('myReviews.back')} />

      <main className="ur-content-narrow px-4 pt-2 pb-20 flex flex-col gap-6">
        {loading ? (
          <BrandLoader />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertIcon className="w-10 h-10 text-tone-bad mb-3" />
            <p className="text-[15px] text-gray-900 dark:text-white mb-4">{t('myReviews.loadFailed')}</p>
            <button
              onClick={() => { vouchersQ.refetch(); writtenQ.refetch() }}
              className="px-5 h-11 bg-brand text-white text-[15px] font-medium rounded-full"
            >
              {t('myReviews.retry')}
            </button>
          </div>
        ) : toWrite.length === 0 && written.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-lift dark:shadow-none px-6 py-10 text-center">
            {/* 🦦 2026-10-10 (대표 "다 해줘"): 빈 리뷰 → 윙크 유달이(안내 — 리뷰 보상이 있다는 걸 알려주는 자리) */}
            <Udal mood="tip" size={96} className="block mx-auto mb-4" />
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('myReviews.empty')}</h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('myReviews.emptySub')}</p>
            {rewardHint && <p className="mt-3 text-[13px] font-medium text-brand-text">{rewardHint}</p>}
          </div>
        ) : (
          <>
            {toWrite.length > 0 && (
              <section data-testid="reviews-to-write">
                <h2 className="px-1 text-[17px] font-bold text-gray-900 dark:text-white">
                  {t('myReviews.toWriteTitle', { defaultValue: '리뷰를 기다려요 {{count}}', count: toWrite.length })}
                </h2>
                {rewardHint && <p className="px-1 mt-1 text-[13px] text-brand-text font-medium">{rewardHint}</p>}
                <div className="mt-3 rounded-2xl bg-surface shadow-lift dark:shadow-none overflow-hidden">
                  {toWrite.map((v) => {
                    const name = v.product_name || ''
                    return (
                      <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-rule last:border-b-0">
                        <Thumb src={v.product_image} alt={name} />
                        <div className="flex-1 min-w-0">
                          {v.restaurant_name && (
                            <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{v.restaurant_name}</p>
                          )}
                          <p className="text-[15px] font-medium text-gray-900 dark:text-white truncate">{name}</p>
                          {v.used_at && (
                            <p className="text-[12px] text-gray-500 dark:text-gray-400">
                              {t('myReviews.usedOn', { defaultValue: '{{date}} 사용', date: formatKSTDate(v.used_at) })}
                            </p>
                          )}
                        </div>
                        <Link
                          to={`${FLOW_CONFIG.group_buy_toss.detailPath(Number(v.product_id))}#${PASS_REVIEW_ANCHOR}`}
                          className="shrink-0 h-9 px-4 inline-flex items-center rounded-full bg-brand text-white text-[13px] font-medium"
                        >
                          {t('myReviews.writeReview')}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {written.length > 0 && (
              <section data-testid="reviews-written">
                <h2 className="px-1 text-[17px] font-bold text-gray-900 dark:text-white">
                  {t('myReviews.writtenTitle', { defaultValue: '내가 쓴 리뷰 {{count}}', count: written.length })}
                </h2>
                <div className="mt-3 rounded-2xl bg-surface shadow-lift dark:shadow-none overflow-hidden">
                  {written.map((r) => (
                    <Link
                      key={r.id}
                      to={detailHref({ id: r.product_id })}
                      className="flex items-start gap-3 px-4 py-3 border-b border-rule last:border-b-0"
                    >
                      <Thumb src={r.product_image} alt={r.product_name || ''} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-gray-900 dark:text-white truncate">{r.product_name}</p>
                        <div className="mt-1 flex items-center gap-1" aria-label={t('myReviews.ratingLabel', { defaultValue: '별점 {{n}}점', n: r.rating })}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <StarIcon key={n} filled={n <= r.rating} className={`w-4 h-4 ${n <= r.rating ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                          <span className="ml-1 text-[12px] text-gray-500 dark:text-gray-400">{formatKSTDate(r.created_at)}</span>
                        </div>
                        {r.content && (
                          <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300 line-clamp-2">{r.content}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
