import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import {
  URSHORTS_CARD_W, URSHORTS_CARD_H, URSHORTS_VIEWER_PATH, type UrShortItem,
} from '@/shared/urshorts'

/**
 * 🎬 유어쇼츠 레일 — 홈에서 인기 이용권 바로 아래 (2026-09-07 대표 확정).
 *
 * ## 왜 이 크기·이 자리인가 (실측)
 * 처음 시안은 한 줄 6개(217×386 + 제목 줄 = 430px)였는데 **바로 위 딜 카드가 299px** 이라
 * 딜을 팔려고 놓은 것이 딜보다 1.4배 컸다. 대표가 **125×222 고정**으로 확정했다 —
 * 딜 카드보다 77px 낮고, 몇 개가 보이는지는 화면이 정한다(1440에서 10개 · 390에서 2개 + 잘린 조각).
 * 히어로 바로 아래가 아닌 이유는 홈이 첫 딜을 보여 주는 시각(559ms→304ms로 당겨 둔 값)을
 * 늦추기 때문이고, 4열 그리드가 세 번 연달아 나오던 단조로움도 이 세로 레일이 끊는다.
 *
 * ## 🔴 홈 첫 화면을 무겁게 하지 않는 세 가지
 * ① **썸네일은 레일이 화면에 다가올 때** 받는다(IntersectionObserver). 홈 첫 페인트 예산 밖.
 * ② **재생기는 여기서 안 만든다.** 카드를 누르면 `/videos` 로 가고, iframe 은 거기서 하나만 산다.
 * ③ **영상이 없으면 통째로 렌더하지 않는다.** 빈 줄을 남기지 않는다.
 *
 * ## 넘기는 방법이 화면마다 다른 이유 (실측)
 * 12편이면 폰은 10편이 숨고 PC 는 2~6편만 숨는다. 그런데 **정작 막히는 쪽은 PC** 다 —
 * 마우스 휠은 세로로만 굴러가고 스크롤 막대는 숨겨 놨다. 그래서 폰에는 아무것도 안 붙이고
 * (잘린 카드가 이미 말한다) PC 에만 hover 화살표를 둔다. 끝에는 `/videos` 로 가는 타일을 둬
 * 끝까지 민 사람이 문을 만나게 한다.
 *
 * ⚠️ 휠을 가로채지 않는다 — 레일 위에서 페이지가 안 내려가는 잘 알려진 짜증이 된다.
 */
function ShortCard({ item, load, onOpen }: { item: UrShortItem; load: boolean; onOpen: () => void }) {
  const thumb = item.thumb_url || item.product_image || ''
  const dc = Number(item.discount_rate) || 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 snap-start text-left"
      style={{ width: URSHORTS_CARD_W }}
      aria-label={`${item.store_name || ''} ${item.title || '유어쇼츠 영상'}`}
    >
      <span
        className="relative block overflow-hidden rounded-[10px] bg-gray-200 dark:bg-[#2A2D38]"
        style={{ height: URSHORTS_CARD_H }}
      >
        {load && thumb ? (
          <img
            src={cfImage(thumb, { width: 250 })}
            alt=""
            width={URSHORTS_CARD_W}
            height={URSHORTS_CARD_H}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => cfImageOnError(e.currentTarget, thumb)}
          />
        ) : null}
        <span className="absolute left-2 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-black/50 text-white">
          <Play size={11} fill="currentColor" strokeWidth={0} />
        </span>
        {/* 가격이 사진 위에 있는 것이 요점이다 — 누르기 전에 이미 "파는 것"임을 안다. */}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-[7px] pb-[7px] pt-[18px] text-white">
          <span className="block truncate text-[9.5px] opacity-90">{item.store_name || ''}</span>
          <span className="mt-[1px] block text-[11.5px] font-bold tabular-nums">
            {dc > 0 && <b className="text-[#FF8A93]">{dc}% </b>}
            {formatNumber(item.price)}원
          </span>
        </span>
      </span>
    </button>
  )
}
const MemoCard = memo(ShortCard)

