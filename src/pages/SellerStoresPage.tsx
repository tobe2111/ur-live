/**
 * 🏪 매장 관리 — 매장 추가(카카오맵 검색)·삭제·위임·채널 (2026-08-20 대표 확정)
 *   설계 SSOT: docs/design/seller-dashboard-v2.md
 *
 * "매장 사전 등록이 아니라 그냥 매장 등록. 카카오맵으로 검색해서 나오게. 매장 관리 페이지에는
 *  매장 추가·삭제·위임 기능. 실제 사업주 확인은 국세청 사업자번호 조회."
 *
 * 수수료(최종): 직접(내 가게) = 유어딜 10% · 중개(관리 대행) = 유어딜 5% — 등록 시 선택.
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import SellerLayout from '@/components/SellerLayout'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { Store, Plus, Search, Loader2, MapPin, CheckCircle2, XCircle, Trash2, Users, BadgeCheck } from 'lucide-react'

interface OperableStore {
  seller_id: number; role: 'owner' | 'operator'; source: 'link' | 'grant'
  business_name: string | null; name: string | null; status: string | null; username: string | null
}
interface KakaoPlace {
  id: string; place_name: string; road_address_name: string; address_name: string
  phone: string; category_name: string; place_url: string; x: string; y: string
}

export default function SellerStoresPage() {
  const [stores, setStores] = useState<OperableStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/api/seller/my-stores')
      if (!r.data?.success) throw new Error(r.data?.error)
      setStores(r.data.data || [])
    } catch (e: any) {
      setError(e?.response?.data?.error || '매장 목록을 불러오지 못했습니다')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function closeStore(s: OperableStore) {
    const label = s.business_name || s.name || `매장 #${s.seller_id}`
    const isOwner = s.role === 'owner'
    if (!confirm(isOwner
      ? `${label} 매장을 삭제(영업 종료)할까요?\n\n판매 노출이 중단됩니다. 주문·정산 이력은 보존됩니다.`
      : `${label} 매장을 내 목록에서 뺄까요? (매장 자체는 유지됩니다)`)) return
    try {
      const r = await api.post(`/api/seller/stores/${s.seller_id}/close`)
      if (!r.data?.success) throw new Error(r.data?.error)
      await load()
    } catch (e: any) { alert(e?.response?.data?.error || '처리에 실패했습니다') }
  }

  return (
    <SellerLayout title="매장 관리">
      <SEO title="매장 관리 - 유어딜 셀러" description="매장 추가·삭제·위임" noindex />
      <div className="mx-auto max-w-4xl space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">내 가게든, 관리를 맡은 가게든 — 여기서 추가하고 전환해서 운영해요.</p>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-bold transition">
            <Plus className="w-4 h-4" /> 매장 등록
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error} <button onClick={load} className="underline font-semibold ml-1">다시 시도</button>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : stores.length === 0 ? (
            <div className="p-8 text-center">
              <Store className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">아직 매장이 없어요. 카카오맵에서 내 가게를 찾아 등록해 보세요.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stores.map(s => (
                <li key={s.seller_id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Store className="w-4.5 h-4.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {s.business_name || s.name || `매장 #${s.seller_id}`}
                      {s.role === 'owner'
                        ? <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">소유</span>
                        : <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">위임</span>}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {s.status === 'approved' || s.status === 'active' ? '운영 중' : s.status === 'pending' ? '승인 대기 (사업자 확인 중)' : s.status}
                    </p>
                  </div>
                  {s.role === 'owner' && (
                    <Link to="/seller/operators" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50">
                      <Users className="w-3.5 h-3.5" /> 위임
                    </Link>
                  )}
                  <button onClick={() => closeStore(s)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[11px] font-semibold hover:bg-gray-50">
                    <Trash2 className="w-3.5 h-3.5" /> {s.role === 'owner' ? '삭제' : '목록에서 빼기'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          수수료 안내 — 내 가게 직접 운영 <b className="text-gray-600">10%</b> · 중개(관리 대행) <b className="text-gray-600">5%</b>.
          매장을 전환하려면 상단의 매장 이름을 누르세요.
        </p>
      </div>

      {adding && <AddStoreModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} />}
    </SellerLayout>
  )
}

/** 매장 등록 모달 — ① 카카오맵 검색 → ② 채널 선택 → ③ 사업자번호 확인 → 등록 */
function AddStoreModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<KakaoPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<KakaoPlace | null>(null)
  const [channel, setChannel] = useState<'direct' | 'brokered' | null>(null)
  const [bno, setBno] = useState('')
  const [rep, setRep] = useState('')
  const [startDate, setStartDate] = useState('')
  const [nts, setNts] = useState<{ valid: boolean | null; message?: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim() || searching) return
    setSearching(true); setPicked(null)
    try {
      const r = await api.get('/api/kakao/place/search', { params: { query: q.trim(), size: 10 } })
      setResults(r.data?.data?.documents || [])
    } catch { setResults([]) } finally { setSearching(false) }
  }

  async function verify() {
    const clean = bno.replace(/-/g, '')
    if (!/^\d{10}$/.test(clean)) { alert('사업자번호는 숫자 10자리입니다'); return }
    setVerifying(true); setNts(null)
    try {
      const r = await api.post('/api/seller/stores/verify-business', {
        business_number: clean,
        ...(rep && startDate ? { representative: rep, start_date: startDate } : {}),
      })
      setNts(r.data?.data || null)
    } catch (e: any) {
      setNts({ valid: null, message: e?.response?.data?.error || '확인 실패' })
    } finally { setVerifying(false) }
  }

  async function submit() {
    if (!picked || !channel || submitting) return
    setSubmitting(true)
    try {
      const r = await api.post('/api/seller/stores', {
        name: picked.place_name,
        address: picked.road_address_name || picked.address_name,
        phone: picked.phone,
        category: picked.category_name,
        kakao_place_id: picked.id,
        kakao_place_url: picked.place_url,
        lat: Number(picked.y), lng: Number(picked.x),
        channel,
        business_number: bno.replace(/-/g, '') || undefined,
        representative: rep || undefined,
        business_start_date: startDate || undefined,
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      alert(r.data.data?.message || '매장이 등록되었습니다')
      onDone()
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '등록에 실패했습니다')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-gray-900">매장 등록</h2>
          <button onClick={onClose} className="text-gray-400 text-sm px-2">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* ① 카카오맵 검색 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">① 카카오맵에서 내 매장 찾기</p>
            <form onSubmit={search} className="flex gap-2">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="매장 이름 (예: 김밥천국 방배점)"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              <button type="submit" disabled={searching}
                className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-50">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>
            {results.length > 0 && !picked && (
              <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {results.map(p => (
                  <li key={p.id}>
                    <button onClick={() => setPicked(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                      <p className="text-sm font-semibold text-gray-900">{p.place_name}</p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{p.road_address_name || p.address_name}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked && (
              <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{picked.place_name}</p>
                  <p className="text-[11px] text-gray-500">{picked.road_address_name || picked.address_name}</p>
                </div>
                <button onClick={() => setPicked(null)} className="text-[11px] text-gray-400 underline shrink-0">다시 선택</button>
              </div>
            )}
          </div>

          {/* ② 운영 방식 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">② 누가 운영하나요?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setChannel('direct')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'direct' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">내 가게예요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">사장님 직접 운영 · 수수료 10%</p>
              </button>
              <button onClick={() => setChannel('brokered')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'brokered' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">관리를 맡았어요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">중개·대행 운영 · 수수료 5%</p>
              </button>
            </div>
          </div>

          {/* ③ 사업자 확인 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">③ 사업자번호 확인 <span className="font-normal text-gray-400">(국세청 조회 — 통과 시 바로 활성화)</span></p>
            <div className="space-y-2">
              <input value={bno} onChange={e => setBno(e.target.value)} placeholder="사업자번호 10자리" inputMode="numeric" maxLength={12}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              <div className="grid grid-cols-2 gap-2">
                <input value={rep} onChange={e => setRep(e.target.value)} placeholder="대표자명 (진위확인용·선택)"
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
                <input value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="개업일 YYYYMMDD (선택)" inputMode="numeric" maxLength={8}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              </div>
              <button onClick={verify} disabled={verifying || !bno}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} 국세청 확인
              </button>
              {nts && (
                <p className={`text-[11px] flex items-center gap-1 ${nts.valid === true ? 'text-emerald-600' : nts.valid === false ? 'text-red-600' : 'text-gray-500'}`}>
                  {nts.valid === true ? <CheckCircle2 className="w-3.5 h-3.5" /> : nts.valid === false ? <XCircle className="w-3.5 h-3.5" /> : null}
                  {nts.valid === true ? `확인되었습니다${nts.message ? ` (${nts.message})` : ''}` : nts.valid === false ? '일치하지 않습니다 — 입력을 확인해주세요' : (nts.message || '확인 불가 — 등록 후 검토됩니다')}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button onClick={submit} disabled={!picked || !channel || submitting}
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
            {submitting ? '등록 중…' : '매장 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
