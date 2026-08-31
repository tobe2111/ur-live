/**
 * 📣 소개 파트너 찾기 — 유어애즈 DB 탐색 + 협업 제안 (2026-08-20 대표 확정)
 *   설계 SSOT: docs/design/seller-dashboard-v2.md · 참고 UI: 크리에이터 탐색(리뷰노트류) 리스트
 *
 * 🔒 연락처는 이 화면 어디에도 없다 — 발송은 유어딜이 대행한다(서버가 아예 안 내려줌).
 */
import { useEffect, useState, useCallback } from 'react'
import SellerLayout from '@/components/SellerLayout'
import SentOutreachList from './seller-influencers/SentOutreachList'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { Loader2, Send, Users, ChevronDown } from 'lucide-react'

interface Lead {
  id: number; platform: string; handle: string; name: string | null; category: string | null
  region: string | null; thumbnail: string | null
  subscriber_count: number; video_count: number | null
  recent_avg_views: number | null; recent_avg_comments: number | null
}
const FOLLOWER_BANDS = [
  { label: '전체', min: 0, max: 0 },
  { label: '1천~1만', min: 1000, max: 10000 },
  { label: '1만~10만', min: 10000, max: 100000 },
  { label: '10만+', min: 100000, max: 0 },
]
const CHANNELS = [
  { key: 'instagram', label: '인스타그램' }, { key: 'youtube', label: '유튜브' },
  { key: 'tiktok', label: '틱톡' }, { key: 'blog', label: '블로그' }, { key: 'naver_clip', label: '네이버 클립' },
]

