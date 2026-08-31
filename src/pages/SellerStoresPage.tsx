/**
 * 🏪 매장 관리 — 매장 추가(카카오맵 지도 검색 — 공용 StoreRegisterModal)·삭제·위임·채널 (2026-08-20 대표 확정)
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
import { Store, Plus, Loader2, Trash2, Users } from 'lucide-react'
import StoreRegisterModal from '@/components/seller/StoreRegisterModal'
import StoreProfileModal from '@/components/seller/StoreProfileModal'
import SellerWithdrawSection from '@/components/seller/SellerWithdrawSection'
import ReviewBonusCard from '@/components/seller/ReviewBonusCard'

interface OperableStore {
  seller_id: number; role: 'owner' | 'operator'; source: 'link' | 'grant'
  business_name: string | null; name: string | null; status: string | null; username: string | null
}

export default function SellerStoresPage() {
  const [stores, setStores] = useState<OperableStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<OperableStore | null>(null)

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
            className="ur-btn ur-btn-md ur-btn-primary flex items-center gap-1.5 transition">
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
                  <button onClick={() => setEditing(s)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50">
                    정보
                  </button>
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
          {/* 🚫 2026-08-26 (대표): 채널별 수수료율 표기 제거 — 선택지 옆의 가격표는 '싼 쪽 고르기'를
              유도한다(채널은 사실이지 요금제가 아니다). 실제 수수료는 이용권 등록의 실수령가 카드가 건별로 보여 준다. */}
          매장을 전환하려면 상단의 매장 이름을 누르세요.
        </p>

        {/* 🧾 2026-08-31 (대표 "후기 보너스는 매장 사장님이 설정… 셀러 대시보드에서"):
            지금 전환된 매장 기준이다 — 매장을 바꾸면 그 매장 값이 뜬다. */}
        <ReviewBonusCard />

        {/* 🚪 2026-08-26 (대표 "셀러도 탈퇴를 할 수 있어야"): 소비자 탈퇴의 셀러판 — 조용한 자리에. */}
        <SellerWithdrawSection />
      </div>

      {adding && <StoreRegisterModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} />}
      {editing && (
        <StoreProfileModal
          sellerId={editing.seller_id}
          storeName={editing.business_name || editing.name || undefined}
          onClose={() => setEditing(null)}
          onDone={(n) => { setEditing(null); load(); alert(n > 0 ? `매장 정보가 저장됐어요 — 이용권 ${n}개에 반영됐습니다` : '매장 정보가 저장됐어요') }}
        />
      )}
    </SellerLayout>
  )
}
