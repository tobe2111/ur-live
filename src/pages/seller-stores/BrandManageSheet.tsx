/**
 * 🏷️ 브랜드로 묶기 — 셀러 시트 (2026-10-17 대표 "응응 다 해줘")
 *
 * 지점이 여럿인 본사가 브랜드를 하나 만들고 지점을 넣는다. 손님에게는 `/brand/:slug` 한 페이지로
 * "내 주변 OO 지점" 이 보인다. 브랜드는 보여 주기용이라 정산·권한은 지점 그대로다(서버 `store-brands.ts`).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Brand { id: number; slug: string; name: string; seller_ids: number[] }
interface StoreLite { seller_id: number; name: string }

export default function BrandManageSheet({ stores, onClose }: { stores: StoreLite[]; onClose: () => void }) {
  const [brands, setBrands] = useState<Brand[] | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState<number | 'create' | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/seller/brands/mine')
      setBrands((r.data?.data || []) as Brand[])
    } catch { setBrands([]) }
  }, [])
  useEffect(() => { load() }, [load])

  const brand = brands?.[0] ?? null

  async function create() {
    if (busy || !name.trim()) return
    setBusy('create')
    try {
      const r = await api.post('/api/seller/brands', { name: name.trim(), ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}) })
      if (!r.data?.success) throw new Error(r.data?.error)
      await load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err?.response?.data?.error || err?.message || '브랜드를 만들지 못했어요')
    } finally { setBusy(null) }
  }

  async function toggle(sellerId: number, inBrand: boolean) {
    if (!brand || busy) return
    setBusy(sellerId)
    try {
      const r = inBrand
        ? await api.delete(`/api/seller/brands/stores/${sellerId}`)
        : await api.post(`/api/seller/brands/${brand.id}/stores`, { seller_id: sellerId })
      if (!r.data?.success) throw new Error(r.data?.error)
      await load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err?.response?.data?.error || err?.message || '처리하지 못했어요')
    } finally { setBusy(null) }
  }

  async function copyLink() {
    if (!brand) return
    try { await navigator.clipboard.writeText(`https://urdeal.kr/brand/${brand.slug}`); toast.success('브랜드 링크를 복사했어요') }
    catch { toast.error('복사하지 못했어요') }
  }

  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white sm:rounded-[var(--dash-radius,16px)] max-h-[85dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-[17px] font-bold text-gray-900">브랜드로 묶기</p>
            <p className="mt-1 text-[13px] text-gray-500">손님에게 한 브랜드로 보이고, 가까운 지점부터 나와요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 text-gray-400"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          {brands == null ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : !brand ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[13px] font-semibold text-gray-700">브랜드 이름</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 교촌치킨" maxLength={40}
                  className="mt-1 w-full rounded-xl border border-rule-strong px-3 py-3 text-[15px] text-gray-900 outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-gray-700">주소 (선택)</span>
                <div className="mt-1 flex items-center rounded-xl border border-rule-strong px-3 focus-within:border-brand">
                  <span className="text-[13px] text-gray-400">urdeal.kr/brand/</span>
                  <input value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 30))} placeholder="kyochon"
                    className="min-w-0 flex-1 py-3 text-[15px] text-gray-900 outline-none" />
                </div>
                <span className="mt-1 block text-[12px] text-gray-500">영문·숫자·하이픈. 비워 두면 자동으로 정해져요.</span>
              </label>
              <button type="button" onClick={create} disabled={!name.trim() || busy === 'create'} className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40">
                {busy === 'create' ? '만드는 중…' : '브랜드 만들기'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-gray-900">{brand.name}</p>
                  <p className="truncate text-[13px] text-gray-500">urdeal.kr/brand/{brand.slug}</p>
                </div>
                <button type="button" onClick={copyLink} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold text-gray-700">
                  <Copy size={13} /> 링크
                </button>
              </div>
              <p className="pt-4 pb-1 text-[13px] text-gray-500">브랜드에 넣을 지점을 고르세요. 넣은 지점 {brand.seller_ids.length}곳</p>
              <ul className="divide-y divide-rule">
                {stores.map((s) => {
                  const inBrand = brand.seller_ids.includes(s.seller_id)
                  return (
                    <li key={s.seller_id}>
                      <button type="button" onClick={() => toggle(s.seller_id, inBrand)} disabled={busy != null} className="flex w-full items-center gap-3 py-3 text-left">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${inBrand ? 'bg-brand text-white' : 'border border-rule-strong'}`}>
                          {busy === s.seller_id ? <Loader2 size={12} className="animate-spin" /> : inBrand && <Check size={13} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900">{s.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="pt-3 text-[12px] text-gray-500">승인된 지점만 손님 화면에 보여요. 가맹점은 점주가 본사를 운영자로 들인 뒤에 넣을 수 있어요.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
