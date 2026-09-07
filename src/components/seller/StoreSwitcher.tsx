/**
 * 🏪 매장 전환 셀렉터 — 한 계정이 여러 매장을 운영할 때 (2026-08-19)
 *   설계 SSOT: `docs/design/store-operator-model.md` 2단계
 *
 * ⚠️ **매장이 1개면 아무것도 렌더하지 않는다.** 대부분의 사장님은 매장이 하나뿐이고,
 *   그들에게 "전환할 곳이 하나뿐인 드롭다운"은 순수한 소음이다. 기능이 필요한 사람에게만 보인다.
 *
 * 전환 = 서버가 그 매장의 seller_token 을 새로 발급(`POST /api/seller/stores/:id/token`).
 *   권한 판정은 **전적으로 서버**가 한다 — 이 컴포넌트가 목록을 갖고 있다는 사실은 권한이 아니다.
 */
import { useEffect, useState } from 'react'
import { ChevronDown, Store, Check, Loader2 } from 'lucide-react'
import api from '@/lib/api'

interface OperableStore {
  seller_id: number
  role: 'owner' | 'operator'
  source: 'link' | 'grant'
  business_name: string | null
  name: string | null
  status: string | null
  username: string | null
}

const storeLabel = (s: OperableStore) => s.business_name || s.name || `매장 #${s.seller_id}`

export default function StoreSwitcher() {
  const [stores, setStores] = useState<OperableStore[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<number | null>(null)
  const currentId = Number(localStorage.getItem('seller_id') || 0)

  useEffect(() => {
    let alive = true
    api.get('/api/seller/my-stores')
      .then(r => { if (alive && r.data?.success) setStores(r.data.data || []) })
      .catch(() => { /* 조용히 — 이 기능이 없다고 대시보드가 깨지면 안 된다 */ })
    return () => { alive = false }
  }, [])

  // 전환할 곳이 없으면 존재하지 않는다.
  if (stores.length < 2) return null

  const current = stores.find(s => s.seller_id === currentId)

  async function switchTo(s: OperableStore) {
    if (s.seller_id === currentId || switching) return
    setSwitching(s.seller_id)
    try {
      const r = await api.post(`/api/seller/stores/${s.seller_id}/token`)
      const d = r.data?.data
      if (!r.data?.success || !d?.seller_token) throw new Error(r.data?.error || 'switch failed')
      localStorage.setItem('seller_token', d.seller_token)
      localStorage.setItem('seller_id', String(d.seller.id))
      if (d.seller.username) localStorage.setItem('seller_username', d.seller.username)
      localStorage.setItem('seller_name', storeLabel(s))
      localStorage.setItem('is_distributor', String(d.seller.is_distributor ?? 0))
      // 하드 리로드 — 대시보드 전역이 옛 매장 데이터를 캐싱하고 있다. 부분 갱신은 반드시 새어 나온다.
      window.location.assign('/seller')
    } catch (e: any) {
      setSwitching(null)
      alert(e?.response?.data?.error || '매장 전환에 실패했습니다')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700 text-xs font-semibold max-w-[180px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Store className="w-4 h-4 shrink-0 text-gray-500" />
        <span className="truncate">{current ? storeLabel(current) : '매장 선택'}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* 📱 2026-09-04 (대표 스크린샷 — "팝업 같은게 잘려보임"): `absolute right-0 w-64` 는
                버튼 오른쪽 끝에서 **왼쪽으로 256px** 뻗는다. 좁은 화면에서 버튼이 왼쪽에 있으면
                그 256px 이 화면 밖으로 나가 목록이 잘린다(스크린샷: "운영"·"홍대" 가 잘림).
                ⇒ 모바일은 **화면에 고정**해 좌우 여백을 두고, sm 부터 종전 앵커. */}
          <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto mt-1 sm:w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-[70vh] overflow-y-auto" role="listbox">
            <p className="px-3 py-1.5 text-[11px] font-bold text-gray-400">운영 중인 매장 {stores.length}곳</p>
            {stores.map(s => {
              const active = s.seller_id === currentId
              return (
                <button
                  key={s.seller_id}
                  role="option"
                  aria-selected={active}
                  onClick={() => switchTo(s)}
                  disabled={switching != null}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-60 ${
                    active ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-700'
                  }`}
                >
                  <span className="flex-1 truncate">{storeLabel(s)}</span>
                  {/* 위임받은 매장은 표시해 준다 — 내 매장인지 남의 매장인지 헷갈리면 사고가 난다. */}
                  {s.role === 'operator' && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">위임</span>
                  )}
                  {switching === s.seller_id
                    ? <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                    : active && <Check className="w-4 h-4 text-gray-900 shrink-0" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
