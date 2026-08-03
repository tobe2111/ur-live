/**
 * 🏪 **이 몰에 속한 매장** 〔2026-08-03 — 파일럿 개설의 빠진 조각〕
 *
 * 몰을 만들어도 **매장을 붙일 방법이 없었다.** 상품의 몰 귀속은 서버가 `sellers.mall_id` 를 읽어
 * 찍는데(`sellerMallIdOf`), 그 값은 가입 시 호스트로만 정해지고 기본이 1(본진)이다.
 * ⇒ 몰을 만들고 공구를 등록해도 **본진에 붙어** `urdeal.kr/{슬러그}` 는 계속 빈 화면이었다.
 *
 * 백엔드: `GET/POST /api/admin/wholesale-malls/:id/sellers` · `DELETE .../sellers/:sellerId`.
 * 라이트 고정 테마(대시보드 — `dark:` 없음).
 *
 * ⚠️ **삭제가 아니라 이동**이다 — 해제하면 본진(1)으로 되돌아가고, 그 매장 상품도 같이 따라간다.
 *   그래서 잘못 눌러도 되돌릴 수 있다(다시 연결하면 원상복구).
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, Store, X } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface SellerRow {
  id: number
  username: string
  business_name: string | null
  status: string | null
  is_active: number | null
  products: number | null
}

export default function MallSellersPanel({ mallId, mallName }: { mallId: number; mallName: string }) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const key = ['admin', 'wholesale-malls', mallId, 'sellers']

  const { data, isLoading, isError, refetch } = useApiQuery<SellerRow[]>(
    key, `/api/admin/wholesale-malls/${mallId}/sellers`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { select: (r: any) => (r?.success ? ((r.data ?? []) as SellerRow[]) : []), staleTime: 60 * 1000 },
  )
  const rows = data ?? []

  async function attach() {
    const v = input.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      const r = await api.post(`/api/admin/wholesale-malls/${mallId}/sellers`, { seller: v })
      const d = r?.data?.data
      // 상품이 몇 개 따라왔는지까지 말해 준다 — "옮겼다"만 뜨면 절반만 옮겨졌는지 알 수 없다.
      toast.success(`${d?.username ?? v} 를 ${mallName} 로 옮겼어요 (상품 ${formatNumber(d?.products_moved ?? 0)}개 동반)`)
      setInput('')
      qc.invalidateQueries({ queryKey: key })
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((e as any)?.response?.data?.error || '매장을 옮기지 못했어요')
    } finally { setBusy(false) }
  }

  async function detach(s: SellerRow) {
    if (busy) return
    if (!window.confirm(`${s.business_name || s.username} 을(를) 본진으로 되돌릴까요? 상품도 같이 이동합니다.`)) return
    setBusy(true)
    try {
      await api.delete(`/api/admin/wholesale-malls/${mallId}/sellers/${s.id}`)
      toast.success('본진으로 되돌렸어요')
      qc.invalidateQueries({ queryKey: key })
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((e as any)?.response?.data?.error || '되돌리지 못했어요')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <Store className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-bold text-gray-700">이 몰의 매장</span>
        <span className="text-[11px] text-gray-400">— 여기 있는 매장이 등록한 공구가 몰 홈에 뜹니다</span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') attach() }}
          placeholder="매장 로그인 아이디 또는 id"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400"
        />
        <button onClick={attach} disabled={busy || !input.trim()}
          className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0">
          연결
        </button>
      </div>

      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
      ) : isError ? (
        // 🛡️ fetch 실패를 '매장 0개'로 위장하지 않는다(도매 감사 룰과 동일).
        <div className="py-3 text-center">
          <p className="text-xs text-red-600">매장 목록을 불러오지 못했어요</p>
          <button onClick={() => refetch()} className="mt-1 text-[11px] text-gray-600 underline">다시 시도</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-gray-400 py-2">아직 연결된 매장이 없어요. 위에 매장 아이디를 넣어 연결하세요.</p>
      ) : (
        <div className="grid gap-1.5">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-xs font-semibold text-gray-900 truncate">{s.business_name || s.username}</span>
              <span className="text-[11px] font-mono text-gray-400 shrink-0">{s.username}</span>
              <span className="text-[11px] text-gray-500 shrink-0">상품 {formatNumber(s.products ?? 0)}</span>
              {s.is_active === 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">정지</span>}
              <button onClick={() => detach(s)} disabled={busy} title="본진으로 되돌리기"
                className="ml-auto p-1 text-gray-400 hover:text-gray-700 shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