export default function SellerInfluencersPage() {
  const [outreachRefresh, setOutreachRefresh] = useState(0)
  const [rows, setRows] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  // 🔒 유어애즈 DB 열람 차단 상태 — 실패 토스트로 뭉개면 사장님이 무엇을 해야 하는지 모른다.
  const [blocked, setBlocked] = useState<{ code: string; error: string } | null>(null)
  const [contactFee, setContactFee] = useState(0)
  const [cats, setCats] = useState<{ category: string; n: number }[]>([])
  const [cat, setCat] = useState('')
  const [band, setBand] = useState(0)
  const [sort, setSort] = useState('followers')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [proposing, setProposing] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const b = FOLLOWER_BANDS[band]
      const r = await api.get('/api/seller/influencers/list', {
        params: { page: p, limit: 20, sort, ...(cat ? { category: cat } : {}),
          ...(b.min ? { min_followers: b.min } : {}), ...(b.max ? { max_followers: b.max } : {}) },
      })
      if (r.data?.success) {
        setRows(r.data.data || []); setTotal(r.data.total || 0); setPage(p)
        setConfigured(r.data.configured !== false); setContactFee(r.data.contact_fee_krw || 0)
        setBlocked(null)
      }
    } catch (e) {
      // 403(대행사 계정) · 429(일일 열람 상한) 는 "오류"가 아니라 **상태**다 — 그대로 보여 준다.
      const res = (e as { response?: { status?: number; data?: { code?: string; error?: string; blocked?: boolean } } })?.response
      if (res?.data?.blocked) setBlocked({ code: res.data.code || '', error: res.data.error || '' })
      setRows([]); setTotal(0)
    } finally { setLoading(false) }
  }, [cat, band, sort])
  useEffect(() => { load(1) }, [load])
  useEffect(() => { api.get('/api/seller/influencers/categories').then(r => setCats(r.data?.data || [])).catch(() => {}) }, [])

  const toggle = (id: number) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <SellerLayout title="소개 파트너 찾기">
      <SEO title="소개 파트너 찾기 - 유어딜 셀러" description="협업 인플루언서 탐색·제안" noindex />
      <div className="mx-auto max-w-5xl space-y-3 p-3 sm:p-4">
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
          <p className="text-[11px] font-bold text-brand">인플루언서 협업</p>
          <p className="text-sm font-extrabold text-gray-900">내 이용권을 팔아 줄 크리에이터를 찾아 제안해 보세요</p>
          <p className="text-[11px] text-gray-600 mt-0.5">제안을 접수하면 유어딜이 검토 후 인플루언서에게 직접 전달해 드려요{contactFee > 0 ? ` · 발송 1명당 ${formatNumber(contactFee)}원` : ''}</p>
        </div>

        {/* 📣 보낸 제안 현황 (없으면 미렌더) */}
        <SentOutreachList refreshKey={outreachRefresh} />

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white">
            <option value="">전체 카테고리</option>
            {cats.map(c => <option key={c.category} value={c.category}>{c.category} ({formatNumber(c.n)})</option>)}
          </select>
          <select value={band} onChange={e => setBand(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white">
            {FOLLOWER_BANDS.map((b, i) => <option key={b.label} value={i}>팔로워 {b.label}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white">
            <option value="followers">팔로워순</option><option value="avg_views">평균 조회순</option>
            <option value="posts">게시물순</option><option value="comments">댓글순</option><option value="score">추천순</option>
          </select>
          <span className="text-[11px] text-gray-400 ml-auto">{formatNumber(total)}명</span>
        </div>

        {/* 리스트 (참고 UI: 프로필 · 팔로워 · 게시물 · 평균 조회 · 평균 댓글) */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_90px_80px_100px_90px] px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 border-b border-gray-100">
            <span>프로필</span><span className="text-right">팔로워</span><span className="text-right">게시물</span><span className="text-right">평균 조회</span><span className="text-right">평균 댓글</span>
          </div>
          {blocked ? (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-gray-900">{blocked.error}</p>
              {blocked.code === 'ADS_DB_AGENCY_BLOCKED' && (
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  등록 유형이 <b>중개(관리 대행)</b>로 되어 있습니다.<br />
                  매장 사장님 본인 계정이라면 <b>매장 관리</b>에서 등록 유형을 <b>직접</b>으로 바꿔주세요.
                </p>
              )}
              {blocked.code === 'ADS_DB_QUOTA_EXCEEDED' && (
                <p className="mt-2 text-xs text-gray-500">이미 담아 둔 후보로 제안은 계속 보내실 수 있어요.</p>
              )}
            </div>
          ) : !configured ? (
            <p className="p-6 text-sm text-gray-500 text-center">인플루언서 DB 연결 준비 중입니다.</p>
          ) : loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">조건에 맞는 인플루언서가 없어요.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map(r => (
                <li key={r.id}>
                  <button onClick={() => toggle(r.id)}
                    className={`w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_80px_100px_90px] items-center px-4 py-2.5 text-left transition ${selected.has(r.id) ? 'bg-rose-50/60' : 'hover:bg-gray-50'}`}>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <input type="checkbox" readOnly checked={selected.has(r.id)} className="accent-brand shrink-0" />
                      {r.thumbnail
                        ? <img src={r.thumbnail} alt="" width={32} height={32} loading="lazy" className="w-8 h-8 rounded-full object-cover bg-gray-100 shrink-0" />
                        : <span className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-gray-900 truncate">{r.handle || r.name}</span>
                        <span className="block text-[10px] text-gray-400 truncate">{r.category || r.platform}{r.region ? ` · ${r.region}` : ''}</span>
                      </span>
                    </span>
                    <span className="text-right text-xs font-semibold text-gray-800 sm:font-normal">{formatNumber(r.subscriber_count)}</span>
                    <span className="hidden sm:block text-right text-xs text-gray-600">{r.video_count ? formatNumber(r.video_count) : '—'}</span>
                    <span className="hidden sm:block text-right text-xs text-gray-600">{r.recent_avg_views ? formatNumber(r.recent_avg_views) : '—'}</span>
                    <span className="hidden sm:block text-right text-xs text-gray-600">{r.recent_avg_comments ? formatNumber(r.recent_avg_comments) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {total > 20 && (
          <div className="flex justify-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-40">이전</button>
            <span className="text-xs text-gray-500 self-center">{page} / {Math.ceil(total / 20)}</span>
            <button disabled={page >= Math.ceil(total / 20) || loading} onClick={() => load(page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-40">다음</button>
          </div>
        )}
      </div>

      {/* 하단 고정 제안 바 */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-[10500] bg-white border-t border-gray-200 p-3 flex items-center gap-3 sm:pl-64">
          <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Users className="w-4 h-4" /> {selected.size}명 선택</span>
          {contactFee > 0 && <span className="text-[11px] text-gray-500">예상 {formatNumber(contactFee * selected.size)}원</span>}
          <button onClick={() => setProposing(true)}
            className="ur-btn ur-btn-md ur-btn-primary ml-auto flex items-center gap-1.5 transition">
            <Send className="w-4 h-4" /> 협업 제안하기
          </button>
        </div>
      )}
      {proposing && (
        <ProposalModal count={selected.size} leadIds={[...selected]} contactFee={contactFee}
          onClose={() => setProposing(false)}
          onDone={() => { setProposing(false); setSelected(new Set()); setOutreachRefresh(k => k + 1) }} />
      )}
    </SellerLayout>
  )
}

/** 제안 작성 — 커미션% · 무상/유상 · 매체 · 기간 · 내용. 저장하면 유어딜이 발송 대행. */
function ProposalModal({ count, leadIds, contactFee, onClose, onDone }: {
  count: number; leadIds: number[]; contactFee: number; onClose: () => void; onDone: () => void
}) {
  const [products, setProducts] = useState<{ id: number; name: string }[]>([])
  const [productId, setProductId] = useState<number | ''>('')
  const [pct, setPct] = useState('15')
  const [support, setSupport] = useState<'free' | 'paid'>('free')
  const [channels, setChannels] = useState<Set<string>>(new Set(['instagram']))
  const [period, setPeriod] = useState('30')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/api/seller/products').then(r => {
      if (r.data?.success) setProducts((r.data.data || []).map((p: any) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
  }, [])

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.post('/api/seller/influencers/outreach', {
        target_lead_ids: leadIds,
        product_id: productId || undefined,
        commission_pct: Number(pct),
        product_support: support,
        channels: [...channels],
        period_days: Number(period) || undefined,
        message,
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      alert(r.data.data?.message || '제안이 접수되었습니다')
      onDone()
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '접수에 실패했습니다')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-gray-900">협업 제안 — {count}명</h2>
          <button onClick={onClose} className="text-gray-400 text-sm px-2">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
          <label className="block">
            <span className="text-xs font-bold text-gray-700">제안할 이용권</span>
            <div className="relative mt-1">
              <select value={productId} onChange={e => setProductId(e.target.value ? Number(e.target.value) : '')}
                className="w-full appearance-none px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white">
                <option value="">선택 안 함 (매장 전체 소개)</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-bold text-gray-700">판매 커미션 (%)</span>
              <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <span className="text-[10px] text-gray-400">이용권이 팔릴 때마다 지급 (사장님 몫에서)</span>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-gray-700">진행 기간 (일)</span>
              <input value={period} onChange={e => setPeriod(e.target.value)} inputMode="numeric"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
            </label>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-700">상품 제공</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={() => setSupport('free')} className={`py-2 rounded-lg border text-xs font-bold ${support === 'free' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>무상 제공</button>
              <button onClick={() => setSupport('paid')} className={`py-2 rounded-lg border text-xs font-bold ${support === 'paid' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>유상 (본인 부담)</button>
            </div>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-700">진행 매체 <span className="font-normal text-gray-400">(복수 선택)</span></span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CHANNELS.map(ch => (
                <button key={ch.key} onClick={() => setChannels(prev => { const n = new Set(prev); n.has(ch.key) ? n.delete(ch.key) : n.add(ch.key); return n })}
                  className={`px-2.5 py-1.5 rounded-full border text-[11px] font-bold ${channels.has(ch.key) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500'}`}>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-gray-700">제안 내용 <span className="font-normal text-gray-400">(20자 이상 — 유어딜이 소개 문구를 덧붙여 전달해요)</span></span>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={3000}
              placeholder={'예) 안녕하세요, 방배동 ○○식당입니다. 저희 대표 메뉴 이용권을 소개해 주실 분을 찾아요.\n판매 1건당 커미션을 드리고, 방문 시 식사는 무상 제공합니다.'}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
          </label>
          {contactFee > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              발송 확정 시 {count}명 × {formatNumber(contactFee)}원 = <b>{formatNumber(contactFee * count)}원</b>이 청구됩니다.
            </p>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button onClick={submit} disabled={busy || message.trim().length < 20 || channels.size === 0}
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
            {busy ? '접수 중…' : '제안 접수하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
