import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, Check, X } from 'lucide-react'

/**
 * 🏪 **가게 개설 신청 대기열** — 운영자 셀프 온보딩 최소안 (2026-08-12, 대표 *"최소안으로 진행해줘"*)
 *
 * 그전까지 몰 생성과 셀러↔몰 연결이 **둘 다 어드민 수동**이었다. 파일럿 한두 곳이면 정상이지만
 * **매장이 열 곳만 돼도 대표가 매번 붙어야 한다.** ⇒ 운영자가 신청하고, 여기서 **승인만** 한다.
 *
 * 승인 한 번이 하는 일: 몰 생성(`consumer_path=1`) + `sellers.mall_id` 연결 +
 * 그 셀러가 이미 올려 둔 **본진 상품 이관**. 서버가 한 트랜잭션처럼 처리하고, 실패하면 신청을
 * `pending` 으로 되돌린다(대기열에서 사라지지 않게).
 *
 * 🔴 자동 생성이 아니다 — 슬러그는 `urdeal.kr/{슬러그}` 라는 **영구 주소**다. 사람이 한 번 본다.
 */
interface AppRow {
  id: number
  seller_id: number
  slug: string
  name: string
  created_at: string
  seller_name?: string | null
  seller_email?: string | null
}

export default function MallApplicationsPanel() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<number | null>(null)
  const { data, isLoading } = useApiQuery<{ items: AppRow[] }>(
    ['admin', 'mall-applications'],
    '/api/admin/wholesale-malls/applications',
    { select: (r: unknown) => ({ items: ((r as { items?: AppRow[] })?.items ?? []) }) },
  )
  const items = data?.items ?? []

  const act = async (id: number, kind: 'approve' | 'reject') => {
    setBusy(id)
    try {
      const r = await api.post(`/api/admin/wholesale-malls/applications/${id}/${kind}`, {})
      toast.success(kind === 'approve' ? `가게를 열었습니다 (urdeal.kr/${r.data?.slug ?? ''})` : '반려했습니다')
      qc.invalidateQueries({ queryKey: ['admin', 'mall-applications'] })
      if (kind === 'approve') qc.invalidateQueries({ queryKey: ['admin', 'wholesale-malls'] })
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || '처리 중 오류가 발생했습니다')
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  // 🔴 대기 0 이면 **아무것도 그리지 않는다** — 빈 대기열 카드가 화면을 차지할 이유가 없다.
  if (items.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-bold text-amber-900">가게 개설 신청 {items.length}건</p>
      <div className="mt-2 grid gap-2">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {a.name} <span className="font-mono text-xs text-gray-500">urdeal.kr/{a.slug}</span>
              </p>
              <p className="truncate text-xs text-gray-500">
                셀러 #{a.seller_id}{a.seller_name ? ` · ${a.seller_name}` : ''}{a.seller_email ? ` · ${a.seller_email}` : ''}
              </p>
            </div>
            <button
              type="button" disabled={busy === a.id} onClick={() => act(a.id, 'approve')}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> 승인
            </button>
            <button
              type="button" disabled={busy === a.id} onClick={() => act(a.id, 'reject')}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> 반려
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
