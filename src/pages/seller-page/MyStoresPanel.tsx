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
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronRight, Loader2, Map, MapPin, Plus, Settings2, Store, Ticket } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import StoreRegisterModal from '@/components/seller/StoreRegisterModal'
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
  /**
   * 📱 2026-09-14 (홈 M2): 폰 홈에는 매장 카드 블록이 없다(시안 — 매장 이름은 오늘 티켓 밴드가 말하고, 관리는
   *   더보기 › 매장). 그런데 **게이트 판정은 이 컴포넌트가 한다**(서버 store_ready + 매장 목록). 그래서 폰에서는
   *   `gateOnly` 로 마운트해 판정·STEP 1 티켓만 맡기고, 등록 매장이 있으면 아무것도 그리지 않는다.
   */
  gateOnly?: boolean
}

export default function MyStoresPanel({ onGateChange, gateOnly = false }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stores, setStores] = useState<OperableStore[] | null>(null)
  /** `undefined` = 판정 중 · `null` = 판정 실패(fail-open) · boolean = 서버 답. 셋을 구분해야 게이트가 깜빡이지 않는다. */
  const [seatReady, setSeatReady] = useState<boolean | null | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const [switching, setSwitching] = useState<number | null>(null)
  const currentId = Number(localStorage.getItem('seller_id') || 0)

  /**
   * 🩸 2026-09-15 (대표 신고 *"왜 내 매장 부분에 로딩이 걸리는거지?"*) — 종전엔 `await Promise.allSettled([A, B])`
   *   라 **둘 다 끝나야** `setStores` 가 돌았다. 매장 목록(A)이 이미 손에 있어도 좌석 프리필(B)이 느리면
   *   그동안 계속 스피너다. 두 값은 서로를 안 기다려도 되므로 **각자 도착하는 대로** 반영한다.
   *   (axios timeout 15s — 종전엔 B 가 죽으면 최악 15초를 스피너로 보냈다.)
   */
  function load() {
    setSeatReady(undefined)
    api.get('/api/seller/my-stores')
      .then(r => setStores(r.data?.success ? (r.data.data || []) : []))
      .catch(() => setStores([]))
    api.get('/api/seller/stores/context')
      .then(r => setSeatReady(r.data?.success ? !!r.data.data?.store_ready : null))
      .catch(() => setSeatReady(null))
  }
  useEffect(() => { load() }, [])

  // '등록 매장' = 주소가 있는 매장 행, 또는 현재 좌석이 등록 매장(운영 이력 포함).
  const registered = (stores || []).filter(s => !!s.address || (s.seller_id === currentId && seatReady === true))
  // 목록이 오면 **곧바로** 그린다. 좌석 판정(B)은 게이트를 정할 때만 기다린다 — 등록 매장이 이미 있으면
  // 게이트는 어차피 false 라 B 를 기다릴 이유가 없다.
  const loading = stores === null || (registered.length === 0 && seatReady === undefined)
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
    if (gateOnly) return null
    return <div className="flex items-center gap-2 rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('seller.stores.loading', { defaultValue: '내 매장 확인 중…' })}</div>
  }

  // ── 1단계 게이트 — 등록 매장 0: 매장 등록 없이는 아무것도 시작되지 않는다 ──
  if (gated) {
    return (
      <>
        {/* 🎫 2026-09-02 (대표 확정 — 셀러 B안): 잉크 STEP 카드 → 티켓 부품(블루 밴드 + 흰 본문). 잉크 사이드바와
            잉크 카드와 잉크 버튼이 한 화면에서 셋이 경쟁하던 것을, 강조는 밴드 하나로. 소비자 지갑·결제 완료와 같은 문법. */}
        <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
          <div className="flex items-center justify-between h-11 px-4 text-[14px] text-white bg-brand tabular-nums">
            <span className="font-bold">STEP 1 · {t('seller.stores.step1', { defaultValue: '매장 등록' })}</span>
            <span className="font-medium">1 / 4</span>
          </div>
          <div className="p-5">
          <h2 className="text-lg font-extrabold leading-snug text-gray-900">
            {t('seller.stores.gateTitle', { defaultValue: '매장 등록부터 시작해요' })}
          </h2>
          <p className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed">
            {t('seller.stores.gateDesc', { defaultValue: '유어딜의 모든 기능은 매장에서 출발합니다. 카카오맵에서 내 매장을 찾아 등록하면 이용권 판매·소개 협업·정산이 열려요.' })}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11.5px] text-gray-400 font-semibold">
            <span className="text-brand-text">① {t('seller.stores.step1', { defaultValue: '매장 등록' })}</span>
            <span>② {t('seller.stores.step2', { defaultValue: '이용권 등록' })}</span>
            <span>③ {t('seller.stores.step3', { defaultValue: '판매·협업' })}</span>
            <span>④ {t('seller.stores.step4', { defaultValue: '정산' })}</span>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="ur-btn ur-btn-md ur-btn-primary mt-4 w-full sm:w-auto"
          >
            <Map className="w-4 h-4" aria-hidden="true" />{t('seller.stores.registerCta', { defaultValue: '카카오맵으로 매장 등록하기' })}
          </button>
          </div>
        </div>
        {adding && <StoreRegisterModal onClose={() => setAdding(false)} onDone={onRegistered} />}
      </>
    )
  }

  if (gateOnly) return null

  // ── 매장 카드 목록 — 여러 매장이면 여러 카드, 카드마다 이용권 등록 ──
  return (
    <div className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Store className="w-4 h-4 text-gray-500" /> {t('seller.stores.myStores', { defaultValue: '내 매장' })}
          <span className="text-xs font-semibold text-gray-400">{registered.length}</span>
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg border border-rule px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
        >
          <Plus className="w-3.5 h-3.5" /> {t('seller.stores.addStore', { defaultValue: '매장 추가' })}
        </button>
      </div>
      {/* 🧮 2026-09-15 D3 (대표 신고 "버튼이랑 글자 깨지고"): 이 패널은 PC 홈 우측 340px 열에 산다. 2열 카드 그리드는 카드
          한 장을 ~150px 로 눌러 "이용권 등록" 이 두 줄로 꺾이고 주소가 잘렸다. → 폭 전체를 쓰는 **행 목록**. 버튼은 줄바꿈 금지,
          현재 좌석은 카드 색면 대신 이름 옆 체크 하나. */}
      <div className="-mx-4 -mb-4 divide-y divide-rule border-t border-rule">
        {registered.map(s => {
          const active = s.seller_id === currentId
          return (
            <div key={s.seller_id} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[13px] font-extrabold text-gray-900">
                  <span className="truncate">{storeLabel(s)}</span>
                  {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-text" aria-label={t('seller.stores.current', { defaultValue: '현재 매장' })} />}
                </p>
                {s.address && (
                  <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11.5px] text-gray-500">
                    <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{s.address}</span>
                  </p>
                )}
                <p className="mt-0.5 text-[10.5px] font-semibold text-gray-400">
                  {isApproved(s)
                    ? t('seller.stores.operating', { defaultValue: '운영 중' })
                    : t('seller.stores.pending', { defaultValue: '승인 대기 (사업자 확인 중)' })}
                  {s.role === 'operator' && ` · ${t('seller.stores.delegated', { defaultValue: '위임' })}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => registerVoucherFor(s)}
                  disabled={switching != null}
                  className={`ur-btn ur-btn-sm flex-1 whitespace-nowrap sm:flex-none ${isApproved(s) ? 'ur-btn-primary' : 'ur-btn-secondary'}`}
                >
                  {switching === s.seller_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
                  {t('seller.registerVoucher', { defaultValue: '이용권 등록' })}
                </button>
                {/* 🏪 2026-09-16: 모달 → 업체 정보 한 페이지(`/seller/store`). 같은 모달이 여기와
                    `/seller/stores` 두 곳에서 열리고 있었다 — 한 곳만 고치면 다른 쪽이 옛 화면으로 남는다. */}
                <Link
                  to={`/seller/store?id=${s.seller_id}`}
                  className="ur-btn ur-btn-sm ur-btn-secondary whitespace-nowrap"
                >
                  <Settings2 className="h-3.5 w-3.5" /> {t('seller.stores.info', { defaultValue: '정보' })}
                </Link>
              </div>
            </div>
          )
        })}
        {/* 🛠️ 2026-09-15 (대표 *"3번째 이미지에선 내 매장 관리가 가능해야 할 것 같아"*): 이 카드의 행동은
            [이용권 등록]·[정보] 둘뿐이었고, 위임·삭제·이관은 `/seller/stores` 에만 있어 **더보기를 거쳐야만**
            닿았다. 버튼을 셋으로 늘리면 폰에서 줄이 꺾이므로, 목록의 마지막 줄로 내보낸다. */}
        <Link
          to="/seller/stores"
          className="flex items-center justify-between px-4 py-2.5 text-[12px] font-bold text-gray-500 hover:bg-gray-50"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            {t('seller.stores.manageAll', { defaultValue: '매장 관리 · 위임 · 삭제' })}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Link>
      </div>
      {adding && <StoreRegisterModal onClose={() => setAdding(false)} onDone={onRegistered} />}
    </div>
  )
}
