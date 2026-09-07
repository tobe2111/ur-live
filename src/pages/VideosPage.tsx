import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import BrandLoader from '@/components/brand/BrandLoader'
import { youTubeEmbedUrl, type UrShortItem } from '@/shared/urshorts'
import SEO from '@/components/SEO'

/**
 * 🎬 `/videos` — 유어쇼츠 뷰어 (2026-09-07 대표 확정: 주소는 `/videos`).
 *
 * 옛 `/shorts` 는 라이브커머스와 함께 내려간 자리(2026-07-07 제거)라 재사용하지 않는다 —
 * 되살리면 다음 세션이 폐기된 기능으로 오해한다.
 *
 * ## 🔴 재생기는 **항상 하나만** 산다
 * 유튜브 재생기는 무겁다. 열 개를 띄워 두면 폰에서 화면이 멈춘다. 그래서 지금 보는 한 편만
 * iframe 이고 나머지는 사진이다. 넘어가면 이전 iframe 은 **파기**된다(React key 로 강제).
 * 이 불변식이 깨지면 목록이 길어질수록 조용히 느려지고, 에러가 안 나서 아무도 모른다.
 *
 * ## 🔴 목록은 **열 때 한 번**만 받는다
 * 넘길 때마다 부르면 D1 읽기가 스와이프 수만큼 늘어난다. 2026-09-01 에 하루 읽기 한도를
 * 넘겨 소비자 API 가 통째로 멈춘 적이 있다.
 *
 * ## 구매 바가 영상 위에 항상 있는 이유
 * 영상이 끝나기를 기다렸다 보여 주면 이미 늦다. **보는 중에 사고 싶어지는 것**이 이 화면의 전부다.
 */
export default function VideosPage() {
  const [items, setItems] = useState<UrShortItem[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const startVideo = params.get('v')
  const touchY = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/urshorts?all=1')
      .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
      .then((r) => {
        if (!alive) return
        const list = r?.success && Array.isArray(r.data) ? r.data : []
        setItems(list)
        if (startVideo) {
          const at = list.findIndex((x) => x.video_id === startVideo)
          if (at >= 0) setIdx(at)
        }
      })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [startVideo])

  const cur = items?.[idx]
  const go = useMemo(() => (d: 1 | -1) => {
    setItems((list) => {
      if (list && list.length) setIdx((i) => Math.min(list.length - 1, Math.max(0, i + d)))
      return list
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1)
      if (e.key === 'ArrowDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, navigate])

  if (items === null) return <BrandLoader fullScreen forceDark label="유어쇼츠" />

  if (items.length === 0) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0A0C12] px-6 text-center text-white">
        <div>
          <p className="text-[15px] text-gray-300">아직 올라온 영상이 없어요.</p>
          <Link to="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 text-[14px] font-bold text-white">
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  const dc = Number(cur?.discount_rate) || 0
  const thumb = cur?.thumb_url || cur?.product_image || ''

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-[#0A0C12]"
      onTouchStart={(e) => { touchY.current = e.touches[0]?.clientY ?? null }}
      onTouchEnd={(e) => {
        const s = touchY.current
        const end = e.changedTouches[0]?.clientY
        if (s == null || end == null) return
        if (Math.abs(end - s) > 60) go(end < s ? 1 : -1)
        touchY.current = null
      }}
    >
      <SEO title="유어쇼츠 - 유어딜" description="영상으로 보고 바로 구매하는 이용권" url="/videos" noindex />

      {/* 🔴 key 가 video_id 다 — 넘기면 이전 iframe 이 파기되고 새로 하나만 산다. */}
      {cur && (
        <iframe
          key={cur.video_id}
          src={youTubeEmbedUrl(cur.video_id, { autoplay: true })}
          title={cur.title || '유어쇼츠'}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      <button
        type="button" onClick={() => navigate(-1)} aria-label="닫기"
        className="absolute left-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
      >
        <X size={18} />
      </button>
      <span className="absolute right-3 top-4 z-20 text-[12.5px] font-semibold text-white/85 tabular-nums">
        {idx + 1} / {items.length}
      </span>

      {/* 위아래 이동 — 손가락은 스와이프, 마우스는 이 버튼 */}
      <div className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 gap-2 [@media(hover:hover)_and_(pointer:fine)]:grid">
        <button type="button" aria-label="이전 영상" onClick={() => go(-1)} disabled={idx === 0}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white disabled:opacity-0">
          <ChevronUp size={17} />
        </button>
        <button type="button" aria-label="다음 영상" onClick={() => go(1)} disabled={idx >= items.length - 1}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white disabled:opacity-0">
          <ChevronDown size={17} />
        </button>
      </div>

      {/* 🔴 구매 바는 영상 위에 항상. 끝나기를 기다리면 이미 늦다. */}
      {cur && (
        <div className="absolute inset-x-2.5 bottom-2.5 z-20 flex items-center gap-2.5 rounded-2xl bg-white/97 p-2.5 shadow-2xl">
          {thumb && (
            <img
              src={cfImage(thumb, { width: 120 })} alt=""
              width={46} height={46}
              className="h-[46px] w-[46px] shrink-0 rounded-[9px] object-cover"
              onError={(e) => cfImageOnError(e.currentTarget, thumb)}
            />
          )}
          <div className="min-w-0 flex-1 text-gray-900">
            <div className="truncate text-[10.5px] text-gray-500">{cur.store_name || ''}</div>
            <div className="truncate text-[15px] font-bold tabular-nums">
              {dc > 0 && <span className="mr-1 text-[12.5px] text-sale">{dc}%</span>}
              {formatNumber(cur.price)}원
            </div>
          </div>
          <Link
            to={`/group-buy/${cur.product_id}`}
            className="shrink-0 rounded-[10px] bg-brand px-[15px] py-[11px] text-[13.5px] font-bold text-white"
          >
            구매
          </Link>
        </div>
      )}
    </div>
  )
}
