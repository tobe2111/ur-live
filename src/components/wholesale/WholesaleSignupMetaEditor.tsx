import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { supplierApi } from '@/lib/supplier-api'
import { toast } from '@/hooks/useToast'
import { WHOLESALE_CATEGORIES } from '@/pages/wholesale/wholesale-theme'

// 🏭 2026-06-29 (E): 가입 시 입력한 취급 카테고리 + 판매/유통 채널을 대시보드에서 사후 수정.
//   kind='supplier'(제조사=공급 카테고리/희망 유통채널) | 'distributor'(판매사=취급 카테고리/주력 판매채널).
//   라이트 테마(대시보드 계열). 백엔드: GET/PATCH /api/{supplier|wholesale}/signup-meta.
type Kind = 'supplier' | 'distributor'

export default function WholesaleSignupMetaEditor({ kind, brandColor = '#FC5424' }: { kind: Kind; brandColor?: string }) {
  const base = kind === 'supplier' ? '/api/supplier/signup-meta' : '/api/wholesale/signup-meta'
  const channelLabel = kind === 'supplier' ? '희망 유통채널' : '현재 주력 판매채널'
  const channelPh = kind === 'supplier' ? '예: 도매몰, 온라인 판매사, 대형마트, 오프라인 도매상' : '예: 스마트스토어, 쿠팡, 자사몰, 오프라인 매장'
  const catLabel = kind === 'supplier' ? '공급(취급) 카테고리' : '주로 취급하는 카테고리'

  const [categories, setCategories] = useState<string[]>([])
  const [channel, setChannel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const authGet = async (): Promise<{ categories?: string[]; channel?: string }> => {
    if (kind === 'supplier') return await supplierApi.get<{ categories?: string[]; channel?: string }>(base)
    const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
    return (await api.get(base, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })).data
  }
  const authPatch = async (payload: { categories: string[]; channel: string }) => {
    if (kind === 'supplier') return await supplierApi.patch(base, payload)
    const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
    return (await api.patch(base, payload, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })).data
  }

  useEffect(() => {
    let cancelled = false
    authGet()
      .then((d) => { if (cancelled) return; setCategories(Array.isArray(d?.categories) ? d.categories.map(String) : []); setChannel(d?.channel || '') })
      .catch(() => { /* graceful — 빈 상태 유지 */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (id: string) => setCategories((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const save = async () => {
    if (saving) return
    setSaving(true)
    try { await authPatch({ categories, channel: channel.trim() }); toast.success('취급 정보를 저장했어요') }
    catch { toast.error('저장에 실패했어요 — 다시 시도해주세요') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">취급 정보</h3>
        <span className="text-xs text-gray-400">검색·매칭·추천에 활용</span>
      </div>
      {loading ? (
        <div className="h-20 rounded-xl bg-gray-50 animate-pulse" />
      ) : (
        <>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{catLabel}</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {WHOLESALE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => {
              const on = categories.includes(c.id)
              return (
                <button type="button" key={c.id} onClick={() => toggle(c.id)} disabled={saving}
                  className="px-3.5 h-9 rounded-full text-[13px] font-bold transition-colors border"
                  style={on ? { background: brandColor, color: '#fff', borderColor: brandColor } : { background: '#fff', color: '#4B5563', borderColor: '#E5E7EB' }}>
                  {c.label}
                </button>
              )
            })}
          </div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{channelLabel}</label>
          <input value={channel} onChange={(e) => setChannel(e.target.value)} disabled={saving}
            className="w-full h-11 px-3.5 rounded-xl border border-gray-300 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors"
            placeholder={channelPh} />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={save} disabled={saving}
              className="px-5 h-10 rounded-xl text-white font-bold text-sm disabled:opacity-60" style={{ background: brandColor }}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
