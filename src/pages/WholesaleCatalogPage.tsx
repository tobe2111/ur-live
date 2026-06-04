import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { Loader2, Search, ClipboardList, Receipt, Factory, ChevronRight, Plus, Check, FileSpreadsheet, X, ShoppingCart, FileText, Lock, LogIn, LogOut } from 'lucide-react'
import { useWholesaleCatalog, useWholesaleMe, useWholesaleHome, useWholesaleStatement, useWholesaleRecentItems } from '@/hooks/queries/useWholesale'
import { getSupplierToken } from '@/lib/supplier-api'
import { clearAuthData } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import {
  WT, won, comma, discountRate, unitMargin, marginRate, GRADE_LABEL, WHOLESALE_CATEGORIES,
} from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'

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
        ? <img src={p.image_url} alt={p.name} draggable={false} loading="lazy" className={'block w-full h-full object-cover ' + className} />
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
function ProductCard({ p, onOpen, onAdd }: { p: CatalogItem; onOpen: (p: CatalogItem) => void; onAdd: (p: CatalogItem) => void }) {
  const mr = p.retail_price && p.distributor_price != null ? marginRate(p.distributor_price, p.retail_price) : 0
  const um = p.retail_price && p.distributor_price != null ? unitMargin(p.distributor_price, p.retail_price) : 0
  const moq = Math.max(1, p.moq || 1)
  return (
    <div className="group flex flex-col">
      <div className="relative w-full aspect-square overflow-hidden rounded-2xl" style={{ background: WT.fill }}>
        <button onClick={() => onOpen(p)} aria-label={p.name + ' 상세보기'} className="block w-full h-full"><ProductImg p={p} /></button>
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1">
          {p.has_tiers && <span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white" style={{ background: WT.brand }}>수량할인</span>}
          {p.stock > 0 && p.stock < 200 && <span className="px-2 py-[3px] text-[11px] font-bold leading-none rounded-full text-white" style={{ background: 'rgba(23,24,28,0.82)', backdropFilter: 'blur(4px)' }}>마감임박</span>}
        </div>
        <QuickAdd p={p} onAdd={onAdd} />
      </div>
      <button onClick={() => onOpen(p)} className="mt-2.5 text-left text-[14px] leading-[1.4] line-clamp-2 min-h-[39px]" style={{ color: WT.ink2 }}>{p.name}</button>
      <div className="mt-1"><Price p={p} /></div>
      {p.retail_price && um > 0 ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] tabular-nums whitespace-nowrap">
          <span className="font-bold" style={{ color: WT.pos }}>마진 +{won(um)}</span>
          <span style={{ color: WT.ink4 }}>({mr}%)</span>
          <span style={{ color: WT.line }}>·</span>
          <span style={{ color: WT.ink4 }}>재고 {comma(p.stock)}</span>
        </div>
      ) : (
        <div className="mt-1 text-[12px] tabular-nums" style={{ color: WT.ink4 }}>재고 {comma(p.stock)}</div>
      )}
      {moq > 1 && (
        <div className="mt-1 text-[12px] tabular-nums" style={{ color: WT.ink4 }}>
          최소 {comma(moq)}개{p.distributor_price != null ? ` · 박스 ${won(p.distributor_price * moq)}` : ''}
        </div>
      )}
    </div>
  )
}

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
          {r.image_url && <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />}
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

