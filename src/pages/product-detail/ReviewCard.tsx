import { useTranslation } from 'react-i18next'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatKSTDate } from '@/utils/date'
import StarRating from '@/components/deal/StarRating'

/**
 * ⭐ 리뷰 카드 (2026-08-19 — 대표 시안: 그루폰 "Reviewed on GROUPON").
 *
 * 그루폰 리뷰 한 칸의 구성: [원형 아바타] [이름] [★] [날짜(우측)] [본문].
 * 우리는 여기에 **우리에게만 있는 두 가지**를 더 싣는다:
 *   - 체험 제공 배지(표시광고법 의무 — 서버 판정이라 작성자가 끌 수 없다)
 *   - 리뷰 사진. ⚠️ 서버는 `images` 를 계속 주고 있었는데 화면이 안 그리고 있었다 —
 *     작성 폼은 사진 5장까지 받으면서 목록엔 한 장도 안 보였다(2026-08-19 실측).
 *
 * 🚫 그루폰에 있지만 **일부러 안 넣은 것**: "N ratings · N reviews" 와 `👍 Helpful`.
 *    둘 다 우리 API 에 없는 값/동작이다. 숫자를 지어내거나 눌러도 아무 일 없는 버튼을 두면
 *    화면만 그루폰이고 내용은 거짓이 된다. 서버가 생기면 그때 넣는다.
 */

export interface ReviewItem {
  id: number | string
  rating: number
  content?: string
  user_name?: string
  created_at: string
  images?: string[] | string | null
  seller_reply?: string | null
  seller_reply_at?: string | null
  is_sponsored?: number | boolean
}

/** 서버가 배열로도 JSON 문자열로도 줄 수 있다 — 둘 다 받아 준다(빈 값이면 빈 배열). */
function parseImages(v: ReviewItem['images']): string[] {
  if (Array.isArray(v)) return v.filter((s) => typeof s === 'string' && s)
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const a: unknown = JSON.parse(v)
      return Array.isArray(a) ? a.filter((s): s is string => typeof s === 'string' && !!s) : []
    } catch { return [] }
  }
  return []
}

export default function ReviewCard({ r }: { r: ReviewItem }) {
  const { t } = useTranslation()
  const photos = parseImages(r.images).slice(0, 4)
  const initial = (r.user_name || '?').trim().charAt(0)

  return (
    <article className="py-4">
      <div className="flex items-start gap-3">
        {/* 아바타 — 프로필 사진이 없으므로 이니셜. 그루폰도 같은 형태(회색 원 + 글자). */}
        <span
          aria-hidden="true"
          className="w-10 h-10 shrink-0 rounded-full bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center text-[15px] font-bold text-gray-500 dark:text-gray-300"
        >
          {initial}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] font-bold text-gray-900 dark:text-white">{r.user_name || '익명'}</span>
            {!!r.is_sponsored && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-500/30">
                {t('reviews.sponsoredBadge', { defaultValue: '체험 제공' })}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <StarRating value={Number(r.rating) || 0} size={14} />
            <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0">{formatKSTDate(r.created_at)}</span>
          </div>

          {r.content && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-gray-800 dark:text-gray-100 break-words">{r.content}</p>
          )}

          {photos.length > 0 && (
            <div className="mt-2.5 flex gap-1.5 flex-wrap">
              {photos.map((src) => (
                <img
                  key={src}
                  src={cfImage(src, { width: 200, format: 'auto' }) || src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-[72px] h-[72px] rounded-lg object-cover bg-gray-100 dark:bg-[#1A2334]"
                  onError={(e) => cfImageOnError(e.currentTarget, src)}
                />
              ))}
            </div>
          )}

          {r.seller_reply && (
            <div className="mt-2.5 rounded-lg bg-gray-50 dark:bg-[#1A2334] p-2.5">
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                {t('reviews.sellerReplyLabel', { defaultValue: '매장 답글' })}
                {r.seller_reply_at && (
                  <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">{formatKSTDate(r.seller_reply_at)}</span>
                )}
              </p>
              <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">{r.seller_reply}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
