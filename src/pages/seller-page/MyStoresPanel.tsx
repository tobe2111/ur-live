/**
 * 🏪 대시보드 1번 섹션 — 내 매장 (2026-08-24 대표 AB테스트 2차)
 *   대표: "대시보드 가장 첫번째 단계는 매장 등록. 무조건 선행. 등록된 매장 정보도 보이고,
 *   여러개라면 여러개 매장 정보가 보이고, 각 매장마다 이용권을 설정할 수 있어."
 *
 *   - 등록 매장이 있으면: 매장 카드 목록(이름·주소·상태·현재 선택 표시) — 카드마다
 *     [이용권 등록](좌석 전환 후 위저드 진입) + [정보](프로필 수정 — 전 이용권 전파) + [매장 추가].
 *   - 등록 매장이 없으면: **1단계 게이트 히어로** — 매장 등록 없이는 다음 단계가 잠긴다.
 *
 *   '등록 매장' 판정: 서버 store_ready(좌석 — 주소/채널/좌표/운영이력) OR 주소를 가진 매장 행.
 *   판정 전(loading)에는 게이트를 띄우지 않는다(오탐으로 정상 셀러를 잠그면 안 됨 — fail-open).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, Map, MapPin, Plus, Settings2, Store, Ticket } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import StoreRegisterModal from '@/components/seller/StoreRegisterModal'
import StoreProfileModal from '@/components/seller/StoreProfileModal'
import { enterStoreSeat } from '@/utils/enter-store'

interface OperableStore {
  seller_id: number
  role: 'owner' | 'operator'
  business_name: string | null
  name: string | null
  status: string | null
  username: string | null
  address: string | null
}

const storeLabel = (s: OperableStore) => s.business_name || s.name || `매장 #${s.seller_id}`
const isApproved = (s: OperableStore) => s.status === 'active' || s.status === 'approved'

interface Props {
  /** 게이트 여부를 부모(대시보드)에 알린다 — 다른 작업 잠금에 사용. null = 판정 중. */
  onGateChange: (gated: boolean | null) => void
}