export default function WholesaleCatalogPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState<'rec' | 'low' | 'margin'>('rec')
  const [gradeOpen, setGradeOpen] = useState(false)

  const catalogQ = useWholesaleCatalog(committedSearch)
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

  // 클라 필터/정렬 (카테고리·정렬) — 그리드.
  const items = useMemo(() => {
    let list = allItems.filter((p) => cat === 'all' || p.category === cat)
    list = [...list].sort((a, b) =>
      sort === 'low' ? (a.distributor_price ?? 0) - (b.distributor_price ?? 0) :
      sort === 'margin' ? marginRate(b.distributor_price ?? 0, b.retail_price || 0) - marginRate(a.distributor_price ?? 0, a.retail_price || 0) :
      (b.sold_count || 0) - (a.sold_count || 0))
    return list
  }, [allItems, cat, sort])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = { all: allItems.length }
    for (const p of allItems) if (p.category) m[p.category] = (m[p.category] || 0) + 1
    return m
  }, [allItems])

  // 카테고리 칩/사이드바 = 실제 상품에 존재하는 카테고리만(데이터 기반). 알려진 id 는 한글 라벨,
  // 모르는 값은 원본 문자열 그대로 — 공급자가 자유 입력해도 필터가 항상 동작.
  const cats = useMemo<CatOpt[]>(() => {
    const present = new Set<string>()
    for (const p of allItems) if (p.category) present.add(p.category)
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
  }, [allItems, catCounts])

  const recentQ = useWholesaleRecentItems()
  const recent = (recentQ.data ?? []) as ReorderItem[]
  const cart = useWholesaleCart()
  const loggedIn = !!token
  const goLogin = () => navigate('/seller/login?returnUrl=/wholesale')
  const logout = () => {
    // 셀러 세션만 정리(유저/어드민 세션 보존) 후 도매몰에 머무름 — full reload 로 토큰/RQ 캐시 깨끗이.
    clearAuthData('seller')
    toast.success('로그아웃되었어요')
    if (typeof window !== 'undefined') window.location.assign('/wholesale')
  }
  const openDetail = (p: CatalogItem) => navigate(`/wholesale/product/${p.id}`)
  const addToCart = (p: CatalogItem) => {
    if (!loggedIn || p.distributor_price == null) {
      toast.info('로그인하면 등급 공급가로 담을 수 있어요')
      goLogin()
      return
    }
    const moq = Math.max(1, p.moq || 1)
    cart.add({ id: p.id, qty: moq, name: p.name, image_url: p.image_url, price: p.distributor_price, moq })
    toast.success(moq > 1 ? `장바구니에 ${comma(moq)}개 담았어요` : '장바구니에 담았어요')
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

  const SORTS: [typeof sort, string][] = [['rec', '인기순'], ['low', '낮은 공급가'], ['margin', '높은 마진']]
  const monthSpend = stmtQ.data?.summary?.total_paid ?? 0
  const orderCount = stmtQ.data?.summary?.count ?? 0
  const grade = me?.grade || home?.grade || 'C'

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="유통스타트 도매몰" description="검증 제조사 상품을 내 등급 공급가로 사입하는 B2B 도매 플랫폼" url="/wholesale" />

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
                <button onClick={() => navigate('/wholesale/orders')} className="inline-flex items-center gap-1"><ClipboardList className="w-4 h-4" /> 주문내역</button>
                <button onClick={() => navigate('/wholesale/statement')} className="inline-flex items-center gap-1"><Receipt className="w-4 h-4" /> 거래내역</button>
                <button onClick={() => navigate('/wholesale/documents')} className="inline-flex items-center gap-1"><FileText className="w-4 h-4" /> 자료</button>
                <button onClick={() => navigate('/wholesale/oem')} className="inline-flex items-center gap-1"><Factory className="w-4 h-4" /> OEM/ODM</button>
              </nav>
              <button onClick={() => navigate('/wholesale/cart')} aria-label="장바구니" className="relative shrink-0 p-1.5" style={{ color: WT.ink2 }}>
                <ShoppingCart className="w-5 h-5" />
                {cart.count > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: WT.brand }}>{cart.count}</span>}
              </button>
              <button onClick={() => setGradeOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold shrink-0" style={{ background: WT.brandSoft, color: WT.brand }}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px]" style={{ background: WT.brand }}>{GRADE_LABEL[grade] || grade}</span>
                {GRADE_LABEL[grade] || grade}등급{me ? ` · 마진 ${me.margin_pct}%` : ''}
              </button>
              <button onClick={logout} aria-label="로그아웃" title="로그아웃" className="inline-flex items-center gap-1 text-[13px] font-medium shrink-0" style={{ color: WT.ink3 }}>
                <LogOut className="w-4 h-4" /><span className="hidden sm:inline">로그아웃</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/wholesale/intro')} className="hidden sm:inline text-[13px] font-medium" style={{ color: WT.ink2 }}>서비스 소개</button>
              <button onClick={goLogin} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold shrink-0" style={{ background: WT.fill, color: WT.ink }}>
                <LogIn className="w-4 h-4" /> 로그인
              </button>
              <button onClick={() => navigate('/wholesale/join')} className="inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-bold text-white shrink-0" style={{ background: WT.brand }}>
                가입
              </button>
            </>
          )}
        </div>
        {/* 검색 */}
        <div className="ur-content-wide px-5 lg:px-8 pb-3">
          <form onSubmit={e => { e.preventDefault(); setCommittedSearch(search) }} className="relative max-w-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: WT.ink4 }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="상품명으로 검색"
              className="w-full pl-10 pr-3 h-11 rounded-xl text-[14px] outline-none"
              style={{ background: WT.fill, color: WT.ink }}
            />
          </form>
        </div>
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
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-1.5">
              {SORTS.map(([k, l]) => (
                <button key={k} onClick={() => setSort(k)} className="rounded-full px-3 h-8 text-[12px] font-bold whitespace-nowrap"
                  style={sort === k ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink3 }}>{l}</button>
              ))}
            </div>
          </div>
          {loggedIn && (
            <button onClick={exportCatalog} className="mb-4 w-full flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
              <FileSpreadsheet className="w-4 h-4" /> 단가표 엑셀 다운로드 <span style={{ color: WT.ink4 }}>(내 등급가)</span>
            </button>
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
                  {items.map((p) => <ProductCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} />)}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {gradeOpen && <GradeSheet current={grade} onClose={() => setGradeOpen(false)} />}
    </div>
  )
}
