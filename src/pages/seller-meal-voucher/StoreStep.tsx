/**
 * 🏪 위저드 1단계 — 매장 (2026-08-23 대표: "처음에 카카오맵으로 매장 검색하고 최대한 자동입력.
 *   매장 등록이 되어있으면 자동으로. 매장이 여러개면 선택하면 되고.")
 *
 * - 등록 매장이 있으면: 요약 카드(자동 상속) + 여러 매장이면 칩 선택(좌석 전환 = StoreSwitcher 와
 *   같은 토큰 스왑 — 권한 판정은 전적으로 서버).
 * - 없으면: 카카오맵 검색이 1단계의 주역. 선택 즉시 이름/주소/전화/좌표/플레이스 링크 자동입력.
 * - 아래 수동 필드는 항상 수정 가능(자동입력은 출발점이지 감옥이 아니다).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, CheckCircle, Store, Loader2, Search } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import StoreRegisterModal, { type RegisterPlace } from '@/components/seller/StoreRegisterModal'
import type { StoreContext, VoucherForm } from './voucher-form'

interface OperableStore {
  seller_id: number
  role: 'owner' | 'operator'
  business_name: string | null
  name: string | null
  username: string | null
}

const storeLabel = (s: OperableStore) => s.business_name || s.name || `매장 #${s.seller_id}`

/** 폼의 매장 필드 → 매장 등록 모달 프리필 (플레이스 id 는 저장해 둔 place_url 에서 복원). */
function formToRegisterPlace(f: VoucherForm): RegisterPlace {
  const id = f.kakao_place_url.match(/place\.map\.kakao\.com\/(\d+)/)?.[1]
  return {
    id,
    name: f.restaurant_name,
    address: f.restaurant_address,
    phone: f.restaurant_phone,
    place_url: f.kakao_place_url || undefined,
    lat: Number(f.restaurant_lat) || undefined,
    lng: Number(f.restaurant_lng) || undefined,
  }
}

interface Props {
  form: VoucherForm
  update: (key: string, value: string | number) => void
  onApplyContext: (ctx: StoreContext) => void
  onPlaceSelect: (p: KakaoPlace) => void
  placeSelected: boolean
  kakaoJsKey: string
  /** 🚪 2026-08-24 대표: 등록 매장이 없는 계정 — 매장 등록을 완료해야 다음 단계로 갈 수 있다. */
  storeRequired?: boolean
  /** 매장 등록+좌석 전환 완료 — 부모가 게이트를 연다. */
  onStoreReady?: () => void
}

