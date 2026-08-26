/**
 * 🏪 매장 정보 수정 모달 — 단일화의 사용자 접점 (2026-08-23 대표 "그냥 지금 하자")
 *   여기서 저장하면 seller_meta canonical + sellers 라벨 + **그 매장의 모든 이용권 복사본**이
 *   한 번에 동기화된다(서버 PATCH /stores/:id/profile 이 전파 — store-profile.ts SSOT).
 *   위치/전화가 바뀌었으면 지도 재선택으로 좌표까지 갱신.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { formatPhone, isValidMobilePhone, digitsOnly } from '@/utils/format-phone'
import { Loader2, MapPin } from 'lucide-react'

interface Props {
  sellerId: number
  storeName?: string
  onClose: () => void
  onDone: (propagated: number) => void
}

export default function StoreProfileModal({ sellerId, storeName, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [placeUrl, setPlaceUrl] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [productCount, setProductCount] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [saving, setSaving] = useState(false)
  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  useEffect(() => {
    let alive = true
    api.get(`/api/seller/stores/${sellerId}/profile`)
      .then(r => {
        if (!alive || !r.data?.success) return
        const s = r.data.data?.store || {}
        setName(s.name || ''); setAddress(s.address || ''); setPhone(s.phone || '')
        setPin(s.verify_pin || ''); setLat(s.lat || ''); setLng(s.lng || '')
        setPlaceUrl(s.kakao_place_url || '')
        // 담당자 번호는 store(전파 대상) 밖 — 소비자 복사본에 안 실리는 개인 연락처다.
        setManagerPhone(r.data.data?.manager_phone || '')
        setProductCount(Number(r.data.data?.product_count) || 0)
      })
      .catch(() => { /* 로드 실패 — 빈 폼으로 편집 가능 */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sellerId])

  function pickPlace(p: KakaoPlace) {
    setName(p.place_name || name)
    setAddress(p.road_address_name || p.address_name || address)
    if (p.phone) setPhone(p.phone)
    setLat(p.y || ''); setLng(p.x || '')
    if (p.id) setPlaceUrl(`https://place.map.kakao.com/${p.id}`)
    setShowMap(false)
  }

  async function save() {
    if (saving) return
    if (!name.trim()) { alert('매장 이름을 입력해주세요'); return }
    if (managerPhone && !isValidMobilePhone(managerPhone)) {
      alert('담당자 전화번호는 휴대폰 번호(01x)로 입력해주세요'); return
    }
    setSaving(true)
    try {
      const r = await api.patch(`/api/seller/stores/${sellerId}/profile`, {
        name: name.trim(), address: address.trim(), phone: phone.trim(),
        ...(managerPhone ? { manager_phone: digitsOnly(managerPhone) } : {}),
        ...(pin.trim() ? { verify_pin: pin.trim() } : {}),
        ...(lat && lng ? { lat, lng } : {}),
        ...(placeUrl ? { kakao_place_url: placeUrl } : {}),
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      onDone(Number(r.data.data?.propagated) || 0)
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '저장에 실패했습니다')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-gray-900 truncate">매장 정보 {storeName ? `— ${storeName}` : ''}</h2>
          <button onClick={onClose} className="text-gray-400 text-sm px-2">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {productCount > 0 && (
                <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  저장하면 이 매장의 이용권 <b>{productCount}개</b>에 모두 반영돼요 — 매장 정보는 여기 한 곳에서 관리합니다.
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">매장 이름</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">주소</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
                {lat && lng && (
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" /> 좌표 {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">전화</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">매장 확인 PIN <span className="font-normal text-gray-400">(선택)</span></label>
                  <input value={pin} onChange={e => setPin(e.target.value)} placeholder="비우면 기존 유지"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  담당자 전화번호 <span className="font-normal text-gray-400">(매장 대표번호와 별개 — 소비자에게 노출되지 않아요)</span>
                </label>
                <input value={formatPhone(managerPhone)} onChange={e => setManagerPhone(e.target.value)}
                  placeholder="010-0000-0000" inputMode="tel" autoComplete="tel"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              </div>
              <button type="button" onClick={() => setShowMap(v => !v)}
                className="w-full py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                🗺️ {showMap ? '지도 접기' : '지도에서 위치 다시 선택 (이전했거나 좌표가 틀릴 때)'}
              </button>
              {showMap && (
                <div className="rounded-lg border border-gray-200 p-2">
                  <KakaoMapPicker
                    kakaoJsKey={KAKAO_JS_KEY}
                    selectedPlace={lat && lng ? { name, address, lat, lng } : null}
                    onSelect={pickPlace}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button onClick={save} disabled={loading || saving}
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
            {saving ? '저장 중…' : productCount > 0 ? `저장하고 이용권 ${productCount}개에 반영` : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
