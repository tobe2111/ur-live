import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import { Plus, Trash2, Play } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { parseYouTubeUrl } from '@/shared/urshorts'

/**
 * 🎬 셀러가 **자기 이용권에** 유어쇼츠를 붙이는 칸 (2026-09-07).
 *
 * ## 왜 이 경로가 제일 확실한가
 * 자동 수집은 남의 영상에서 우리 매장을 찾아내는 어려운 일인데, 이건 그 반대다 —
 * 매장 자신이 자기 영상을 갖고 있고 **연결이 원천적으로 정확**하다.
 * 338개 매장이 하나씩만 붙여도 338편이다.
 *
 * ## 🔴 소유권은 서버가 본다
 * 여기서 `productId` 를 보내지만 서버가 `products.seller_id` 를 다시 확인한다.
 * 화면이 보내는 값은 신뢰하지 않는다 — 안 그러면 남의 상품에 영상을 걸 수 있다.
 */
interface MyShort {
  id: number
  video_id: string
  title: string | null
  thumb_url: string | null
  product_id: number
  is_active: number
  consent: number
}

export default function ProductShortsField({ productId }: { productId?: number }) {
  const [rows, setRows] = useState<MyShort[]>([])
  const [url, setUrl] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!productId) return
    try {
      const r = await api.get('/api/seller/urshorts')
      const d = r.data as { success?: boolean; data?: MyShort[] }
      if (d?.success) setRows((d.data ?? []).filter((x) => x.product_id === productId))
    } catch { /* 조용히: 이 칸이 안 떠도 상품 수정은 되어야 한다 */ }
  }, [productId])
  useEffect(() => { void load() }, [load])

  /** 붙여 넣는 즉시 알려 준다. 서버까지 갔다 거부당하는 왕복을 줄인다. */
  const hint = useMemo(() => {
    if (!url.trim()) return null
    const p = parseYouTubeUrl(url)
    if (!p) return { bad: true, text: '유튜브 주소가 아닙니다' }
    if (p.form === 'shorts') return { bad: false, text: '쇼츠 주소입니다' }
    return { bad: false, text: '쇼츠인지 확인합니다 (3분 이하만 등록됩니다)' }
  }, [url])

  const add = async () => {
    if (busy || !url.trim() || !productId) return
    setBusy(true); setErr(null)
    try {
      await api.post('/api/seller/urshorts', { url, product_id: productId, consent })
      setUrl(''); await load()
    } catch (e) {
      const d = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(d || '추가하지 못했습니다')
    } finally { setBusy(false) }
  }

  const remove = async (id: number) => {
    try { await api.delete(`/api/seller/urshorts/${id}`); await load() }
    catch { setErr('삭제하지 못했습니다') }
  }

  // 새 상품(아직 저장 전)에는 붙일 곳이 없다. 저장한 뒤에 뜬다.
  if (!productId) return null

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        유어쇼츠
        <span className="ml-2 text-xs font-normal text-gray-500">
          유튜브 쇼츠를 붙이면 유어딜 홈에 이 이용권과 함께 나갑니다
        </span>
      </label>

      {rows.length > 0 && (
        <ul className="mb-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
              <span className="relative">
                <img
                  src={cfImage(r.thumb_url, { width: 100 })} alt=""
                  width={32} height={57}
                  className="h-[57px] w-8 rounded bg-gray-200 object-cover"
                  onError={(e) => cfImageOnError(e.currentTarget, r.thumb_url)}
                />
                <Play size={10} className="absolute left-1 top-1 text-white drop-shadow" fill="currentColor" strokeWidth={0} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">
                {r.title || r.video_id}
              </span>
              {!r.is_active && (
                <span className="shrink-0 rounded bg-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                  숨김
                </span>
              )}
              <button
                type="button" onClick={() => void remove(r.id)} aria-label="삭제"
                className="shrink-0 rounded-lg bg-white p-2 text-gray-500"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
          placeholder="https://www.youtube.com/shorts/..."
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button" onClick={() => void add()} disabled={busy || !url.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          <Plus size={15} /> 추가
        </button>
      </div>
      {/* 🔴 허락 확인. 매장 자기 영상이면 당연히 체크되지만, 손님이 찍어 올린 영상을 붙일 때는
          그 사람에게 물어야 한다 — 영상 옆에 구매 버튼이 붙으면 그가 이 딜을 보증한 것으로 읽힌다. */}
      <label className="mt-2 flex items-start gap-2 text-xs text-gray-700">
        <input
          type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1C69EF]"
        />
        <span>
          <b>내 매장이 만든 영상이거나, 만든 사람에게 허락받았습니다.</b>
          <span className="block text-gray-500">확인해야 유어딜 홈에 나갑니다.</span>
        </span>
      </label>
      {(err || hint) && (
        <p className={`mt-1.5 text-xs ${err || hint?.bad ? 'text-red-600' : 'text-gray-500'}`}>
          {err || hint?.text}
        </p>
      )}
    </div>
  )
}
