/**
 * 🎬 이용권 상세 "다녀온 사람들" — 2026-11-04 대표 확정 **손님 2**(시안 https://claude.ai/artifact/8jrxtpbGUfwxLwrJTHKaMe)
 *
 * 한 칸에 [유어딜 추천 띠] → [영상 한 줄(유어딜 사람 맨 앞 · 파란 테두리)] → [블로그 목록 3개 + 모두 보기].
 * 데이터는 `/api/creator-content/:productId` 하나(가게 단위 · 보이는 것만 · 정렬은 서버 `sortForCustomer`).
 *
 * 🔴 **콘텐츠가 0개면 아무것도 안 그린다**(칸 자체가 없다 — 지어낸 내용 0).
 * 🔴 이 부품은 상세가 **lazy + 화면 근처에서만** 부른다(첫 화면 무게 0). 재생기·블로그 창은 누를 때만 받는다.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import type { ContentItem, CreatorContentPayload } from '@/shared/creator-content'
import { PlatformMark, urdealBadge } from './content-marks'
import type { BuyInfo } from './ContentViewer'

const ContentViewer = lazy(() => import('./ContentViewer'))
const PinnersSheet = lazy(() => import('./PinnersSheet'))

const BLOG_PREVIEW = 3

export default function CreatorContentRow({ productId, buy, onBuy }: { productId: number; buy: BuyInfo; onBuy: () => void }) {
  const [data, setData] = useState<CreatorContentPayload | null>(null)
  const [open, setOpen] = useState<{ list: ContentItem[]; index: number } | null>(null)
  const [pinnersOpen, setPinnersOpen] = useState(false)
  const [allBlogs, setAllBlogs] = useState(false)
  const [read, setRead] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let alive = true
    fetch(`/api/creator-content/${productId}`)
      .then((r) => r.json() as Promise<{ success?: boolean; data?: CreatorContentPayload }>)
      .then((r) => { if (alive && r?.success && r.data) setData(r.data) })
      .catch(() => null)
    return () => { alive = false }
  }, [productId])

  if (!data) return null
  const videos = data.items.filter((i) => i.kind === 'video')
  const blogs = data.items.filter((i) => i.kind === 'blog')
  const pinners = data.pinners
  if (!videos.length && !blogs.length && !pinners.length) return null
  const shownBlogs = allBlogs ? blogs : blogs.slice(0, BLOG_PREVIEW)
  const total = videos.length + blogs.length

  const openAt = (list: ContentItem[], index: number) => {
    setOpen({ list, index })
    if (list[index]) setRead((s) => new Set(s).add(list[index].id))
  }

  return (
    <section aria-label="다녀온 사람들" data-testid="creator-content" className="px-4 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">다녀온 사람들</h2>
        {total > 0 && <span className="text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">{total}개</span>}
      </div>

      {pinners.length > 0 && (
        <button type="button" onClick={() => setPinnersOpen(true)} data-testid="creator-pinners"
          className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-brand-tint px-3 py-3 text-left active:opacity-80">
          <span className="flex shrink-0">
            {pinners.slice(0, 3).map((p, i) => (
              <span key={p.user_id} className={`block h-7 w-7 overflow-hidden rounded-full border-2 border-white bg-gray-200 dark:border-[#1D1F29] dark:bg-[#2A2A2A]${i ? ' -ml-2' : ''}`}>
                {p.avatar && <img src={p.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-gray-900 dark:text-white">유어딜 {pinners.length}명이 추천해요</span>
            <span className="block truncate text-[13px] text-gray-600 dark:text-gray-300">{pinners[0].name || `@${pinners[0].handle}`}{pinners.length > 1 ? ` 외 ${pinners.length - 1}명이 유어샵에서 판매 중` : '님이 유어샵에서 판매 중'}</span>
          </span>
          <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">›</span>
        </button>
      )}

      {videos.length > 0 && (
        <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videos.map((v, i) => {
            const badge = urdealBadge(v)
            return (
              <li key={v.id} className="w-28 shrink-0">
                <button type="button" onClick={() => openAt(videos, i)} aria-label={`${v.author_name ?? '영상'} 보기`}
                  className={`relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-[#1A1A1A]${badge ? ' ring-2 ring-brand ring-inset' : ''}`}>
                  {v.thumb_url && <img src={v.thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                  <PlatformMark platform={v.platform} urdeal={!!badge} className="absolute left-2 top-2" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {/* 사진 위 재생 표시 — 테마와 무관하게 흰 원 · 검은 삼각형 */}<span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,.85)', color: '#16181C' }}><Play className="h-4 w-4" fill="currentColor" /></span>
                  </span>
                </button>
                <p className="mt-2 truncate text-[12px] font-medium text-gray-900 dark:text-white">{v.author_name || v.title || '영상'}</p>
                {badge
                  ? <span className="mt-1 inline-block rounded bg-brand-tint px-1 text-[12px] font-medium text-brand-text">{badge}</span>
                  : v.author_meta && <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">{v.author_meta}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {blogs.length > 0 && (
        <ul className={`${videos.length || pinners.length ? 'mt-3 ' : 'mt-1 '}divide-y divide-rule`} data-testid="creator-blogs">
          {shownBlogs.map((b, i) => (
            <li key={b.id}>
              <button type="button" onClick={() => openAt(blogs, i)}
                className={`flex w-full items-center gap-3 py-3 text-left active:opacity-70${read.has(b.id) ? ' bg-brand-tint' : ''}`}>
                <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#1A1A1A]">
                  {b.thumb_url && <img src={b.thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] font-medium leading-snug text-gray-900 dark:text-white">{b.title || '블로그 글'}</span>
                  <span className="mt-1 flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                    <PlatformMark platform={b.platform} />
                    <span className="truncate">{b.author_name || '네이버 블로그'}{read.has(b.id) ? ' · 읽음' : ''}</span>
                    {b.sponsored && <span className="shrink-0 rounded bg-gray-100 px-1 dark:bg-[#1A1A1A]">협찬</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {blogs.length > BLOG_PREVIEW && !allBlogs && (
        <button type="button" onClick={() => setAllBlogs(true)} className="mt-1 w-full border-t border-rule pt-3 text-center text-[13px] text-gray-600 dark:text-gray-300">
          블로그 후기 {blogs.length}개 모두 보기
        </button>
      )}

      {open && (
        <Suspense fallback={null}>
          <ContentViewer items={open.list} start={open.index} buy={buy}
            onClose={() => setOpen(null)} onBuy={() => { setOpen(null); onBuy() }}
            onSeen={(id) => setRead((s) => new Set(s).add(id))} />
        </Suspense>
      )}
      {pinnersOpen && (
        <Suspense fallback={null}>
          <PinnersSheet pinners={pinners} onClose={() => setPinnersOpen(false)} />
        </Suspense>
      )}
    </section>
  )
}
