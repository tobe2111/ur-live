import { MapPin } from 'lucide-react'
import StarRating from '@/components/deal/StarRating'

/**
 * 🏷️ 이용권 상세 **제목 헤더** — PC 전용 (2026-08-19 대표 확정: 상세 시안 **1안 "그루폰 정석"**).
 *
 * ## 왜 사진 위로 올렸나
 * 이전 PC 화면은 [사진 800px] → 그 **아래**에 제목·매장·주소였다. 첫 화면에 사진만 가득 차고
 * *"무엇을 파는지 / 얼마나 좋은지"* 는 스크롤해야 나왔다. 그루폰은 반대다 — 제목·별점·위치가
 * 사진 **위**에 있고 사진은 그 근거로 따라온다. 대표가 1안을 고른 이유가 이것이다.
 *
 * ## 모바일은 왜 안 바꾸나
 * 세로 화면에서는 사진이 먼저 오는 게 자연스럽고(썸네일→상세의 시각적 연결), 제목은 바로 아래
 * 한 스크롤 안에 들어온다. PC 만 폭이 남아서 생기던 문제였다. ⇒ 이 컴포넌트는 `hidden lg:block`.
 *
 * ⚠️ 색은 `.gbd` CSS 변수(테마 자동) — 상세 표면과 동톤이어야 한다.
 */
export default function DetailTitleHeader({
  name, storeName, address, phone, rating, reviewCount, onnuri,
}: {
  name: string
  storeName?: string
  address?: string
  phone?: string
  /** 평균 별점(0이면 별을 그리지 않는다 — 빈 별 5개는 "나쁨"으로 읽힌다). */
  rating?: number
  reviewCount?: number
  onnuri?: boolean
}) {
  const hasRating = Number(rating) > 0
  return (
    <header className="hidden lg:block lg:max-w-[1200px] lg:mx-auto lg:pt-6 lg:pb-3">
      {storeName && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-accent)', letterSpacing: '.01em' }}>
          {storeName} · 정식 등록 매장
          {onnuri && (
            <span className="ml-1.5 px-1.5 py-[1px] rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold align-middle">온누리 사용 가능</span>
          )}
        </div>
      )}
      <h1 style={{ margin: '6px 0 0', fontSize: 29, lineHeight: 1.24, fontWeight: 900, letterSpacing: '-.028em', color: 'var(--gbd-ink)' }}>{name}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 9, fontSize: 13.5, color: 'var(--gbd-sub)' }}>
        {hasRating && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <StarRating value={Number(rating)} size={15} />
            <b style={{ color: 'var(--gbd-ink)', fontWeight: 800 }}>{Number(rating).toFixed(1)}</b>
            {Number(reviewCount) > 0 && <span style={{ color: 'var(--gbd-sub2)' }}>({reviewCount})</span>}
          </span>
        )}
        {address && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {hasRating && <span style={{ color: 'var(--gbd-line2)' }}>|</span>}
            <MapPin style={{ width: 15, height: 15, flex: '0 0 auto' }} />
            {address}
          </span>
        )}
        {phone && (
          <a href={`tel:${phone}`} style={{ color: 'var(--gbd-ink2)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid var(--gbd-line2)' }}>{phone}</a>
        )}
      </div>
    </header>
  )
}
