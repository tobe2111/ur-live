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

/**
 * 🏷️ 2026-09-15 A2 "매장이 제목" (대표 확정 — `seller-dashboard-2nd-directions-2026-09.md`).
 *   `variant="title"` 이면 헤더 **제목 자리**를 이 컴포넌트가 차지한다: [매장 아이콘 칩] 매장 이름 ⌄ / "내 매장 N곳".
 *   매장이 1곳이면 ⌄ 도 목록도 없이 이름만 그린다(전환할 곳이 없는데 열리는 드롭다운은 소음). 토큰 계약은 동일.
 */
/**
 * 🔐 좌석 전환 — 서버가 그 매장의 seller_token 을 새로 발급(`POST /api/seller/stores/:id/token`). 권한 판정은 전적으로 서버.
 *   홈의 매장별 행(B2)·매장 패널·이 드롭다운이 **같은 함수**를 쓴다(2026-09-15 추출 — 토큰 계약 byte-불변).
 *   성공하면 하드 리로드 — 대시보드 전역이 옛 매장 데이터를 캐싱하고 있어 부분 갱신은 반드시 새어 나온다.
 */
export async function switchStore(sellerId: number, label: string, to = '/seller'): Promise<void> {
  const r = await api.post(`/api/seller/stores/${sellerId}/token`)
  const d = r.data?.data
  if (!r.data?.success || !d?.seller_token) throw new Error(r.data?.error || 'switch failed')
  localStorage.setItem('seller_token', d.seller_token)
  localStorage.setItem('seller_id', String(d.seller.id))
  if (d.seller.username) localStorage.setItem('seller_username', d.seller.username)
  localStorage.setItem('seller_name', label)
  localStorage.setItem('is_distributor', String(d.seller.is_distributor ?? 0))
  window.location.assign(to)
}

export default function StoreSwitcher({ variant = 'menu' }: { variant?: 'menu' | 'title' } = {}) {
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

  const current = stores.find(s => s.seller_id === currentId)
  const canSwitch = stores.length >= 2
  // 전환할 곳이 없으면 존재하지 않는다 — 단, 제목형은 이름 자체가 제목이라 1곳이어도 그린다.
  if (!canSwitch && variant === 'menu') return null

  async function switchTo(s: OperableStore) {
    if (s.seller_id === currentId || switching) return
    setSwitching(s.seller_id)
    try {
      await switchStore(s.seller_id, storeLabel(s))
    } catch (e: any) {
      setSwitching(null)
      alert(e?.response?.data?.error || '매장 전환에 실패했습니다')
    }
  }

  return (
    <div className="relative">
      {variant === 'title' ? (
        <button
          type="button"
          onClick={() => { if (canSwitch) setOpen(o => !o) }}
          className={`flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 text-left ${canSwitch ? 'hover:bg-gray-50' : 'cursor-default'}`}
          aria-haspopup={canSwitch ? 'listbox' : undefined}
          aria-expanded={canSwitch ? open : undefined}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-text">
            <Store className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[15px] font-extrabold leading-tight text-gray-900">
              <span className="truncate">{current ? storeLabel(current) : (localStorage.getItem('seller_name') || '내 매장')}</span>
              {canSwitch && <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
            </span>
            <span className="block truncate text-[11px] text-gray-500">
              {canSwitch ? `내 매장 ${stores.length}곳` : '내 매장'}
              {current?.role === 'operator' ? ' · 위임 운영' : ''}
            </span>
          </span>
        </button>
      ) : (
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
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* 📱 2026-09-04 (대표 스크린샷 — "팝업 같은게 잘려보임"): `absolute right-0 w-64` 는
                버튼 오른쪽 끝에서 **왼쪽으로 256px** 뻗는다. 좁은 화면에서 버튼이 왼쪽에 있으면
                그 256px 이 화면 밖으로 나가 목록이 잘린다(스크린샷: "운영"·"홍대" 가 잘림).
                ⇒ 모바일은 **화면에 고정**해 좌우 여백을 두고, sm 부터 종전 앵커. */}
          <div className={`fixed inset-x-3 top-14 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50 sm:absolute sm:inset-x-auto sm:top-auto sm:w-64 ${variant === 'title' ? 'sm:left-0' : 'sm:right-0'}`} role="listbox">
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
