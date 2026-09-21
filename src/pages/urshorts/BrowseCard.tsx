import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { priceDisplay } from '@/shared/price-display'
import { shortsRegionLabel } from '@/shared/urshorts-regions'
import { URSHORTS_VIEWER_PATH, type UrShortItem } from '@/shared/urshorts'

/**
 * 🎬 전체 보기 그리드의 카드 한 장 (2026-09-21).
 *
 * 홈 레일 카드(`UrShortsRail`)와 **같은 규칙**을 따른다 — 9:16 · 사진 위 가격 띠 ·
 * 모르는 줄은 안 그림 · `priceDisplay` SSOT · `cfImageOnError` 폴백.
 * 다른 점은 폭이 고정(125px)이 아니라 **칸을 채운다**는 것 하나다. 레일은 옆으로 미는
 * 줄이라 카드 크기가 고정이어야 하지만, 여기는 목록이라 화면 폭이 열 수를 정한다.
 */
function Card({ item, eager }: { item: UrShortItem; eager: boolean }) {
  const thumb = item.thumb_url || item.product_image || ''
  const pd = priceDisplay(item)
  const dur = Number(item.duration_sec) || 0
  const durLabel = dur > 0 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : null
  const hasInfo = !!(item.store_name || item.product_name || pd.price > 0)
  // 📍 도시 줄은 **생활권을 먼저** 쓴다(`기장` 이 `부산` 보다 많은 것을 말해 준다).
  //    둘 다 없으면 줄 자체를 안 그린다 — 레일 카드와 같은 약속.
  const place = item.region_area || shortsRegionLabel(item.region_si)

  return (
    <Link
      to={`${URSHORTS_VIEWER_PATH}?v=${item.video_id}`}
      className="group block text-left"
      aria-label={`${item.store_name || ''} ${item.title || '유어쇼츠 영상'}`}
    >
      <span className="relative block aspect-[9/16] overflow-hidden rounded-[10px] bg-[#2A2D38]">
        {thumb ? (
          <img
            src={cfImage(thumb, { width: 360 })}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => cfImageOnError(e.currentTarget, thumb)}
          />
        ) : null}
        <span className="absolute left-2 top-2 grid h-[24px] w-[24px] place-items-center rounded-full bg-black/50 text-white">
          <Play size={12} fill="currentColor" strokeWidth={0} />
        </span>
        {durLabel && (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 py-px text-[10px] font-semibold tabular-nums text-white">
            {durLabel}
          </span>
        )}
        {hasInfo && (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2 pb-2 pt-5 text-white">
            {item.store_name && (
              <span className="block truncate text-[10.5px] opacity-90">{item.store_name}</span>
            )}
            {item.product_name && (
              <span className="mt-px block truncate text-[11.5px] font-semibold leading-tight">
                {item.product_name}
              </span>
            )}
            {pd.showOriginal && (
              <span className="mt-0.5 block text-[9.5px] tabular-nums line-through opacity-70">
                {formatNumber(pd.originalPrice)}원
              </span>
            )}
            {pd.price > 0 && (
              <span className="mt-px block text-[12.5px] font-bold tabular-nums">
                {/* 사진 위 스크림은 테마와 무관하게 늘 어둡다 — 레일과 같은 다크용 세일 값. */}
                {pd.discount > 0 && <b className="text-[#FF5C69]">{pd.discount}% </b>}
                {formatNumber(pd.price)}원
              </span>
            )}
          </span>
        )}
      </span>
      {/* 사진 밖 두 줄 — 제목은 두 줄까지, 그 아래 채널·동네. 목록에서는 무엇인지 읽고 고른다. */}
      {item.title && (
        <span className="mt-1.5 block line-clamp-2 text-[12.5px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {item.title}
        </span>
      )}
      {(item.channel || place) && (
        <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">
          {[item.channel, place].filter(Boolean).join(' · ')}
        </span>
      )}
    </Link>
  )
}

export default memo(Card)