export default function MyStoresPanel({ onGateChange }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stores, setStores] = useState<OperableStore[] | null>(null)
  const [seatReady, setSeatReady] = useState<boolean | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<OperableStore | null>(null)
  const [switching, setSwitching] = useState<number | null>(null)
  const currentId = Number(localStorage.getItem('seller_id') || 0)

  async function load() {
    const [storesR, ctxR] = await Promise.allSettled([
      api.get('/api/seller/my-stores'),
      api.get('/api/seller/stores/context'),
    ])
    if (storesR.status === 'fulfilled' && storesR.value.data?.success) {
      setStores(storesR.value.data.data || [])
    } else { setStores([]) }
    if (ctxR.status === 'fulfilled' && ctxR.value.data?.success) {
      setSeatReady(!!ctxR.value.data.data?.store_ready)
    } else { setSeatReady(null) }
  }
  useEffect(() => { load() }, [])

  // '등록 매장' = 주소가 있는 매장 행, 또는 현재 좌석이 등록 매장(운영 이력 포함).
  const registered = (stores || []).filter(s => !!s.address || (s.seller_id === currentId && seatReady === true))
  const loading = stores === null
  // 게이트: 판정이 끝났고(loading X) 등록 매장이 하나도 없을 때만. 좌석 판정 실패(null)면 fail-open.
  const gated = loading ? null : (registered.length === 0 && seatReady === false)

  useEffect(() => { onGateChange(gated) }, [gated, onGateChange])

  /** 그 매장 좌석으로 전환 후 이용권 위저드 진입 — StoreSwitcher 와 동일 토큰 계약. */
  async function registerVoucherFor(s: OperableStore) {
    if (!isApproved(s)) {
      toast.info(t('seller.stores.pendingHint', { defaultValue: '사업자 확인 중인 매장이에요 — 승인되면 이용권을 등록할 수 있어요' }))
      return
    }
    if (s.seller_id === currentId) { navigate('/seller/meal-voucher/new'); return }
    if (switching != null) return
    setSwitching(s.seller_id)
    // 🔁 2026-08-26: 좌석 전환 절차는 `enterStoreSeat` SSOT — 지도 클레임·매장 등록 페이지가 같은
    //   함수를 쓴다. 손으로 세 번 쓰면 갈리고, 갈리면 한 경로에서만 좌석이 안 잡힌다.
    const ok = await enterStoreSeat(s.seller_id)
    if (ok) {
      localStorage.setItem('seller_name', storeLabel(s))  // 목록 라벨은 이 화면이 아는 값
      navigate('/seller/meal-voucher/new')
    } else {
      toast.error(t('seller.mealVoucher.storeSwitchFailed', { defaultValue: '매장 전환에 실패했습니다' }))
      setSwitching(null)
    }
  }

  function onRegistered() {
    setAdding(false)
    load()
    toast.success(t('seller.stores.registered', { defaultValue: '매장이 등록됐어요 — 이제 이용권을 만들 수 있어요' }))
  }

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('seller.stores.loading', { defaultValue: '내 매장 확인 중…' })}</div>
  }

  // ── 1단계 게이트 — 등록 매장 0: 매장 등록 없이는 아무것도 시작되지 않는다 ──
  if (gated) {
    return (
      <>
        <div className="bg-gray-900 rounded-2xl p-5 text-white">
          <p className="text-[11px] font-bold text-white/60 mb-1">STEP 1</p>
          <h2 className="text-lg font-extrabold leading-snug">
            {t('seller.stores.gateTitle', { defaultValue: '매장 등록부터 시작해요' })}
          </h2>
          <p className="text-[12px] text-white/70 mt-1.5 leading-relaxed">
            {t('seller.stores.gateDesc', { defaultValue: '유어딜의 모든 기능은 매장에서 출발합니다. 카카오맵에서 내 매장을 찾아 등록하면 이용권 판매·소개 협업·정산이 열려요.' })}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-white/50 font-semibold">
            <span className="text-white">① {t('seller.stores.step1', { defaultValue: '매장 등록' })}</span>
            <span>→ ② {t('seller.stores.step2', { defaultValue: '이용권 등록' })}</span>
            <span>→ ③ {t('seller.stores.step3', { defaultValue: '판매·협업' })}</span>
            <span>→ ④ {t('seller.stores.step4', { defaultValue: '정산' })}</span>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-gray-900 text-sm font-extrabold hover:bg-gray-100 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Map className="w-4 h-4" aria-hidden="true" />{t('seller.stores.registerCta', { defaultValue: '카카오맵으로 매장 등록하기' })}
          </button>
        </div>
        {adding && <StoreRegisterModal onClose={() => setAdding(false)} onDone={onRegistered} />}
      </>
    )
  }

  // ── 매장 카드 목록 — 여러 매장이면 여러 카드, 카드마다 이용권 등록 ──
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Store className="w-4 h-4 text-gray-500" /> {t('seller.stores.myStores', { defaultValue: '내 매장' })}
          <span className="text-xs font-semibold text-gray-400">{registered.length}</span>
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
        >
          <Plus className="w-3.5 h-3.5" /> {t('seller.stores.addStore', { defaultValue: '매장 추가' })}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {registered.map(s => {
          const active = s.seller_id === currentId
          return (
            <div key={s.seller_id} className={`rounded-xl border p-3 ${active ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-gray-900 truncate flex items-center gap-1">
                    {storeLabel(s)}
                    {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </p>
                  {s.address && (
                    <p className="text-[11px] text-gray-500 truncate flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" /> {s.address}
                    </p>
                  )}
                  <p className="text-[10px] mt-0.5 font-semibold text-gray-400">
                    {isApproved(s)
                      ? t('seller.stores.operating', { defaultValue: '운영 중' })
                      : t('seller.stores.pending', { defaultValue: '승인 대기 (사업자 확인 중)' })}
                    {s.role === 'operator' && ` · ${t('seller.stores.delegated', { defaultValue: '위임' })}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2.5">
                <button
                  onClick={() => registerVoucherFor(s)}
                  disabled={switching != null}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-extrabold active:scale-[0.98] disabled:opacity-60 ${
                    isApproved(s) ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {switching === s.seller_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                  {t('seller.registerVoucher', { defaultValue: '이용권 등록' })}
                </button>
                <button
                  onClick={() => setEditing(s)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5" /> {t('seller.stores.info', { defaultValue: '정보' })}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {adding && <StoreRegisterModal onClose={() => setAdding(false)} onDone={onRegistered} />}
      {editing && (
        <StoreProfileModal
          sellerId={editing.seller_id}
          storeName={storeLabel(editing)}
          onClose={() => setEditing(null)}
          onDone={(n) => { setEditing(null); load(); toast.success(n > 0 ? t('seller.stores.savedPropagated', { defaultValue: '매장 정보 저장 — 이용권 {{count}}개에 반영됐어요', count: n }) : t('seller.stores.saved', { defaultValue: '매장 정보가 저장됐어요' })) }}
        />
      )}
    </div>
  )
}
