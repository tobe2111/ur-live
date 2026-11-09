/**
 * 🎬 어드민 — 다녀온 사람들 고르기 (2026-11-09 대표 *"전부 해줘"*)
 *
 * 판매 중 이용권 가게 대부분이 플랫폼이 올린 데모 매장이라 사장님이 없다 → 자동으로 찾은 **후보**(이름만 맞는 블로그·영상)를
 * 고를 사람이 없었다. 왼쪽은 가게 목록(후보 많은 순), 고르면 사장님 화면과 **같은 부품**(`CreatorContentManager`)이 열린다.
 * 🔒 대시보드 화면 — `dark:` 를 쓰지 않는다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import BrandLoader from '@/components/brand/BrandLoader'
import { CreatorContentManager } from './SellerCreatorContentPage'

interface StoreRow { store_key: string; store_name: string; address: string | null; candidates: number; visible: number; product_id: number | null }

export default function AdminCreatorContentPage() {
  const [rows, setRows] = useState<StoreRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<StoreRow | null>(null)

  useEffect(() => {
    api.get('/api/admin/creator-content-stores')
      .then((r) => { if (r.data?.success) setRows(r.data.data); else setError(r.data?.error || '불러오지 못했어요') })
      .catch((e) => setError(e?.response?.data?.error || '불러오지 못했어요'))
  }, [])

  const shown = (rows ?? []).filter((r) => !q.trim() || r.store_name.includes(q.trim()))

  return (
    <AdminLayout title="다녀온 사람들">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader title="다녀온 사람들" description="가게별로 자동으로 찾은 블로그·영상 후보를 골라 이용권 상세에 보이게 해요. 사장님이 없는 데모 매장은 여기서만 고를 수 있어요." />
        {error && <p className="text-[13px] text-tone-bad">{error}</p>}
        {!rows && !error && <BrandLoader />}
        {rows && (
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-xl bg-white p-3 shadow-lift">
              <input id="cc-store-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="가게 이름"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-[15px] text-gray-900 outline-none focus:border-brand" />
              <ul className="mt-2 max-h-[70dvh] divide-y divide-rule overflow-y-auto">
                {shown.map((r) => (
                  <li key={r.store_key}>
                    <button type="button" disabled={!r.product_id} onClick={() => setPicked(r)}
                      className={`flex w-full items-center gap-2 px-2 py-3 text-left disabled:opacity-40 ${picked?.store_key === r.store_key ? 'bg-brand-tint' : ''}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-gray-900">{r.store_name}</span>
                        <span className="block truncate text-[12px] text-gray-500">{r.address || '주소 없음'}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] tabular-nums">
                        {r.candidates > 0 && <span className="block font-medium text-brand-text">후보 {r.candidates}</span>}
                        <span className="block text-gray-500">보임 {r.visible}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              {picked?.product_id
                ? <CreatorContentManager key={picked.store_key} base={`/api/admin/creator-content/${picked.product_id}`} />
                : <p className="rounded-xl bg-white p-6 text-[15px] text-gray-500 shadow-lift">왼쪽에서 가게를 고르세요. 후보가 많은 가게가 위에 있어요.</p>}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
