import { useState, useMemo, useRef, useEffect, memo, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO, { wholesaleStoreJsonLd, itemListJsonLd } from '@/components/SEO'
import { Loader2, Search, ClipboardList, Receipt, Factory, ChevronRight, Plus, Check, FileSpreadsheet, X, ShoppingCart, FileText, Lock, LogIn, LogOut, Upload, Download, LayoutDashboard, ArrowDownUp, PackageCheck, BellRing, BellOff } from 'lucide-react'
import { useWholesaleMe, useWholesaleHome, useWholesaleStatement, useWholesaleRecentItems } from '@/hooks/queries/useWholesale'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { getSupplierToken, clearSupplierSession } from '@/lib/supplier-api'
import { clearAuthData } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import {
  WT, won, comma, discountRate, unitMargin, marginRate, GRADE_LABEL, WHOLESALE_CATEGORIES,
} from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'
import WholesaleFooter from './wholesale/WholesaleFooter'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { cfImage } from '@/utils/cf-image'

// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통스타트 도매몰 홈 — Claude Design 시안 구현 (TDS/Toss 라이트).
//   무채색 베이스 + #FF0033 1포인트 · 브랜드 히어로 · 사입 대시보드 · 정제된 카드.
//   제조사 신원·원가(supply_price) 비노출, 등급 공급가 + 권장가(마진 산출)만.
//   라이트 고정 B2B 서피스 (대시보드 계열) — dark: variant 없음.
// ──────────────────────────────────────────────────────────────

interface CatalogItem {
  id: number
  name: string
  description?: string | null
  image_url: string | null
  category: string | null
  stock: number
  distributor_price: number | null
  retail_price?: number | null
  moq?: number
  pack_size?: number
  order_multiple?: number
  has_tiers?: boolean
  sold_count?: number
  requires_login?: boolean
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
const ProductCard = memo(function ProductCard({ p, onOpen, onAdd, subbed, onRestock, restockBusy }: { p: CatalogItem; onOpen: (p: CatalogItem) => void; onAdd: (p: CatalogItem) => void; subbed?: boolean; onRestock?: (p: CatalogItem) => void; restockBusy?: boolean }) {
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
    <div className="group flex flex-col rounded-2xl overflow-hidden" style={{ background: grad.base }}>
      <div className="relative w-full aspect-square overflow-hidden" style={{ background: grad.base }}>
        <button onClick={() => onOpen(p)} aria-label={p.name + ' 상세보기'} className="block w-full h-full">
          {p.image_url && (
            <img
              src={cfImage(p.image_url, { width: 400, format: 'auto' }) || p.image_url}
              alt={p.name}
              draggable={false}
              loading="lazy"
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
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold mt-1" style={{ background: grad.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.15)', color: grad.text }}>
            <Lock className="w-3 h-3" /> 로그인하고 공급가
          </span>
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

// ── 가로 레일 미니 카드 ──
function MiniCard({ p, onOpen, onAdd, tag }: { p: CatalogItem; onOpen: (p: CatalogItem) => void; onAdd: (p: CatalogItem) => void; tag?: string }) {
  return (
    <div className="group shrink-0 w-[150px] lg:w-[166px] flex flex-col snap-start">
      <div className="relative w-full aspect-square overflow-hidden rounded-2xl" style={{ background: WT.fill }}>
        <button onClick={() => onOpen(p)} className="block w-full h-full"><ProductImg p={p} /></button>
        {tag && <div className="absolute top-2.5 left-2.5 z-10"><span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white whitespace-nowrap" style={{ background: 'rgba(23,24,28,0.82)', backdropFilter: 'blur(4px)' }}>{tag}</span></div>}
        <QuickAdd p={p} onAdd={onAdd} />
      </div>
      <button onClick={() => onOpen(p)} className="mt-2 text-left text-[13px] leading-[1.4] line-clamp-2 min-h-[36px]" style={{ color: WT.ink2 }}>{p.name}</button>
      <div className="mt-0.5"><Price p={p} size={17} /></div>
    </div>
  )
}

// ── 빠른 재주문 카드 (최근 사입 상품 → 같은 수량 재담기) ──
interface ReorderItem { id: number; name: string; image_url: string | null; stock: number; distributor_price: number; last_qty: number; last_date: string }
function ReorderCard({ r, onOpen, onReorder }: { r: ReorderItem; onOpen: (id: number) => void; onReorder: (r: ReorderItem) => void }) {
  const [done, setDone] = useState(false)
  return (
    <div className="shrink-0 w-[230px] flex flex-col rounded-2xl bg-white p-3 snap-start" style={{ border: '1px solid ' + WT.line, boxShadow: WT.shSoft }}>
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
}

function SectionHead({ title, sub, onMore }: { title: string; sub?: string; onMore?: () => void }) {
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

function Rail({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3.5 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
}

// ── 서비스 정체성 히어로 ── (비로그인 시 '내 등급' 표현 없이 중립 카피)
function BrandHero({ loggedIn }: { loggedIn: boolean }) {
  const props = ['검증 제조사 직공급', loggedIn ? '내 등급 전용 공급가' : '등급별 도매 공급가', '익일·7일 정산']
  return (
    <div className="rounded-2xl overflow-hidden p-5 lg:p-7" style={{ background: WT.ink, color: '#fff' }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: WT.brand }} />
        <span className="text-[12px] font-bold" style={{ color: '#C2C7CE' }}>유통스타트 도매몰 · 제조사–유통사 B2B 플랫폼</span>
      </div>
      <h2 className="font-extrabold tracking-[-0.02em] leading-[1.28] text-[21px] lg:text-[28px]">
        검증된 제조사 상품을<br />
        <span style={{ color: '#FF4D66' }}>{loggedIn ? '내 등급 공급가' : '도매 공급가'}</span>로 사입하세요
      </h2>
      <p className="mt-2.5 leading-relaxed text-[13px] lg:text-[14px]" style={{ color: '#A7AEB6' }}>
        공급사는 숨기고 가격은 투명하게 — 대량 사입에 최적화된 도매 전용 가격.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {props.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.09)', color: '#E5E8EB' }}>
            <Check className="w-3.5 h-3.5" style={{ color: '#37D699' }} />{t}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 사입 현황 대시보드 ──
function Dashboard({ grade, marginPct, company, monthSpend, orderCount, onGrade }: {
  grade: string; marginPct: number; company: string; monthSpend: number; orderCount: number; onGrade: () => void
}) {
  const metrics = [
    { k: '이번달 사입액', v: won(monthSpend) },
    { k: '누적 주문', v: comma(orderCount) + '건' },
    { k: '내 등급 마진', v: '+' + marginPct + '%' },
  ]
  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: WT.shCard }}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-extrabold text-white shrink-0" style={{ background: WT.brand }}>{GRADE_LABEL[grade] || grade}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate" style={{ color: WT.ink }}>{company} · <span style={{ color: WT.brand }}>{GRADE_LABEL[grade] || grade}등급</span> 단가 적용중</div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: WT.ink3 }}>모든 단가는 회원님 등급 기준 공급가예요</div>
        </div>
        <button onClick={onGrade} className="text-[13px] font-semibold shrink-0 flex items-center gap-0.5" style={{ color: WT.ink2 }}>등급 <ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {metrics.map((m, i) => (
          <div key={m.k} className={'px-1 ' + (i ? 'pl-3' : '')} style={i ? { borderLeft: '1px solid ' + WT.line } : {}}>
            <div className="text-[12px] whitespace-nowrap" style={{ color: WT.ink3 }}>{m.k}</div>
            <div className="text-[15px] font-extrabold mt-1 tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 카테고리 칩 ── (실제 상품에 존재하는 카테고리만 — 데이터 기반)
interface CatOpt { id: string; label: string }
function CatChips({ cat, setCat, cats }: { cat: string; setCat: (c: string) => void; cats: CatOpt[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cats.map((c) => {
        const on = cat === c.id
        return (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="shrink-0 rounded-full px-4 h-9 text-[14px] font-semibold transition-colors whitespace-nowrap"
            style={on ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink2 }}>
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 데스크톱 사이드바 ──
function Sidebar({ cat, setCat, counts, cats }: { cat: string; setCat: (c: string) => void; counts: Record<string, number>; cats: CatOpt[] }) {
  return (
    <aside className="w-[176px] shrink-0 hidden lg:block">
      <div className="text-[13px] font-bold mb-2 px-1" style={{ color: WT.ink3 }}>카테고리</div>
      <ul className="space-y-0.5">
        {cats.map((c) => {
          const on = cat === c.id
          return (
            <li key={c.id}>
              <button onClick={() => setCat(c.id)}
                className="w-full flex items-center justify-between rounded-xl px-3.5 h-11 text-[15px] transition-colors"
                style={on ? { background: WT.brandSoft, color: WT.brand, fontWeight: 700 } : { color: WT.ink2 }}>
                <span>{c.label}</span><span className="text-[13px] tabular-nums" style={{ color: on ? WT.brand : WT.ink4 }}>{counts[c.id] ?? ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

// ── 등급 안내 시트 ──
const GRADE_SHEET = [
  { g: '특별가', mark: '★', desc: '임박·덤핑 전용 · 관리자 선정 회원만', margin: '개별 책정', special: true },
  { g: 'A', mark: 'A', desc: '최저 공급가 · 월 5,000만원↑', margin: '마진 +10%' },
  { g: 'B', mark: 'B', desc: '우대 공급가 · 월 1,500만원↑', margin: '마진 +15%' },
  { g: 'C', mark: 'C', desc: '기본 공급가 · 신규/일반 회원', margin: '마진 +20%' },
]
function GradeSheet({ current, onClose }: { current: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" style={{ background: 'rgba(20,22,28,0.4)' }} onClick={onClose}>
      <div className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl p-5 pb-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-extrabold" style={{ color: WT.ink }}>등급별 공급가 안내</h3>
          <button onClick={onClose} aria-label="닫기"><X className="w-5 h-5" style={{ color: WT.ink3 }} /></button>
        </div>
        <div className="space-y-2">
          {GRADE_SHEET.map((g) => {
            const cur = (GRADE_LABEL[current] || current) === g.g
            return (
              <div key={g.g} className="flex items-center gap-3 rounded-2xl p-3.5" style={cur ? { background: WT.brandSoft } : { background: WT.fill }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-extrabold shrink-0"
                  style={g.special ? { background: WT.ink, color: '#fff' } : cur ? { background: WT.brand, color: '#fff' } : { background: '#fff', color: WT.ink2 }}>{g.mark}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold" style={{ color: cur ? WT.brand : WT.ink }}>{g.g}등급{cur && ' · 현재'}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: WT.ink3 }}>{g.desc}</div>
                </div>
                <span className="text-[12px] font-bold shrink-0" style={{ color: WT.ink2 }}>{g.margin}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: WT.ink3 }}>
          더 좋은 공급가가 필요하면 관리자에게 등급 상향을 문의하세요. 월 사입액 기준으로 자동 검토됩니다.
        </p>
      </div>
    </div>
  )
}

// ── BIZ-4 (2026-06-08) 카탈로그 검색/정렬/필터 컨트롤 정의 ──────────────────────
//   서버 `/catalog` 파라미터(sort/category/in_stock/min_price/max_price)에 1:1 매핑.
//   ⚠️ 기본값('popular'/cat 'all'/재고off/가격 미설정)은 쿼리스트링에서 생략 → 기본 요청 URL 불변.
type CatalogSort = 'popular' | 'price_low' | 'price_high' | 'discount' | 'newest'
const CATALOG_SORTS: { id: CatalogSort; label: string; defaultLabel: string }[] = [
  { id: 'popular', label: 'wholesale.sort.popular', defaultLabel: '인기순' },
  { id: 'price_low', label: 'wholesale.sort.priceLow', defaultLabel: '가격 낮은순' },
  { id: 'price_high', label: 'wholesale.sort.priceHigh', defaultLabel: '가격 높은순' },
  { id: 'discount', label: 'wholesale.sort.discount', defaultLabel: '할인율순' },
  { id: 'newest', label: 'wholesale.sort.newest', defaultLabel: '신상품순' },
]
// 가격대 프리셋(원, supply_price proxy 기준 — 서버 주석 참조). null = 상한 없음.
const PRICE_BANDS: { id: string; label: string; min: number | null; max: number | null }[] = [
  { id: 'p1', label: '~1만원', min: null, max: 10000 },
  { id: 'p2', label: '1~3만원', min: 10000, max: 30000 },
  { id: 'p3', label: '3~5만원', min: 30000, max: 50000 },
  { id: 'p4', label: '5만원~', min: 50000, max: null },
]

export default function WholesaleCatalogPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState<CatalogSort>('popular')
  const [inStock, setInStock] = useState(false)
  const [priceBand, setPriceBand] = useState<string>('')   // PRICE_BANDS.id | ''
  const [gradeOpen, setGradeOpen] = useState(false)

  // 검색 디바운스(300ms) — 타이핑마다 fetch 폭주 방지. form submit 도 즉시 커밋.
  useEffect(() => {
    const id = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // 활성 가격대 → min/max (원). 미선택이면 둘 다 null.
  const band = useMemo(() => PRICE_BANDS.find(b => b.id === priceBand) ?? null, [priceBand])

  // ── 서버사이드 카탈로그 쿼리(BIZ-4) — 모든 컨트롤을 `/catalog` 파라미터에 위임.
  //   기본값(검색 없음·cat all·popular·재고off·가격 미설정)은 전부 생략 → URL = `/api/wholesale/catalog?`
  //   (= 기존 useWholesaleCatalog('') 와 byte-identical 요청). 그 외엔 새 캐시키 + 새 쿼리.
  const catalogKey = `${committedSearch}|${cat}|${sort}|${inStock ? 1 : 0}|${band?.id ?? ''}`
  const catalogQ = useQuery<CatalogItem[]>({
    queryKey: queryKeys.wholesale('catalog', catalogKey),
    queryFn: () => {
      const params = new URLSearchParams()
      if (committedSearch) params.set('search', committedSearch)
      if (cat !== 'all') params.set('category', cat)
      if (sort !== 'popular') params.set('sort', sort)
      if (inStock) params.set('in_stock', '1')
      if (band?.min != null) params.set('min_price', String(band.min))
      if (band?.max != null) params.set('max_price', String(band.max))
      const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
      const qs = params.toString()
      return api
        .get(`/api/wholesale/catalog${qs ? `?${qs}` : '?'}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        .then((r) => (r.data?.success ? ((r.data.items || []) as CatalogItem[]) : []))
        .catch(() => [])
    },
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const meQ = useWholesaleMe()
  const homeQ = useWholesaleHome()
  // 이번달 사입액 (거래내역서 summary 재사용).
  const monthFrom = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }, [])
  const monthTo = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const stmtQ = useWholesaleStatement(monthFrom, monthTo)

  const allItems = (catalogQ.data ?? []) as unknown as CatalogItem[]
  const me = (meQ.data ?? null) as { grade: string; margin_pct: number; special_active: boolean; special_discount_until: string | null } | null
  const home = homeQ.data
  const loading = catalogQ.isLoading
  // 그리드 = 서버가 이미 검색/카테고리/정렬/필터 적용한 결과 그대로(클라 재정렬/재필터 없음).
  const items = allItems

  // 🏭 2026-06-08 SEO: 카탈로그 상품 ItemList JSON-LD — 이름·이미지·utongstart URL 만(공급가 절대 제외).
  //   기본(검색/필터 없는) 카탈로그에서만 노출 → 정규 도매 인덱스 시그널. 상위 24개로 제한.
  const catalogJsonLd = useMemo(() => {
    const base: Record<string, unknown>[] = [wholesaleStoreJsonLd]
    if (items.length > 0) {
      base.push(itemListJsonLd(
        items.slice(0, 24).map((p, i) => ({
          position: i + 1,
          name: p.name,
          url: `https://utongstart.com/wholesale/product/${p.id}`,
          ...(p.image_url ? { image: p.image_url } : {}),
        })),
      ))
    }
    return base
  }, [items])

  // 카테고리 칩/카운트 = 홈 endpoint 의 전체 카테고리 분포(서버 카테고리 필터와 무관하게 안정).
  //   홈 데이터 없으면(비로그인 등) 현재 로드된 아이템에서 파생 — 기존 동작 보존.
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    if (home?.categories?.length) {
      let total = 0
      for (const c2 of home.categories) { m[c2.key] = c2.count; total += c2.count }
      m.all = total
    } else {
      m.all = allItems.length
      for (const p of allItems) if (p.category) m[p.category] = (m[p.category] || 0) + 1
    }
    return m
  }, [home?.categories, allItems])

  // 카테고리 칩/사이드바 = 실제 상품에 존재하는 카테고리만(데이터 기반). 알려진 id 는 한글 라벨,
  // 모르는 값은 원본 문자열 그대로 — 공급자가 자유 입력해도 필터가 항상 동작.
  const cats = useMemo<CatOpt[]>(() => {
    const present = new Set<string>()
    if (home?.categories?.length) { for (const c2 of home.categories) if (c2.key) present.add(c2.key) }
    else { for (const p of allItems) if (p.category) present.add(p.category) }
    const labelOf = new Map(WHOLESALE_CATEGORIES.map(c => [c.id, c.label]))
    const known = WHOLESALE_CATEGORIES
      .filter(c => c.id !== 'all' && present.has(c.id))
      .map(c => ({ id: c.id, label: c.label }))
    const knownIds = new Set(known.map(k => k.id))
    const unknown = [...present]
      .filter(id => !knownIds.has(id))
      .sort((a, b) => (catCounts[b] || 0) - (catCounts[a] || 0))
      .map(id => ({ id, label: labelOf.get(id) || id }))
    return [{ id: 'all', label: '전체' }, ...known, ...unknown]
  }, [home?.categories, allItems, catCounts])

  const recentQ = useWholesaleRecentItems()
  const recent = (recentQ.data ?? []) as ReorderItem[]
  const cart = useWholesaleCart()
  const loggedIn = !!token
  // 로그인한 유통사의 /me 실패(네트워크 오류 등) — 조용히 C등급 표시하지 않도록 에러 구분.
  const meLoadFailed = !!(loggedIn && meQ.isFetched && meQ.isError && !me)
  useEffect(() => {
    if (meLoadFailed) toast.error('등급 정보를 가져오지 못했어요 — 새로고침해 주세요', { duration: 5000 })
  }, [meLoadFailed])
  // 🏭 2026-06-04 도매몰 허브 — 제조사(공급사=브랜드사) / 셀러 본인 대시보드로 가는 진입.
  //   제조사는 supplier_token, 셀러는 seller_token(단, 순수 유통사 is_distributor 는 제외).
  const supplierToken = typeof window !== 'undefined' ? getSupplierToken() : null
  // 🏭 2026-06-04 카카오 통합: 카카오 유저로 로그인됐지만 아직 유통회원(seller_token)이 아닌 상태.
  //   사업자 정보 + 관리자 승인 필요라 1탭 X → 입점 폼(/wholesale/join)으로 유도.
  const userSession = !loggedIn && typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  // 🏭 2026-06-06 (B2 fix): 카카오로 도매 로그인 → /wholesale 에 user_id 세션만 가지고 도착.
  //   이미 유통회원(이메일 연결된 승인 셀러)이면 자동으로 seller_token 발급받아야 "로그인 안 됨"처럼
  //   보이는 UX 가 사라짐. become-distributor 를 빈 body 로 시도 — 기존 승인 회원만 토큰 발급(신규는
  //   사업자정보 400 → 무시하고 신청 배너 유지). SupplierLoginPage 의 /become 자동시도와 대칭.
  const [becoming, setBecoming] = useState(false)
  useEffect(() => {
    if (!userSession || becoming) return
    let cancelled = false
    setBecoming(true)
    api.post('/api/wholesale/become-distributor', {})
      .then((r) => {
        if (cancelled) return
        const d = r.data
        if (d?.success && d?.status === 'approved' && d?.data?.accessToken) {
          const s = d.data.seller || {}
          localStorage.setItem('seller_token', d.data.accessToken)
          localStorage.setItem('access_token', d.data.accessToken)
          localStorage.setItem('seller_refresh_token', d.data.refreshToken || '')
          localStorage.setItem('user_type', 'seller')
          localStorage.setItem('active_role', 'seller')
          localStorage.setItem('seller_id', String(s.id ?? ''))
          localStorage.setItem('seller_name', s.name || '')
          localStorage.setItem('seller_email', s.email || '')
          localStorage.setItem('seller_username', s.username || '')
          localStorage.setItem('seller_type', s.seller_type || 'influencer')
          localStorage.setItem('is_distributor', '1')
          toast.success('유통회원으로 로그인되었어요')
          window.location.assign('/wholesale')
        }
        // status==='pending' 또는 신규(400)면 그대로 신청 배너 유지 — 추가 toast 없음(조용).
      })
      .catch(() => { /* 신규 유저(사업자정보 필요) 등 — 배너로 유도, 조용히 무시 */ })
      .finally(() => { if (!cancelled) setBecoming(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSession])
  const goLogin = () => navigate('/wholesale/login')
  const logout = () => {
    // 🏭 2026-06-08: 도매몰 로그아웃 — 유통사(seller) + 제조사(supplier) 세션 모두 정리(유저/어드민 세션 보존).
    //   둘 중 어느 역할로 들어왔든 한 버튼으로 로그아웃. full reload 로 토큰/RQ 캐시 깨끗이.
    clearAuthData('seller')
    try { localStorage.removeItem('is_distributor') } catch { /* noop */ }
    try { clearSupplierSession() } catch { /* noop */ }
    toast.success('로그아웃되었어요')
    if (typeof window !== 'undefined') window.location.assign('/wholesale')
  }
  // 🏭 NOTI-1 (2026-06-08): 품절 상품 재입고 알림 구독 — 내 구독 product_id 집합 + 토글 핸들러.
  const [restockSubs, setRestockSubs] = useState<Set<number>>(new Set())
  const [restockBusyId, setRestockBusyId] = useState<number | null>(null)
  useEffect(() => {
    if (!token) { setRestockSubs(new Set()); return }
    let cancelled = false
    api.get('/api/wholesale/restock/subscriptions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (cancelled) return
        const subs = (r.data?.subscriptions ?? []) as { product_id: number }[]
        setRestockSubs(new Set(subs.map((s) => Number(s.product_id))))
      })
      .catch(() => { /* 조용히 무시 */ })
    return () => { cancelled = true }
  }, [token])

  async function toggleRestock(p: CatalogItem) {
    if (restockBusyId != null) return
    if (!loggedIn) { toast.info('로그인하면 재입고 알림을 받을 수 있어요'); goLogin(); return }
    const subbed = restockSubs.has(p.id)
    setRestockBusyId(p.id)
    try {
      if (subbed) {
        await api.delete(`/api/wholesale/restock/subscribe/${p.id}`, { headers: { Authorization: `Bearer ${token}` } })
        setRestockSubs((prev) => { const n = new Set(prev); n.delete(p.id); return n })
        toast.success('재입고 알림을 해제했어요')
      } else {
        const r = await api.post('/api/wholesale/restock/subscribe', { product_id: p.id }, { headers: { Authorization: `Bearer ${token}` } })
        if (r.data?.success) { setRestockSubs((prev) => new Set(prev).add(p.id)); toast.success('재입고되면 알림으로 알려드릴게요') }
        else toast.error(r.data?.error || '재입고 알림 신청에 실패했어요')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '재입고 알림 처리 중 오류가 발생했어요')
    } finally { setRestockBusyId(null) }
  }

  const openDetail = (p: CatalogItem) => navigate(`/wholesale/product/${p.id}`)
  const addToCart = (p: CatalogItem) => {
    if (!loggedIn || p.distributor_price == null) {
      toast.info('로그인하면 등급 공급가로 담을 수 있어요')
      goLogin()
      return
    }
    const moq = Math.max(1, p.moq || 1)
    // 🏭 BIZ-8: 초기 담기 수량 = MOQ 를 만족하는 최소 order_multiple 배수(서버 검증과 일치).
    const om = Math.max(1, p.order_multiple || 1)
    const initQty = om > 1 ? Math.ceil(moq / om) * om : moq
    cart.add({ id: p.id, qty: initQty, name: p.name, image_url: p.image_url, price: p.distributor_price, moq })
    toast.success(initQty > 1 ? `장바구니에 ${comma(initQty)}개 담았어요` : '장바구니에 담았어요')
  }
  const reorder = (r: ReorderItem) => {
    const moq = Math.max(1, (r as ReorderItem & { moq?: number }).moq || 1)
    cart.add({ id: r.id, qty: Math.max(moq, r.last_qty), name: r.name, image_url: r.image_url, price: r.distributor_price, moq })
    toast.success(`장바구니에 ${comma(Math.max(moq, r.last_qty))}개 담았어요`)
  }

  function exportCatalog() {
    const t = localStorage.getItem('seller_token') || getSupplierToken()
    fetch('/api/wholesale/catalog-export', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('단가표 다운로드에 실패했어요'))
  }

  // 🏭 BIZ-8 (2026-06-08) 단가표 CSV — 내 등급가 + MOQ/박스단위/재고 (엑셀로 바로 열림).
  //   서버 /catalog/export?format=csv 가 내 등급 단가만 계산(타 등급가 누출 없음).
  function exportPriceListCsv() {
    const t = localStorage.getItem('seller_token')
    fetch('/api/wholesale/catalog/export?format=csv', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wholesale-pricelist-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('단가표 다운로드에 실패했어요'))
  }

  // ── 대량 주문(엑셀) — 양식 다운로드 + 작성본 업로드 → 주문 생성 → 체크아웃 ──
  const bulkInputRef = useRef<HTMLInputElement | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  function downloadOrderForm() {
    const t = localStorage.getItem('seller_token')
    fetch('/api/wholesale/order-template', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wholesale-order-form-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('주문 양식 다운로드에 실패했어요'))
  }
  // 따옴표 포함 CSV 한 줄 파싱.
  function parseCsvLine(line: string): string[] {
    const out: string[] = []; let cur = ''; let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
      else if (ch === '"') q = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur); return out
  }
  async function onBulkFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '' // 같은 파일 재선택 허용
    if (!file || bulkBusy) return
    setBulkBusy(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { toast.error('내용이 없는 파일이에요'); return }
      const header = parseCsvLine(lines[0]).map(h => h.trim())
      const pidIdx = header.findIndex(h => h.toLowerCase() === 'product_id')
      let qtyIdx = header.findIndex(h => h.replace(/\s/g, '') === '주문수량')
      if (pidIdx < 0) { toast.error('product_id 열을 찾을 수 없어요 (양식을 다시 받아주세요)'); return }
      if (qtyIdx < 0) qtyIdx = header.length - 1 // 주문수량 헤더 없으면 마지막 열
      const items: { product_id: number; qty: number }[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        const pid = Number(String(cols[pidIdx] ?? '').replace(/[^0-9]/g, ''))
        const qty = Math.floor(Number(String(cols[qtyIdx] ?? '').replace(/[^0-9.]/g, '')))
        if (Number.isFinite(pid) && pid > 0 && Number.isFinite(qty) && qty > 0) items.push({ product_id: pid, qty })
      }
      if (!items.length) { toast.error('주문수량이 입력된 행이 없어요'); return }
      const r = await api.post('/api/wholesale/orders', { items }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(`${comma(items.length)}개 품목 주문서 생성 — 결제로 이동해요`)
        navigate(`/wholesale/checkout?order=${r.data.order_id}`, { state: { orderId: r.data.toss_order_id, amount: r.data.amount, orderName: r.data.order_name } })
      } else {
        toast.error(r.data?.error || '주문서 처리에 실패했어요')
      }
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || '주문서 업로드 중 오류가 발생했어요')
    } finally { setBulkBusy(false) }
  }

  const monthSpend = stmtQ.data?.summary?.total_paid ?? 0
  const orderCount = stmtQ.data?.summary?.count ?? 0
  const grade = me?.grade || home?.grade || 'C'

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO
        domain="wholesale"
        title="유통스타트 도매몰 — 제조사 직거래 도매가 사입 B2B 도매사이트"
        description="검증된 제조사 상품을 도매가로 사입하는 B2B 도매사이트. 식품·생활·뷰티 등 카테고리별 도매 상품, 무재고 위탁판매·대량 사입·OEM/ODM까지 유통스타트에서."
        url="/wholesale"
        jsonLd={catalogJsonLd}
      />

      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-extrabold text-[13px]" style={{ background: WT.brand }}>유</span>
            <span className="text-[15px] font-extrabold" style={{ color: WT.ink }}>유통스타트</span>
            <span className="text-[13px]" style={{ color: WT.ink4 }}>도매몰</span>
          </button>
          <div className="flex-1" />
          {loggedIn ? (
            <>
              <nav className="hidden sm:flex items-center gap-4 text-[13px] font-medium" style={{ color: WT.ink2 }}>
                <button onClick={() => navigate('/wholesale/dashboard')} className="inline-flex items-center gap-1"><LayoutDashboard className="w-4 h-4" /> 대시보드</button>
                <button onClick={() => navigate('/wholesale/orders')} className="inline-flex items-center gap-1"><ClipboardList className="w-4 h-4" /> 주문내역</button>
                <button onClick={() => navigate('/wholesale/statement')} className="inline-flex items-center gap-1"><Receipt className="w-4 h-4" /> 거래내역</button>
                <button onClick={() => navigate('/wholesale/documents')} className="inline-flex items-center gap-1"><FileText className="w-4 h-4" /> 자료</button>
                <button onClick={() => navigate('/wholesale/oem')} className="inline-flex items-center gap-1"><Factory className="w-4 h-4" /> OEM/ODM</button>
              </nav>
              <button onClick={() => navigate('/wholesale/cart')} aria-label="장바구니" className="relative shrink-0 p-1.5" style={{ color: WT.ink2 }}>
                <ShoppingCart className="w-5 h-5" />
                {cart.count > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: WT.brand }}>{cart.count}</span>}
              </button>
              <button onClick={meLoadFailed ? () => meQ.refetch() : () => setGradeOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold shrink-0"
                style={{ background: meLoadFailed ? '#FFF0F0' : WT.brandSoft, color: meLoadFailed ? '#CC0000' : WT.brand }}
                title={meLoadFailed ? '등급 정보 로드 실패 — 클릭해 재시도' : undefined}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px]"
                  style={{ background: meLoadFailed ? '#CC0000' : WT.brand }}>
                  {meLoadFailed ? '!' : (GRADE_LABEL[grade] || grade)}
                </span>
                {meLoadFailed ? '등급 로드 실패 · 재시도' : `${GRADE_LABEL[grade] || grade}등급${me ? ` · 마진 ${me.margin_pct}%` : ''}`}
              </button>
              {supplierToken && (
                <button onClick={() => navigate('/supplier')} className="hidden md:inline-flex items-center gap-1 text-[13px] font-medium shrink-0" style={{ color: WT.ink2 }} title="제조사 대시보드로 이동">
                  <Factory className="w-4 h-4" /> 제조사 대시보드
                </button>
              )}
              <button onClick={logout} aria-label="로그아웃" title="로그아웃" className="inline-flex items-center gap-1 text-[13px] font-medium shrink-0" style={{ color: WT.ink3 }}>
                <LogOut className="w-4 h-4" /><span className="hidden sm:inline">로그아웃</span>
              </button>
            </>
          ) : supplierToken ? (
            // 제조사(공급사=브랜드사)가 도매몰 둘러보는 중 — 본인 제조사 대시보드 진입 + 로그아웃.
            <>
              <button onClick={() => navigate('/supplier')} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold shrink-0" style={{ background: WT.ink, color: '#fff' }} title="제조사 대시보드로 이동">
                <Factory className="w-4 h-4" /> 제조사 대시보드
              </button>
              <button onClick={logout} aria-label="로그아웃" title="로그아웃" className="inline-flex items-center gap-1 text-[13px] font-medium shrink-0" style={{ color: WT.ink3 }}>
                <LogOut className="w-4 h-4" /><span className="hidden sm:inline">로그아웃</span>
              </button>
            </>
          ) : (
            // 비로그인 — 제조(브랜드)회원 / 유통회원 로그인 + 가입 (도매몰 한 곳에서 양쪽 역할 진입).
            <>
              <button onClick={() => navigate('/supplier/login')} className="inline-flex items-center gap-1 text-[13px] font-medium shrink-0" style={{ color: WT.ink2 }} title="제조(브랜드)회원(공급사) 로그인">
                <Factory className="w-4 h-4" /> 제조(브랜드)회원<span className="hidden sm:inline"> 로그인</span>
              </button>
              <button onClick={goLogin} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold shrink-0" style={{ background: WT.fill, color: WT.ink }} title="유통회원(바이어) 로그인">
                <LogIn className="w-4 h-4" /> 유통회원<span className="hidden sm:inline"> 로그인</span>
              </button>
              <button onClick={() => navigate('/wholesale/join')} className="inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-bold text-white shrink-0" style={{ background: WT.brand }}>
                가입
              </button>
            </>
          )}
        </div>
        {/* 검색 */}
        <div className="ur-content-wide px-5 lg:px-8 pb-3">
          <form onSubmit={e => { e.preventDefault(); setCommittedSearch(search.trim()) }} className="relative max-w-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: WT.ink4 }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('wholesale.searchPlaceholder', { defaultValue: '상품명·설명으로 검색' })}
              className="w-full pl-10 pr-10 h-11 rounded-xl text-[14px] outline-none"
              style={{ background: WT.fill, color: WT.ink }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCommittedSearch('') }} aria-label={t('common.clear', { defaultValue: '지우기' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full" style={{ color: WT.ink4 }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
        {/* 🏭 2026-06-04 (사용자 신고 — 모바일 기능버튼 누락): 로그인 유통회원의 핵심 메뉴가 헤더에서
            hidden sm:flex 로 모바일에 안 보이던 문제 → 모바일 전용 가로스크롤 기능 줄 추가(sm:hidden). */}
        {loggedIn && (
          <div className="sm:hidden ur-content-wide px-5 pb-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => navigate('/wholesale/dashboard')} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: WT.brand }}><LayoutDashboard className="w-3.5 h-3.5" /> 대시보드</button>
            <button onClick={() => navigate('/wholesale/orders')} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}><ClipboardList className="w-3.5 h-3.5" /> 주문내역</button>
            <button onClick={() => navigate('/wholesale/statement')} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}><Receipt className="w-3.5 h-3.5" /> 거래내역</button>
            <button onClick={() => navigate('/wholesale/documents')} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}><FileText className="w-3.5 h-3.5" /> 자료</button>
            <button onClick={() => navigate('/wholesale/oem')} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}><Factory className="w-3.5 h-3.5" /> OEM/ODM</button>
            {supplierToken && (
              <button onClick={() => navigate('/supplier')} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: WT.ink, color: '#fff' }}><Factory className="w-3.5 h-3.5" /> 제조사 대시보드</button>
            )}
          </div>
        )}
      </header>

      <main className="ur-content-wide px-5 lg:px-8">
        {/* 히어로 + 대시보드 + OEM */}
        <div className="pt-4 pb-5 space-y-3">
          <BrandHero loggedIn={loggedIn} />
          {loggedIn ? (
            <>
              <Dashboard grade={grade} marginPct={me?.margin_pct ?? 0} company="회원님" monthSpend={monthSpend} orderCount={orderCount} onGrade={() => setGradeOpen(true)} />
              {me?.special_active && me.special_discount_until && (
                <div className="px-4 py-3 rounded-2xl text-[13px] font-semibold" style={{ background: WT.brandSoft, color: WT.brand }}>
                  특별가 적용 중 — {new Date(me.special_discount_until).toLocaleDateString('ko-KR')}까지 최저 공급가로 구매할 수 있어요
                </div>
              )}
              <button onClick={() => navigate('/wholesale/oem')} className="w-full flex items-center gap-3.5 rounded-2xl p-4 text-left" style={{ border: '1px solid ' + WT.line, background: '#fff' }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: WT.fill }}><Factory className="w-5 h-5" style={{ color: WT.ink2 }} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold truncate" style={{ color: WT.ink }}>자사 브랜드 제품이 필요하세요?</div>
                  <div className="text-[12px] mt-0.5 truncate" style={{ color: WT.ink3 }}>OEM/ODM 제조사 연결·컨설팅 신청</div>
                </div>
                <ChevronRight className="w-5 h-5 shrink-0" style={{ color: WT.ink4 }} />
              </button>
            </>
          ) : userSession ? (
            // 카카오 로그인됨(일반 유저)이지만 아직 유통회원 아님 — 1탭 전환.
            <div className="flex items-center gap-3.5 rounded-2xl p-4" style={{ background: WT.ink }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}><Lock className="w-5 h-5 text-white" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-white">카카오 계정으로 유통회원 신청하기</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>사업자 정보만 입력하면 관리자 승인 후 등급 공급가로 사입 — 카카오 계정 그대로</div>
              </div>
              <button onClick={() => navigate('/wholesale/join')} className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold" style={{ background: WT.brand, color: '#fff' }}>
                유통회원 신청
              </button>
            </div>
          ) : (
            // 비로그인: 가입 유도 배너 (도매가는 가입/로그인 후 노출)
            <div className="flex items-center gap-3.5 rounded-2xl p-4" style={{ background: WT.ink }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}><Lock className="w-5 h-5 text-white" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-white">가입하면 등급 공급가가 보여요</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>유통사 가입 즉시 C등급 공급가로 사입 시작 · 실적 쌓이면 A·B 상향</div>
              </div>
              <button onClick={() => navigate('/wholesale/join')} className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold" style={{ background: WT.brand, color: '#fff' }}>가입하기</button>
            </div>
          )}
        </div>

        {/* 빠른 재주문 (최근 사입) */}
        {recent.length > 0 && (
          <section className="py-6">
            <SectionHead title="빠른 재주문" sub="최근 사입한 상품" />
            <Rail>{recent.map((r) => <ReorderCard key={r.id} r={r} onOpen={(id) => navigate(`/wholesale/product/${id}`)} onReorder={reorder} />)}</Rail>
          </section>
        )}

        {/* 전용 공급 (관리자 제안) */}
        {home && home.proposals.length > 0 && (
          <section className="py-6">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[18px] font-extrabold tracking-[-0.01em]" style={{ color: WT.ink }}>회원님 전용 공급</h3>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: WT.ink, color: '#fff' }}>선정 회원 전용</span>
            </div>
            <p className="text-[13px] mb-3.5" style={{ color: WT.ink3 }}>유통스타트가 회원님께만 공개하는 상품이에요</p>
            <Rail>{(home.proposals as unknown as CatalogItem[]).map((p) => <MiniCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} tag="전용" />)}</Rail>
          </section>
        )}

        {/* 베스트 */}
        {home && home.best.length > 0 && (
          <section className="py-6">
            <SectionHead title="베스트셀러" sub="많이 사입한 상품" />
            <Rail>{(home.best as unknown as CatalogItem[]).map((p) => <MiniCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} />)}</Rail>
          </section>
        )}

        {/* 신규 입고 */}
        {home && home.new.length > 0 && (
          <section className="py-6">
            <SectionHead title="신규 입고" sub="이번 주" />
            <Rail>{(home.new as unknown as CatalogItem[]).map((p) => <MiniCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} />)}</Rail>
          </section>
        )}

        {/* 전체 상품 */}
        <section className="pt-6 pb-10">
          <SectionHead title={cat === 'all' ? '전체 상품' : (cats.find(c => c.id === cat)?.label || '상품')} sub={comma(items.length) + '개'} />
          <div className="lg:hidden mb-3"><CatChips cat={cat} setCat={setCat} cats={cats} /></div>
          {/* ── BIZ-4 정렬/필터 컨트롤바 (서버사이드 /catalog 파라미터에 위임) ── */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* 정렬 드롭다운 */}
            <div className="relative shrink-0">
              <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: WT.ink3 }} />
              <select
                value={sort} onChange={e => setSort(e.target.value as CatalogSort)}
                aria-label={t('wholesale.sortLabel', { defaultValue: '정렬' })}
                className="appearance-none h-9 pl-8 pr-7 rounded-full text-[13px] font-bold outline-none cursor-pointer"
                style={{ background: WT.fill, color: WT.ink }}>
                {/* 🏭 가격/할인율 정렬은 공급가가 보이는 로그인 유통사에게만 (비로그인엔 무의미) */}
                {CATALOG_SORTS.filter(s => loggedIn || !['price_low', 'price_high', 'discount'].includes(s.id)).map(s => (
                  <option key={s.id} value={s.id}>{t(s.label, { defaultValue: s.defaultLabel })}</option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90" style={{ color: WT.ink3 }} />
            </div>
            {/* 재고있음 토글 */}
            <button onClick={() => setInStock(v => !v)} aria-pressed={inStock}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 h-9 text-[13px] font-bold whitespace-nowrap transition-colors"
              style={inStock ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink3 }}>
              <PackageCheck className="w-3.5 h-3.5" />{t('wholesale.inStock', { defaultValue: '재고있음' })}
            </button>
            {/* 가격대 칩 — 공급가는 로그인 시에만 보이므로 비로그인엔 숨김 */}
            {loggedIn && (
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PRICE_BANDS.map(b => {
                const on = priceBand === b.id
                return (
                  <button key={b.id} onClick={() => setPriceBand(on ? '' : b.id)} aria-pressed={on}
                    className="shrink-0 rounded-full px-3 h-9 text-[13px] font-bold whitespace-nowrap transition-colors"
                    style={on ? { background: WT.brand, color: '#fff' } : { background: WT.fill, color: WT.ink3 }}>
                    {b.label}
                  </button>
                )
              })}
            </div>
            )}
            {/* 필터 초기화 (활성 필터 있을 때만) */}
            {(inStock || priceBand || cat !== 'all' || sort !== 'popular' || committedSearch) && (
              <button onClick={() => { setInStock(false); setPriceBand(''); setCat('all'); setSort('popular'); setSearch(''); setCommittedSearch('') }}
                className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: WT.ink3 }}>
                <X className="w-3.5 h-3.5" />{t('wholesale.resetFilters', { defaultValue: '필터 초기화' })}
              </button>
            )}
          </div>
          {loggedIn && (
            <div className="mb-4 rounded-2xl p-4" style={{ border: '1px solid ' + WT.line, background: WT.fill2 }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-bold" style={{ color: WT.ink }}>대량 주문 (엑셀)</span>
                <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: WT.brandSoft, color: WT.brand }}>주문 많을 때</span>
              </div>
              <p className="text-[12px] mb-3" style={{ color: WT.ink3 }}>주문 양식(내 카탈로그·등급가 포함)을 받아 <b>주문수량</b>만 채워 업로드하면 한 번에 주문서가 생성돼요.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={downloadOrderForm} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold" style={{ background: '#fff', color: WT.ink, border: '1px solid ' + WT.line }}>
                  <Download className="w-4 h-4" /> 주문 양식 다운로드
                </button>
                <button onClick={() => bulkInputRef.current?.click()} disabled={bulkBusy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: WT.ink }}>
                  {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 작성본 업로드 → 주문
                </button>
                <input ref={bulkInputRef} type="file" accept=".csv,text/csv" onChange={onBulkFile} className="hidden" />
              </div>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button onClick={exportCatalog} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-10 text-[12px] font-bold" style={{ background: '#fff', color: WT.ink3, border: '1px solid ' + WT.line }}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 단가표 (.xlsx)
                </button>
                <button onClick={exportPriceListCsv} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-10 text-[12px] font-bold" style={{ background: '#fff', color: WT.ink3, border: '1px solid ' + WT.line }}>
                  <Download className="w-3.5 h-3.5" /> 단가표 다운로드 (CSV)
                </button>
              </div>
            </div>
          )}

          <div className="lg:flex lg:gap-7">
            <Sidebar cat={cat} setCat={setCat} counts={catCounts} cats={cats} />
            <div className="flex-1">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: WT.ink4 }} /></div>
              ) : items.length === 0 ? (
                <p className="text-center py-20 text-[14px]" style={{ color: WT.ink4 }}>해당 조건의 도매 상품이 없어요.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-7">
                  {items.map((p) => <ProductCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} subbed={restockSubs.has(p.id)} onRestock={toggleRestock} restockBusy={restockBusyId === p.id} />)}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <WholesaleFooter />

      {gradeOpen && <GradeSheet current={grade} onClose={() => setGradeOpen(false)} />}
    </div>
  )
}