export default function UrShortsRail() {
  const [items, setItems] = useState<UrShortItem[]>([])
  const [near, setNear] = useState(false)
  const [edge, setEdge] = useState({ l: false, r: false })
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)

  /**
   * 🔴 **다가올 때 부른다.** 마운트 때 부르면 홈을 여는 모든 사람이 요청 하나를 더 내는데,
   * 대부분은 여기까지 스크롤하지 않는다. 관측 여백 300px 안에 들어온 사람만 부르므로
   * **홈 첫 화면의 요청 수와 D1 읽기가 0** 이다. 썸네일도 같은 신호를 쓴다.
   */
  useEffect(() => {
    const el = wrapRef.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() } },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  useEffect(() => {
    if (!near) return
    let alive = true
    fetch('/api/urshorts')
      .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
      .then((r) => {
        if (alive && r?.success && Array.isArray(r.data)) setItems(r.data)
      })
      .catch(() => { /* fail-soft: 레일이 안 뜰 뿐 홈은 열린다 */ })
    return () => { alive = false }
  }, [near])

  const sync = useMemo(() => () => {
    const r = railRef.current
    if (!r) return
    setEdge({ l: r.scrollLeft > 8, r: r.scrollLeft < r.scrollWidth - r.clientWidth - 8 })
  }, [])
  useEffect(() => { sync() }, [sync, items.length])

  // 보이는 폭에서 카드 한 장을 뺀 만큼. 한 장이 겹쳐 넘어와 어디까지 봤는지 잃지 않는다.
  const nudge = (dir: 1 | -1) => {
    const r = railRef.current
    if (!r) return
    const one = URSHORTS_CARD_W + 12
    r.scrollBy({ left: dir * Math.max(one, r.clientWidth - one), behavior: 'smooth' })
  }

  /**
   * 영상이 없으면 섹션 자체를 안 보인다(대표 확정) — 빈 줄을 남기지 않는다.
   * 단 **관측용 빈 div 는 남긴다**: 이게 없으면 IntersectionObserver 가 붙을 곳이 없어
   * 영원히 데이터를 안 부른다(첫 판에서 실제로 그랬다).
   */
  if (items.length === 0) return <div ref={wrapRef} aria-hidden="true" />

  return (
    <section className="ur-home-panel light-island" ref={wrapRef}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <h3 className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white">
          유어쇼츠
          <span className="ml-2 text-[11.5px] font-normal text-gray-500 dark:text-gray-400">
            눌러서 보고 바로 구매
          </span>
        </h3>
        <Link
          to={URSHORTS_VIEWER_PATH}
          className="shrink-0 whitespace-nowrap text-[12.5px] font-bold text-gray-600 underline-offset-4 hover:underline dark:text-gray-300"
        >
          전체 보기
        </Link>
      </div>

      <div className="relative">
        {/* 화살표는 PC 에서 레일에 마우스를 올렸을 때만. 폰은 잘린 카드가 이미 말한다. */}
        {edge.l && (
          <button
            type="button" aria-label="이전"
            onClick={() => nudge(-1)}
            className="absolute left-[-13px] z-[3] hidden h-9 w-9 place-items-center rounded-full bg-white text-gray-900 shadow-lg dark:bg-[#1D1F29] dark:text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid"
            style={{ top: URSHORTS_CARD_H / 2 - 18 }}
          >
            <ChevronLeft size={17} />
          </button>
        )}
        <div
          ref={railRef}
          onScroll={sync}
          className="ur-shorts-rail flex snap-x snap-mandatory gap-3 overflow-x-auto"
        >
          {items.map((it) => (
            <MemoCard
              key={it.id}
              item={it}
              load={near}
              onOpen={() => { window.location.href = `${URSHORTS_VIEWER_PATH}?v=${it.video_id}` }}
            />
          ))}
          {/* 끝까지 민 사람은 이미 관심이 있다. 그 자리에 문을 둔다. */}
          <Link
            to={URSHORTS_VIEWER_PATH}
            className="grid shrink-0 snap-start place-items-center gap-1.5 rounded-[10px] border border-dashed border-gray-300 text-center text-brand dark:border-[#3A3D48]"
            style={{ width: URSHORTS_CARD_W, height: URSHORTS_CARD_H }}
          >
            <span>
              <ChevronRight size={24} className="mx-auto" />
              <span className="mt-1 block text-[12px] font-bold">전체 보기</span>
              <span className="mt-[2px] block text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
                {items.length}편
              </span>
            </span>
          </Link>
        </div>
        {edge.r && (
          <button
            type="button" aria-label="다음"
            onClick={() => nudge(1)}
            className="absolute right-[-13px] z-[3] hidden h-9 w-9 place-items-center rounded-full bg-white text-gray-900 shadow-lg dark:bg-[#1D1F29] dark:text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid"
            style={{ top: URSHORTS_CARD_H / 2 - 18 }}
          >
            <ChevronRight size={17} />
          </button>
        )}
      </div>
    </section>
  )
}
