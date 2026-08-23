/**
 * 🏪 매장 등록 모달 — 카카오맵 지도 검색 + 자동입력 (2026-08-23 대표 "매장 등록에도 쓰이게 해줘")
 *
 * SellerStoresPage 인라인 모달을 추출·승격한 공용 컴포넌트:
 *   - ① 검색이 텍스트 목록 → **KakaoMapPicker(지도 시각화 + 마커 선택 + 자동입력)** 로 통일
 *     (이용권 등록 위저드 1단계와 같은 경험).
 *   - `initialPlace` 를 주면 그 매장이 미리 선택된 채 열린다 — 이용권 위저드에서 지도로 찾은
 *     매장을 그대로 매장 관리에 등록하는 다리.
 *   - ②채널(직접 10% / 중개 5%) ③국세청 사업자 확인 → POST /api/seller/stores 는 종전 계약 그대로.
 *     같은 카카오 플레이스 중복 등록은 서버가 409 로 막는다(어디서 열어도 안전).
 */
import { useState } from 'react'
import api from '@/lib/api'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { Loader2, MapPin, CheckCircle2, XCircle, BadgeCheck } from 'lucide-react'

export interface RegisterPlace {
  id?: string
  name: string
  address: string
  phone?: string
  category?: string
  place_url?: string
  lat?: number
  lng?: number
}

export function toRegisterPlace(p: KakaoPlace): RegisterPlace {
  return {
    id: p.id,
    name: p.place_name,
    address: p.road_address_name || p.address_name || '',
    phone: p.phone || '',
    category: p.category_name || '',
    place_url: p.id ? `https://place.map.kakao.com/${p.id}` : undefined,
    lat: Number(p.y) || undefined,
    lng: Number(p.x) || undefined,
  }
}

interface Props {
  initialPlace?: RegisterPlace | null
  onClose: () => void
  /** 등록 성공 — 서버 응답의 새 seller_id 를 넘긴다(목록 갱신용). */
  onDone: (sellerId?: number) => void
}

export default function StoreRegisterModal({ initialPlace, onClose, onDone }: Props) {
  const [picked, setPicked] = useState<RegisterPlace | null>(initialPlace ?? null)
  const [showMap, setShowMap] = useState(!initialPlace)
  const [channel, setChannel] = useState<'direct' | 'brokered' | null>(null)
  const [bno, setBno] = useState('')
  const [rep, setRep] = useState('')
  const [startDate, setStartDate] = useState('')
  const [nts, setNts] = useState<{ valid: boolean | null; message?: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  async function verify() {
    const clean = bno.replace(/-/g, '')
    if (!/^\d{10}$/.test(clean)) { alert('사업자번호는 숫자 10자리입니다'); return }
    setVerifying(true); setNts(null)
    try {
      const r = await api.post('/api/seller/stores/verify-business', {
        business_number: clean,
        ...(rep && startDate ? { representative: rep, start_date: startDate } : {}),
      })
      setNts(r.data?.data || null)
    } catch (e: any) {
      setNts({ valid: null, message: e?.response?.data?.error || '확인 실패' })
    } finally { setVerifying(false) }
  }

  async function submit() {
    if (!picked || !channel || submitting) return
    setSubmitting(true)
    try {
      const r = await api.post('/api/seller/stores', {
        name: picked.name,
        address: picked.address,
        phone: picked.phone,
        category: picked.category,
        kakao_place_id: picked.id,
        kakao_place_url: picked.place_url,
        lat: picked.lat, lng: picked.lng,
        channel,
        business_number: bno.replace(/-/g, '') || undefined,
        representative: rep || undefined,
        business_start_date: startDate || undefined,
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      alert(r.data.data?.message || '매장이 등록되었습니다')
      onDone(Number(r.data.data?.seller_id) || undefined)
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '등록에 실패했습니다')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-gray-900">매장 등록</h2>
          <button onClick={onClose} className="text-gray-400 text-sm px-2">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* ① 카카오맵 지도 검색 — 선택하면 이름/주소/전화/좌표/플레이스 링크 자동입력 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">① 카카오맵에서 내 매장 찾기</p>
            {picked && !showMap ? (
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{picked.name}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />{picked.address}
                  </p>
                </div>
                <button onClick={() => setShowMap(true)} className="text-[11px] text-gray-400 underline shrink-0 ml-2">다시 선택</button>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 p-2">
                <KakaoMapPicker
                  kakaoJsKey={KAKAO_JS_KEY}
                  selectedPlace={picked && picked.lat && picked.lng ? {
                    name: picked.name, address: picked.address, lat: String(picked.lat), lng: String(picked.lng),
                  } : null}
                  onSelect={(p) => { setPicked(toRegisterPlace(p)); setShowMap(false) }}
                />
              </div>
            )}
          </div>

          {/* ② 운영 방식 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">② 누가 운영하나요?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setChannel('direct')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'direct' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">내 가게예요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">사장님 직접 운영 · 수수료 10%</p>
              </button>
              <button onClick={() => setChannel('brokered')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'brokered' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">관리를 맡았어요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">중개·대행 운영 · 수수료 5%</p>
              </button>
            </div>
          </div>

          {/* ③ 사업자 확인 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">③ 사업자번호 확인 <span className="font-normal text-gray-400">(국세청 조회 — 통과 시 바로 활성화)</span></p>
            <div className="space-y-2">
              <input value={bno} onChange={e => setBno(e.target.value)} placeholder="사업자번호 10자리" inputMode="numeric" maxLength={12}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              <div className="grid grid-cols-2 gap-2">
                <input value={rep} onChange={e => setRep(e.target.value)} placeholder="대표자명 (진위확인용·선택)"
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
                <input value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="개업일 YYYYMMDD (선택)" inputMode="numeric" maxLength={8}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              </div>
              <button onClick={verify} disabled={verifying || !bno}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} 국세청 확인
              </button>
              {nts && (
                <p className={`text-[11px] flex items-center gap-1 ${nts.valid === true ? 'text-emerald-600' : nts.valid === false ? 'text-red-600' : 'text-gray-500'}`}>
                  {nts.valid === true ? <CheckCircle2 className="w-3.5 h-3.5" /> : nts.valid === false ? <XCircle className="w-3.5 h-3.5" /> : null}
                  {nts.valid === true ? `확인되었습니다${nts.message ? ` (${nts.message})` : ''}` : nts.valid === false ? '일치하지 않습니다 — 입력을 확인해주세요' : (nts.message || '확인 불가 — 등록 후 검토됩니다')}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button onClick={submit} disabled={!picked || !channel || submitting}
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
            {submitting ? '등록 중…' : '매장 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