export default function StoreStep({ form, update, onApplyContext, onPlaceSelect, placeSelected, kakaoJsKey, storeRequired, onStoreReady }: Props) {
  const { t } = useTranslation()
  const [stores, setStores] = useState<OperableStore[]>([])
  const [switching, setSwitching] = useState<number | null>(null)
  const [currentId, setCurrentId] = useState(() => Number(localStorage.getItem('seller_id') || 0))
  const hasStoreInfo = !!form.restaurant_name
  // 매장 정보가 이미 있으면 지도는 접어 둔다 — "다시 검색"으로 언제든 편다.
  const [showMap, setShowMap] = useState(!hasStoreInfo)
  const mapAutoOpened = useRef(false)
  // 🏪 2026-08-23 대표 "매장 등록에도 쓰이게": 지도에서 찾은 매장을 그 자리에서 매장 관리에 등록.
  const [registering, setRegistering] = useState(false)

  function loadStores() {
    api.get('/api/seller/my-stores')
      .then(r => { if (r.data?.success) setStores(r.data.data || []) })
      .catch(() => { /* 다매장 기능이 없어도 등록은 계속돼야 한다 */ })
  }
  useEffect(() => { loadStores() }, [])

  // 프리필이 나중에 도착해 매장 정보가 생기면 지도를 접는다(사용자가 연 적 없을 때만).
  useEffect(() => {
    if (hasStoreInfo && !mapAutoOpened.current) setShowMap(false)
  }, [hasStoreInfo])

  /** 🔁 다른 매장 선택 = 좌석 전환(StoreSwitcher 와 동일 계약) + 그 매장 정보로 프리필. */
  async function pickStore(s: OperableStore) {
    if (s.seller_id === currentId || switching != null) return
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
      setCurrentId(d.seller.id)
      const ctx = await api.get('/api/seller/stores/context')
      if (ctx.data?.success && ctx.data.data?.store) onApplyContext(ctx.data.data.store as StoreContext)
      toast.success(t('seller.mealVoucher.storeSwitched', { defaultValue: '매장을 전환했어요 — 이 매장으로 등록됩니다' }))
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax?.response?.data?.error || t('seller.mealVoucher.storeSwitchFailed', { defaultValue: '매장 전환에 실패했습니다' }))
    } finally {
      setSwitching(null)
    }
  }

  function openKakaoAddress() {
    // 다음 우편번호 서비스 (주소 검색 팝업) — external Kakao SDK, window cast acceptable
    const w = window as unknown as { daum?: { Postcode: new (opts: { oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void }) => { open: () => void } } }
    if (!w.daum?.Postcode) {
      const script = document.createElement('script')
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.onload = () => openKakaoAddress()
      document.head.appendChild(script)
      return
    }
    new w.daum.Postcode({
      oncomplete: async (data) => {
        const addr = data.roadAddress || data.jibunAddress
        update('restaurant_address', addr)
        try {
          const res = await fetch(`/api/kakao/place/address?query=${encodeURIComponent(addr)}`)
          const result: { data?: { documents?: { y: string; x: string }[] } } = await res.json()
          if (result.data?.documents?.[0]) {
            update('restaurant_lat', result.data.documents[0].y)
            update('restaurant_lng', result.data.documents[0].x)
          }
        } catch { /* ignore geocoding failure */ }
      }
    }).open()
  }

  return (
    <div className="space-y-4">
      {/* 다매장 선택 칩 — 전환할 곳이 있을 때만(1곳뿐이면 소음) */}
      {stores.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-gray-500" />
            {t('seller.mealVoucher.pickStore', { defaultValue: '어느 매장의 이용권인가요?' })}
          </p>
          <div className="flex flex-wrap gap-2">
            {stores.map(s => {
              const active = s.seller_id === currentId
              return (
                <button
                  key={s.seller_id}
                  type="button"
                  onClick={() => pickStore(s)}
                  disabled={switching != null}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
                    active ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {switching === s.seller_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : active && <CheckCircle className="w-3.5 h-3.5" />}
                  <span className="max-w-[160px] truncate">{storeLabel(s)}</span>
                  {s.role === 'operator' && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">위임</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.restaurantInfo')}</h2>
        </div>

        <div className="space-y-4">
          {/* 자동 상속된 매장 요약 — 있으면 지도 대신 이 카드가 먼저 */}
          {hasStoreInfo && !showMap && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="truncate">{form.restaurant_name}</span>
                </p>
                {form.restaurant_address && <p className="text-xs text-gray-600 mt-1 truncate">{form.restaurant_address}</p>}
                {form.restaurant_phone && <p className="text-[11px] text-gray-500 mt-0.5">{form.restaurant_phone}</p>}
                <p className="text-[10px] text-green-700 mt-1">{t('seller.mealVoucher.storeAutoFilled', { defaultValue: '등록된 매장 정보를 자동으로 불러왔어요' })}</p>
              </div>
              <button
                type="button"
                onClick={() => { mapAutoOpened.current = true; setShowMap(true) }}
                className="shrink-0 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 flex items-center gap-1 hover:border-gray-300"
              >
                <Search className="w-3.5 h-3.5" />
                {t('seller.mealVoucher.searchAgain', { defaultValue: '다시 검색' })}
              </button>
            </div>
          )}

          {/* 카카오맵 매장 검색 — 매장 정보가 없으면 이게 1단계의 주역 */}
          {showMap && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-bold text-gray-900">{t('seller.mealVoucher.findOnMap')}</label>
                  <p className="text-[11px] text-gray-500 mt-0.5">{t('seller.mealVoucher.findOnMapDesc')}</p>
                </div>
                {placeSelected && (
                  <div className="flex items-center gap-1 text-xs text-green-600 shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t('seller.mealVoucher.selected')}
                  </div>
                )}
              </div>
              <KakaoMapPicker
                kakaoJsKey={kakaoJsKey}
                selectedPlace={placeSelected && form.restaurant_lat ? {
                  name: form.restaurant_name,
                  address: form.restaurant_address,
                  lat: form.restaurant_lat,
                  lng: form.restaurant_lng,
                } : null}
                onSelect={onPlaceSelect}
              />
            </div>
          )}

          {/* 🏪 지도에서 방금 찾은 매장 → 매장 관리에 바로 등록(다음부터 자동 상속 + 다매장 목록).
              🚪 storeRequired(등록 매장 0)면 이 등록이 **필수** — 완료 전엔 다음 단계가 잠긴다. */}
          {(placeSelected || storeRequired) && (
            <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
              storeRequired ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-100'
            }`}>
              <p className="text-[11px] text-gray-700 leading-snug">
                {storeRequired
                  ? (placeSelected
                    ? t('seller.mealVoucher.registerStoreRequired', { defaultValue: '⚠️ 매장 등록이 필수예요 — [매장 등록]을 완료해야 다음 단계로 갈 수 있어요' })
                    : t('seller.mealVoucher.registerStoreFirst', { defaultValue: '⚠️ 첫 단계는 매장 등록이에요 — 위 지도에서 매장을 찾은 뒤 등록을 완료해주세요' }))
                  : t('seller.mealVoucher.registerStoreHint', { defaultValue: '이 매장을 매장 관리에 등록하면 다음부터 자동으로 불러와요' })}
              </p>
              <button
                type="button"
                onClick={() => setRegistering(true)}
                disabled={!form.restaurant_name}
                className="shrink-0 ml-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-40"
              >
                {t('seller.mealVoucher.registerStore', { defaultValue: '매장 등록' })}
              </button>
            </div>
          )}

          {/* 자동 입력된 정보 (수정 가능) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.restaurantNameLabel')} *</label>
            <input
              value={form.restaurant_name}
              onChange={e => update('restaurant_name', e.target.value)}
              placeholder={t('seller.mealVoucher.restaurantNamePlaceholder')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.addressLabel')}</label>
            <div className="flex gap-2 min-w-0">
              <input
                value={form.restaurant_address}
                onChange={e => update('restaurant_address', e.target.value)}
                placeholder={t('seller.mealVoucher.addressPlaceholder')}
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => openKakaoAddress()}
                className="shrink-0 whitespace-nowrap px-3 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium active:scale-95"
              >
                {t('seller.mealVoucher.postalCode')}
              </button>
            </div>
            {form.restaurant_lat && form.restaurant_lng && (
              <p className="text-[10px] text-green-600 mt-1">
                ✓ {t('seller.mealVoucher.coordinates')}: {Number(form.restaurant_lat).toFixed(6)}, {Number(form.restaurant_lng).toFixed(6)} ({t('seller.mealVoucher.shownOnMap')})
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.phoneLabel')}</label>
              <input
                value={form.restaurant_phone}
                onChange={e => update('restaurant_phone', e.target.value)}
                placeholder={t('seller.mealVoucher.addressPlaceholder')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('seller.mealVoucher.storeVerifyPin')} <span className="text-xs text-gray-400">(선택)</span>
              </label>
              <input
                value={form.store_verify_pin}
                onChange={e => update('store_verify_pin', e.target.value)}
                placeholder={t('seller.mealVoucher.pinPlaceholder')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {t('seller.mealVoucher.pinHint', { defaultValue: '식당 전화번호를 입력하시면 사장님께 통계 페이지 링크가 알림톡으로 자동 발송됩니다 (PIN 불필요).' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 매장 등록 모달 — 지도에서 찾은 매장이 미리 선택된 채 열린다 */}
      {registering && (
        <StoreRegisterModal
          initialPlace={formToRegisterPlace(form)}
          onClose={() => setRegistering(false)}
          onDone={async (newSellerId) => {
            setRegistering(false)
            loadStores()
            // 🚪 2026-08-24: 등록 즉시 그 매장 좌석으로 전환 — 이 이용권이 그 매장으로 귀속되고,
            //   매장 선행 게이트가 열린다. 승인 대기(pending)면 서버가 전환을 거부한다(의도된 잠금).
            if (newSellerId) {
              try {
                const r = await api.post(`/api/seller/stores/${newSellerId}/token`)
                const d = r.data?.data
                if (r.data?.success && d?.seller_token) {
                  localStorage.setItem('seller_token', d.seller_token)
                  localStorage.setItem('seller_id', String(d.seller.id))
                  if (d.seller.username) localStorage.setItem('seller_username', d.seller.username)
                  if (d.seller.business_name) localStorage.setItem('seller_name', d.seller.business_name)
                  localStorage.setItem('is_distributor', String(d.seller.is_distributor ?? 0))
                  setCurrentId(d.seller.id)
                  onStoreReady?.()
                  toast.success(t('seller.mealVoucher.storeRegisteredSwitched', { defaultValue: '매장이 등록됐어요 — 이 매장으로 이용권을 만들어요' }))
                  return
                }
              } catch { /* 승인 대기 등 — 아래 안내로 */ }
              toast.info(t('seller.mealVoucher.storePendingNotice', { defaultValue: '매장이 등록 접수됐어요 — 사업자 확인(승인) 후 이용권을 등록할 수 있어요' }))
              return
            }
            toast.success(t('seller.mealVoucher.storeRegistered', { defaultValue: '매장이 등록됐어요 — 매장 목록에서 선택할 수 있어요' }))
          }}
        />
      )}
    </div>
  )
}
