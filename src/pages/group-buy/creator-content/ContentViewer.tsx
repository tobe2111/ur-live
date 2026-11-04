/**
 * 🎬 "다녀온 사람들" 보기 창 — 2026-11-04 대표 확정(영상: 유어쇼츠처럼 전체 화면 · 블로그: 시안 https://claude.ai/artifact/8j6giZULgH5cpjWtQv34BC)
 *
 * 영상  — 위아래로 넘긴다(scroll-snap). 재생기는 **지금 보이는 한 편만** 띄운다(나머지는 썸네일) — 재생기 하나가 수백 KB.
 *         네이버 클립은 공식 재생기가 없어서 썸네일 + "네이버에서 보기".
 * 블로그 — 글을 **창 안에** 띄운다. 그 글이 다른 사이트 안에 뜨는 걸 막아 두었으면(`embeddable=false`, 수집 때 헤더로 판정)
 *         미리보기(사진·제목·요약) + "블로그에서 전체 읽기"(새 창이 아니라 **같은 화면**에서 넘어간다 → 뒤로 가기로 돌아온다).
 * 둘 다 아래에 **구매 바**가 붙는다 — 보다가 바로 산다.
 *
 * 🔴 iframe 은 각 플랫폼 공식 주소만(`embedUrl`) — CSP `frame-src` 에 그 호스트만 열어 두었다(worker/index.ts).
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { embedUrl, naverBlogMobileUrl, type ContentItem } from '@/shared/creator-content'
import { formatNumber } from '@/utils/format'
import { PlatformMark, platformLabel, urdealBadge } from './content-marks'

export interface BuyInfo { store: string | null; price: number | null; discountPct: number | null; image: string | null }

function BuyBar({ buy, onBuy, dark }: { buy: BuyInfo; onBuy: () => void; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 pt-3 ${dark ? 'bg-black/70 text-white' : 'border-t border-rule bg-surface text-ink'}`}
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
      <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-warm">
        {buy.image && <img src={buy.image} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] ${dark ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{buy.store}</span>
        {buy.price != null && (
          <span className="block text-[15px] font-bold tabular-nums">
            {formatNumber(buy.price)}원{buy.discountPct ? <span className="ml-1 text-sale">{buy.discountPct}%</span> : null}
          </span>
        )}
      </span>
      <button type="button" onClick={onBuy} className="shrink-0 rounded-xl bg-brand px-5 py-3 text-[15px] font-bold text-white active:opacity-90">구매</button>
    </div>
  )
}

function VideoSlide({ item, active }: { item: ContentItem; active: boolean }) {
  const src = embedUrl(item.platform, item.ext_id)
  const badge = urdealBadge(item)
  return (
    <div className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {active && src ? (
        <iframe src={src} title={item.title || platformLabel(item.platform)} className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        item.thumb_url && <img src={item.thumb_url} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-white">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <PlatformMark platform={item.platform} urdeal={!!badge} />
          <span className="truncate">{item.author_name || platformLabel(item.platform)}</span>
          {badge && <span className="shrink-0 rounded bg-brand px-1 text-[12px] font-medium">{badge}</span>}
        </p>
        {item.title && <p className="mt-1 line-clamp-2 text-[13px] text-white/85">{item.title}</p>}
      </div>
      {(!src || !active) && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="absolute right-4 top-16 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1 text-[12px] text-white">
          {platformLabel(item.platform)}에서 보기 <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function BlogBody({ item }: { item: ContentItem }) {
  const full = naverBlogMobileUrl(item.ext_id)
  if (item.embeddable) {
    return <iframe src={full} title={item.title || '블로그 글'} className="h-full w-full border-0" style={{ background: "white" }} referrerPolicy="no-referrer" />
  }
  const date = item.published_at ? item.published_at.slice(0, 10).replace(/-/g, '.') : null
  return (
    <div className="h-full overflow-y-auto px-5 py-5">
      {item.thumb_url && <img src={item.thumb_url} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-full rounded-xl object-cover" />}
      <h3 className="mt-3 text-[20px] font-semibold leading-snug text-gray-900 dark:text-white">{item.title || '블로그 글'}</h3>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{[item.author_name, date, item.sponsored ? '협찬' : null].filter(Boolean).join(', ')}</p>
      {item.summary && <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{item.summary}</p>}
      {/* 같은 화면에서 넘어간다(target 없음) — 폰의 뒤로 가기로 상세에 돌아온다. */}
      <a href={full} className="mt-5 flex items-center justify-center gap-1 rounded-xl border border-rule py-3 text-[15px] font-medium text-gray-900 dark:text-white">
        블로그에서 전체 읽기 <ChevronRight className="h-4 w-4" />
      </a>
    </div>
  )
}

export default function ContentViewer({ items, start, buy, onClose, onBuy, onSeen }: {
  items: ContentItem[]; start: number; buy: BuyInfo; onClose: () => void; onBuy: () => void; onSeen: (id: string) => void
}) {
  const [index, setIndex] = useState(Math.max(0, Math.min(start, items.length - 1)))
  const listRef = useRef<HTMLDivElement | null>(null)
  const isBlog = items[0]?.kind === 'blog'

  // 뒤 화면 스크롤을 잠그고, 뒤로 가기·Esc 로 닫는다.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  // 영상: 처음 연 편으로 스크롤하고, 보이는 편을 따라 index 를 바꾼다.
  useEffect(() => {
    if (isBlog) return
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.clientHeight * index, behavior: 'auto' })
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setIndex(Number((e.target as HTMLElement).dataset.i))
    }, { root: el, threshold: 0.6 })
    el.querySelectorAll('[data-i]').forEach((n) => obs.observe(n))
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlog])

  useEffect(() => { if (items[index]) onSeen(items[index].id) }, [index, items, onSeen])

  if (!items.length) return null
  const cur = items[index]

  if (isBlog) {
    return (
      <div role="dialog" aria-modal="true" aria-label="블로그 글" className="fixed inset-0 z-[80] flex flex-col bg-surface"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
          <button type="button" onClick={onClose} aria-label="닫기" className="text-gray-900 dark:text-white"><X className="h-5 w-5" /></button>
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
            <PlatformMark platform={cur.platform} /><span className="truncate">{cur.author_name || '네이버 블로그'}</span>
          </span>
          {items.length > 1 && (
            <span className="flex items-center gap-1 text-[13px] tabular-nums text-gray-500 dark:text-gray-400">
              <button type="button" aria-label="이전 글" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="p-1 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              {index + 1} / {items.length}
              <button type="button" aria-label="다음 글" disabled={index >= items.length - 1} onClick={() => setIndex((i) => i + 1)} className="p-1 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </span>
          )}
          <a href={cur.url} target="_blank" rel="noopener noreferrer" aria-label="원본 보기" className="text-gray-500 dark:text-gray-400"><ArrowUpRight className="h-5 w-5" /></a>
        </div>
        <div className="min-h-0 flex-1" key={cur.id}><BlogBody item={cur} /></div>
        <BuyBar buy={buy} onBuy={onBuy} />
      </div>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="영상" className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 text-white" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full bg-black/40 p-2"><X className="h-5 w-5" /></button>
        <span className="rounded-full bg-black/40 px-3 py-1 text-[13px] tabular-nums">{index + 1} / {items.length}</span>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto scrollbar-hide">
        {items.map((it, i) => (
          <div key={it.id} data-i={i} className="h-full w-full"><VideoSlide item={it} active={i === index} /></div>
        ))}
      </div>
      <BuyBar buy={buy} onBuy={onBuy} dark />
    </div>
  )
}
