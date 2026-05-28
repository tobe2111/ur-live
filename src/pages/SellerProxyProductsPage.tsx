/**
 * 🛡️ 2026-05-28 (대행 등록 승인 — docs/SERVICE_MODEL.md §6):
 *   크리에이터/에이전시가 우리 매장 공구를 대행 등록 (is_active=0, registration_approved=0).
 *   매장 사장님이 검토 후 승인 → 공개 / 거부 → 삭제.
 *
 * 라이트 테마 고정 (대시보드 룰 — 다크 variant 금지).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'

interface ProxyProduct {
  id: number
  name: string
  price: number
  stock: number | null
  category: string | null
  image_url: string | null
  created_at: string
  registered_by_user_id: number | null
  registrar_handle: string | null
}

export default function SellerProxyProductsPage() {
  const [items, setItems] = useState<ProxyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/api/seller/analytics/proxy-products')
      if (res.data?.success) setItems(res.data.data || [])
    } catch {
      toast.error('목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function act(id: number, action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm('이 대행 등록을 거부(삭제)할까요?')) return
    setBusy(id)
    try {
      const res = await api.post(`/api/seller/analytics/proxy-products/${id}/${action}`, {})
      if (res.data?.success) {
        toast.success(action === 'approve' ? '승인됨 — 공개되었습니다' : '거부됨')
        setItems((prev) => prev.filter((p) => p.id !== id))
      } else {
        toast.error(res.data?.error || '처리 실패')
      }
    } catch {
      toast.error('처리 중 오류')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SEO title="대행 등록 승인 - 유어딜" description="크리에이터가 대행 등록한 공구 검토" url="/seller/proxy-products" />
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-base font-bold text-gray-900">대행 등록 승인</h1>
            <Link to="/seller" className="text-xs text-gray-500">대시보드</Link>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
            크리에이터·에이전시가 우리 매장을 대신해 등록한 공구입니다. 내용을 확인하고 승인하면 공개돼요.
            정산은 항상 우리 매장으로 들어옵니다.
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">대기 중인 대행 등록이 없습니다.</div>
          ) : (
            items.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex gap-3">
                  {p.image_url && (
                    <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{p.name}</p>
                    <p className="text-sm text-gray-700">{formatWon(p.price)}{p.stock != null && <span className="text-gray-400"> · 재고 {p.stock}</span>}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.category || '카테고리 없음'} · 등록자 {p.registrar_handle ? '@' + p.registrar_handle : `#${p.registered_by_user_id}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => act(p.id, 'approve')} disabled={busy === p.id} className="flex-1 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                    승인 (공개)
                  </button>
                  <button onClick={() => act(p.id, 'reject')} disabled={busy === p.id} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-bold rounded-lg disabled:opacity-50">
                    거부
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
