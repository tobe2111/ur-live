/**
 * 🎟️ 매장 공구 제안 인박스 (2026-07-06 §2-B — 매장 관점 양방향)
 *   · 받은 제안(인플→매장): 승인/거절 → 승인 시 공구 자동 시작
 *   · 보낸 협업(매장→인플): 핸들 지정해 특정 인플루언서에게 공구 제안 + 상태 확인
 *   GB_ENGINE_ENABLED + 서버 gb_engine_enabled 이중 게이트. 셀러 라이트 테마.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { Inbox, Loader2, Send } from 'lucide-react'

interface Proposal {
  id: number; product_id: number; product_name?: string; proposed_by: 'influencer' | 'seller'
  influencer_handle?: string | null; deadline?: string | null; price?: number | null
  promo_pct?: number | null; message?: string | null; status: string
}
interface ProductOpt { id: number; name: string; price: number }

const STATUS_LABEL: Record<string, string> = { proposed: '대기', approved: '승인·진행', rejected: '거절', withdrawn: '철회' }

export default function GbProposalsPanel({ products, headers }: { products: ProductOpt[]; headers: Record<string, string> }) {
  const [rows, setRows] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [showPropose, setShowPropose] = useState(false)

  async function load() {
    try {
      const res = await api.get('/api/gb-proposals/seller/list', { headers })
      if (res.data?.success) setRows(res.data.data || [])
    } catch { /* 게이트 OFF 등 */ } finally { setLoading(false) }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [])

  async function respond(id: number, action: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await api.post(`/api/gb-proposals/seller/${id}/respond`, { action }, { headers })
      if (res.data?.success) { toast.success(action === 'approve' ? '승인됨 · 공구 시작' : '거절됨'); load() }
      else toast.error(res.data?.error || '처리 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리 실패') }
    finally { setBusy(null) }
  }

  if (loading) return null
  const received = rows.filter(r => r.proposed_by === 'influencer')
  const sent = rows.filter(r => r.proposed_by === 'seller')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><Inbox className="w-4 h-4 text-emerald-600" /> 공구 제안</h3>
        <button onClick={() => setShowPropose(s => !s)} className="text-[12px] font-semibold text-emerald-700 flex items-center gap-1">
          <Send className="w-3.5 h-3.5" /> {showPropose ? '취소' : '인플루언서에게 제안'}
        </button>
      </div>

      {showPropose && <ProposeForm products={products} headers={headers} onDone={() => { setShowPropose(false); load() }} />}

      {/* 받은 제안 */}
      <p className="text-[11px] font-semibold text-gray-500 mt-2 mb-1">받은 제안 (인플루언서 → 우리 매장)</p>
      {received.length === 0 ? <p className="text-[12px] text-gray-400 py-1">아직 받은 제안이 없어요.</p> : received.map(r => (
        <div key={r.id} className="flex items-center justify-between gap-2 py-2 border-t border-gray-100">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 truncate">{r.product_name || `#${r.product_id}`}</p>
            <p className="text-[11px] text-gray-500">
              공구가 {formatNumber(r.price || 0)}원 · 소개비 {r.promo_pct || 0}%{r.deadline ? ` · ~${r.deadline.slice(0, 10)}` : ''}
            </p>
          </div>
          {r.status === 'proposed' ? (
            <div className="flex gap-1.5 shrink-0">
              <button disabled={busy === r.id} onClick={() => respond(r.id, 'approve')} className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-50">{busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '승인'}</button>
              <button disabled={busy === r.id} onClick={() => respond(r.id, 'reject')} className="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 text-[11px] font-semibold disabled:opacity-50">거절</button>
            </div>
          ) : <span className="text-[11px] text-gray-400 shrink-0">{STATUS_LABEL[r.status] || r.status}</span>}
        </div>
      ))}

      {/* 보낸 협업 */}
      {sent.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-gray-500 mt-3 mb-1">보낸 협업 (우리 매장 → 인플루언서)</p>
          {sent.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-2 border-t border-gray-100">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{r.product_name || `#${r.product_id}`} → @{r.influencer_handle || '?'}</p>
                <p className="text-[11px] text-gray-500">공구가 {formatNumber(r.price || 0)}원 · 소개비 {r.promo_pct || 0}%</p>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0">{STATUS_LABEL[r.status] || r.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function ProposeForm({ products, headers, onDone }: { products: ProductOpt[]; headers: Record<string, string>; onDone: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id || 0)
  const [handle, setHandle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [price, setPrice] = useState(0)
  const [promo, setPromo] = useState(20)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!productId || !handle.trim() || !deadline || !price) { toast.error('상품·핸들·마감·공구가를 입력해주세요'); return }
    setSaving(true)
    try {
      const res = await api.post('/api/gb-proposals/seller', {
        product_id: productId, influencer_handle: handle.trim(), deadline: new Date(deadline).toISOString(), price, promo_pct: promo,
      }, { headers })
      if (res.data?.success) { toast.success('인플루언서에게 제안을 보냈어요'); onDone() }
      else toast.error(res.data?.error || '제안 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '제안 실패') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg bg-gray-50 p-3 mb-3 space-y-2">
      <select value={productId} onChange={e => setProductId(Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-[12px] text-gray-900">
        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({formatNumber(p.price)}원)</option>)}
      </select>
      <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="인플루언서 핸들 (예: jiwon1228)" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-[12px] text-gray-900" />
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-[12px] text-gray-900" />
        <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))} placeholder="공구 특가" className="px-2 py-1.5 border border-gray-300 rounded-lg text-[12px] text-gray-900" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[12px] text-gray-600">소개비</label>
        <input type="number" min={0} max={50} value={promo} onChange={e => setPromo(Math.max(0, Math.min(50, Number(e.target.value))))} className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-[12px] text-gray-900" />
        <span className="text-[12px] text-gray-600">%</span>
        <button onClick={submit} disabled={saving} className="ml-auto px-3 py-1.5 bg-gray-900 text-white text-[12px] font-bold rounded-lg disabled:opacity-50">{saving ? '전송…' : '제안 보내기'}</button>
      </div>
    </div>
  )
}
