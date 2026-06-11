import { useState, useRef, useEffect, memo } from 'react'
import { ChevronRight, Plus, Check, Lock, BellRing, BellOff, Heart } from 'lucide-react'
import {
  WT, won, comma, discountRate, unitMargin, marginRate,
} from '../wholesale/wholesale-theme'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { cfImage } from '@/utils/cf-image'
import type { CatalogItem, ReorderItem } from './types'

// 🏭 Wave 2: 상품코드 — product.code 우선, 없으면 P + 7자리 zero-pad id (시안 P0000xxx).
function productCode(p: { id: number; code?: string | null }): string {
  if (p.code && String(p.code).trim()) return String(p.code).trim()
  return 'P' + String(p.id).padStart(7, '0')
}

// ── 가격 라인 (할인% + 공급가 앵커) ── 비로그인 → 도매가 숨김 + 로그인 유도.
function Price({ p, size = 20 }: { p: CatalogItem; size?: number }) {
  if (p.distributor_price == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: WT.brandSoft, color: WT.brand }}>
        <Lock className="w-3 h-3" /> 로그인하고 공급가 확인
      </span>
    )
  }
  const dr = p.retail_price ? discountRate(p.distributor_price, p.retail_price) : 0
  return (
    <div className="flex items-baseline gap-1.5">
      {dr > 0 && <span className="font-extrabold tabular-nums" style={{ fontSize: 14, color: WT.brand }}>{dr}%</span>}
      <span className="font-extrabold tracking-[-0.02em] tabular-nums" style={{ fontSize: size, color: WT.ink }}>{won(p.distributor_price)}</span>
    </div>
  )
}

function ProductImg({ p, className = '' }: { p: CatalogItem; className?: string }) {
  return (
    <div className="w-full h-full" style={{ background: WT.fill }}>
      {p.image_url
        ? <img src={cfImage(p.image_url, { width: 400, format: 'auto' }) || p.image_url} alt={p.name} draggable={false} loading="lazy" decoding="async" className={'block w-full h-full object-cover ' + className} />
        : null}
    </div>
  )
}

// ── 코너 퀵담기 ──
function QuickAdd({ p, onAdd }: { p: CatalogItem; onAdd: (p: CatalogItem) => void }) {
  const [hit, setHit] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onAdd(p); setHit(true); setTimeout(() => setHit(false), 1000) }}
      aria-label={p.name + ' 담기'}
      className="absolute bottom-2.5 right-2.5 z-10 h-9 w-9 rounded-full flex items-center justify-center transition-colors"
      style={hit ? { background: WT.ink, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' } : { background: '#fff', color: WT.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}>
      {hit ? <Check className="w-[18px] h-[18px]" strokeWidth={2.6} /> : <Plus className="w-[18px] h-[18px]" strokeWidth={2.4} />}
    </button>
  )
}

// ── 그리드 카드 (미니멀 + 마진 — 실제 커머스 컨벤션) ──
export const ProductCard = memo(function ProductCard({ p, onOpen, onAdd, subbed, onRestock, restockBusy, onPrefetch, wished, onWish, aboveFold, priceLoading }: { p: CatalogItem; onOpen: (p: CatalogItem) => void; onAdd: (p: CatalogItem) => void; subbed?: boolean; onRestock?: (p: CatalogItem) => void; restockBusy?: boolean; onPrefetch?: (id: number) => void; wished?: boolean; onWish?: (p: CatalogItem) => void; aboveFold?: boolean; priceLoading?: boolean }) {
  // 🏭 perf: viewport 진입 시 상세 prefetch(rootMargin 100px — 소비자 GroupBuyFeedCard 패턴). hover/focus/touch 도 prefetch.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!onPrefetch || typeof IntersectionObserver === 'undefined') return
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) { onPrefetch(p.id); io.disconnect(); break } }
    }, { rootMargin: '100px' })
    io.observe(el)
    return () => io.disconnect()
  }, [onPrefetch, p.id])
  const prefetch = () => onPrefetch?.(p.id)
  const soldOut = p.stock <= 0
  const mr = p.retail_price && p.distributor_price != null ? marginRate(p.distributor_price, p.retail_price) : 0
  const um = p.retail_price && p.distributor_price != null ? unitMargin(p.distributor_price, p.retail_price) : 0
  const moq = Math.max(1, p.moq || 1)
  // 🏭 2026-06-05 (사용자 요청): 도매몰 상품카드도 대표색 그라데이션 (소비자 카드와 동일). B2B 데이터는 카드색 대비 적응형.
  const [cardColor, setCardColor] = useState<string | null>((p as { dominant_color?: string | null }).dominant_color || null)
  const grad = cardGradient(cardColor)
  const dr = p.retail_price && p.distributor_price != null ? discountRate(p.distributor_price, p.retail_price) : 0
  const locked = p.distributor_price == null
  return (
    <div ref={wrapRef} onMouseEnter={prefetch} onTouchStart={prefetch} onFocusCapture={prefetch} className="group flex flex-col rounded-2xl overflow-hidden" style={{ background: grad.base }}>
      <div className="relative w-full aspect-square overflow-hidden" style={{ background: grad.base }}>
        <button onClick={() => onOpen(p)} aria-label={p.name + ' 상세보기'} className="block w-full h-full">
          {p.image_url && (
            <img
              src={cfImage(p.image_url, { width: 400, format: 'auto' }) || p.image_url}
              alt={p.name}
              draggable={false}
              loading={aboveFold ? 'eager' : 'lazy'}
              fetchPriority={aboveFold ? 'high' : 'auto'}
              decoding="async"
              onLoad={(e) => {
                const c = extractDominantColor(e.currentTarget)
                if (c) {
                  if (!cardColor) setCardColor(c)
                  if (!(p as { dominant_color?: string | null }).dominant_color) reportDominantColor(p.id, c)
                }
              }}
              className="block w-full h-full object-cover"
            />
          )}
        </button>
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1">
          {soldOut && <span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white" style={{ background: 'rgba(23,24,28,0.88)', backdropFilter: 'blur(4px)' }}>품절</span>}
          {p.has_tiers && <span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white" style={{ background: WT.brand }}>수량할인</span>}
          {p.stock > 0 && p.stock < 200 && <span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white" style={{ background: 'rgba(23,24,28,0.82)', backdropFilter: 'blur(4px)' }}>마감임박</span>}
        </div>
        {/* 🏭 2026-06-10 (사용자 요청): 찜 토글 — 우상단 하트 */}
        {onWish && (
          <button
            onClick={(e) => { e.stopPropagation(); onWish(p) }}
            aria-label={p.name + (wished ? ' 찜 해제' : ' 찜')}
            className="absolute top-2.5 right-2.5 z-10 h-8 w-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}>
            <Heart className="w-4 h-4" style={wished ? { color: WT.brand, fill: WT.brand } : { color: WT.ink2 }} />
          </button>
        )}
        {/* 사진 하단 → 카드색 번짐 */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />
        {soldOut ? (
          onRestock && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestock(p) }}
              disabled={restockBusy}
              aria-label={p.name + ' 재입고 알림'}
              className="absolute bottom-2.5 right-2.5 z-10 h-9 w-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-60"
              style={subbed ? { background: WT.ink, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' } : { background: '#fff', color: WT.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}>
              {subbed ? <BellOff className="w-[18px] h-[18px]" strokeWidth={2.4} /> : <BellRing className="w-[18px] h-[18px]" strokeWidth={2.2} />}
            </button>
          )
        ) : (
          <QuickAdd p={p} onAdd={onAdd} />
        )}
      </div>
      <div className="px-2.5 pt-1.5 pb-2.5" style={{ color: grad.text }}>
        <button onClick={() => onOpen(p)} className="text-left text-[13px] leading-[1.35] line-clamp-2 min-h-[36px] block w-full" style={{ color: grad.text }}>{p.name}</button>
        {/* 🏭 Wave 2: 상품코드 (P0000xxx) — 시안 카드 사양. */}
        <div className="mt-0.5 text-[11px] font-mono tabular-nums tracking-tight" style={{ color: grad.sub }}>{productCode(p)}</div>
        {locked ? (
          priceLoading ? (
            /* 🏭 등급가 도착 전(placeholder) — 잠금 칩 오표시 대신 가격 스켈레톤 */
            <span className="block h-5 w-20 rounded mt-1 animate-pulse" style={{ background: grad.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)' }} />
          ) : (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold mt-1" style={{ background: grad.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.15)', color: grad.text }}>
            <Lock className="w-3 h-3" /> 로그인하고 공급가
          </span>
          )
        ) : (
          <div className="flex items-baseline gap-1.5 mt-1">
            {dr > 0 && <span className="font-extrabold tabular-nums text-[14px]" style={{ color: grad.accent }}>{dr}%</span>}
            <span className="font-extrabold tabular-nums tracking-[-0.02em] text-[16px]" style={{ color: grad.text }}>{won(p.distributor_price)}</span>
          </div>
        )}
        {p.retail_price && um > 0 ? (
          <div className="mt-1 flex items-center gap-1.5 text-[12px] tabular-nums whitespace-nowrap" style={{ color: grad.sub }}>
            <span className="font-bold" style={{ color: grad.isLight ? '#047857' : '#34d399' }}>마진 +{won(um)}</span>
            <span>({mr}%)</span>
            <span>·</span>
            <span>재고 {comma(p.stock)}</span>
          </div>
        ) : (
          <div className="mt-1 text-[12px] tabular-nums" style={{ color: grad.sub }}>재고 {comma(p.stock)}</div>
        )}
        {(moq > 1 || Math.max(1, p.order_multiple || 1) > 1) && (
          <div className="mt-1 text-[12px] tabular-nums" style={{ color: grad.sub }}>
            {moq > 1 ? `최소 ${comma(moq)}개` : ''}
            {Math.max(1, p.order_multiple || 1) > 1 ? `${moq > 1 ? ' · ' : ''}${comma(Math.max(1, p.order_multiple || 1))}개 단위` : ''}
            {p.distributor_price != null && moq > 1 ? ` · 박스 ${won(p.distributor_price * moq)}` : ''}
          </div>
        )}
        {soldOut && onRestock && (
          <button
            onClick={(e) => { e.stopPropagation(); onRestock(p) }}
            disabled={restockBusy}
            className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-xl h-9 text-[12px] font-bold transition-colors disabled:opacity-60"
            style={subbed
              ? { background: grad.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.15)', color: grad.text }
              : { background: grad.isLight ? '#17181C' : '#fff', color: grad.isLight ? '#fff' : '#17181C' }}>
            {subbed ? <><BellOff className="w-3.5 h-3.5" /> 알림 신청됨</> : <><BellRing className="w-3.5 h-3.5" /> 재입고 알림 신청</>}
          </button>
        )}
      </div>
    </div>
  )
})

// ── 가로 레일 미니 카드 ── (React.memo — 부모 재렌더 시 레일 카드 reconcile 방지)
export const MiniCard = memo(function MiniCard({ p, onOpen, onAdd, tag, onPrefetch }: { p: CatalogItem; onOpen: (p: CatalogItem) => void; onAdd: (p: CatalogItem) => void; tag?: string; onPrefetch?: (id: number) => void }) {
  const prefetch = () => onPrefetch?.(p.id)
  return (
    <div onMouseEnter={prefetch} onTouchStart={prefetch} onFocusCapture={prefetch} className="group shrink-0 w-[150px] lg:w-[166px] flex flex-col snap-start">
      <div className="relative w-full aspect-square overflow-hidden rounded-2xl" style={{ background: WT.fill }}>
        <button onClick={() => onOpen(p)} className="block w-full h-full"><ProductImg p={p} /></button>
        {tag && <div className="absolute top-2.5 left-2.5 z-10"><span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white whitespace-nowrap" style={{ background: 'rgba(23,24,28,0.82)', backdropFilter: 'blur(4px)' }}>{tag}</span></div>}
        <QuickAdd p={p} onAdd={onAdd} />
      </div>
      <button onClick={() => onOpen(p)} className="mt-2 text-left text-[13px] leading-[1.4] line-clamp-2 min-h-[36px]" style={{ color: WT.ink2 }}>{p.name}</button>
      <div className="mt-0.5"><Price p={p} size={17} /></div>
    </div>
  )
})

// ── 빠른 재주문 카드 (최근 사입 상품 → 같은 수량 재담기) ──
// React.memo — 부모 재렌더(필터/검색/무한스크롤) 시 재주문 레일 카드 reconcile 방지.
export const ReorderCard = memo(function ReorderCard({ r, onOpen, onReorder, onPrefetch }: { r: ReorderItem; onOpen: (id: number) => void; onReorder: (r: ReorderItem) => void; onPrefetch?: (id: number) => void }) {
  const [done, setDone] = useState(false)
  return (
    <div onMouseEnter={() => onPrefetch?.(r.id)} onTouchStart={() => onPrefetch?.(r.id)} className="shrink-0 w-[230px] flex flex-col rounded-2xl bg-white p-3 snap-start" style={{ border: '1px solid ' + WT.line, boxShadow: WT.shSoft }}>
      <div className="flex gap-3">
        <button onClick={() => onOpen(r.id)} className="w-12 h-12 shrink-0 rounded-xl overflow-hidden" style={{ border: '1px solid ' + WT.line, background: WT.fill }}>
          {r.image_url && <img src={cfImage(r.image_url, { width: 120, format: 'auto' }) || r.image_url} alt={r.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onOpen(r.id)} className="block text-left text-[13px] font-medium line-clamp-1" style={{ color: WT.ink }}>{r.name}</button>
          <div className="text-[12px] mt-0.5 tabular-nums" style={{ color: WT.ink3 }}>{r.last_date} 사입 · {comma(r.last_qty)}개</div>
        </div>
      </div>
      <button onClick={() => { onReorder(r); setDone(true); setTimeout(() => setDone(false), 1000) }}
        className="mt-2.5 h-9 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-1 transition-colors"
        style={done ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink }}>
        {done ? <><Check className="w-4 h-4" /> 담음</> : '같은 수량 재주문'}
      </button>
    </div>
  )
})

export function SectionHead({ title, sub, onMore }: { title: string; sub?: string; onMore?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3.5 whitespace-nowrap">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[18px] font-extrabold tracking-[-0.01em]" style={{ color: WT.ink }}>{title}</h3>
        {sub && <span className="text-[13px] font-medium" style={{ color: WT.ink3 }}>{sub}</span>}
      </div>
      {onMore && <button onClick={onMore} className="flex items-center gap-0.5 text-[13px] font-medium shrink-0" style={{ color: WT.ink3 }}>전체 <ChevronRight className="w-4 h-4" /></button>}
    </div>
  )
}

export function Rail({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3.5 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
}
