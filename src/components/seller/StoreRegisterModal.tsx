/**
 * 🏪 매장 등록 모달 — 카카오맵 지도 검색 + 자동입력 (2026-08-23 대표 "매장 등록에도 쓰이게 해줘")
 *
 * SellerStoresPage 인라인 모달을 추출·승격한 공용 컴포넌트:
 *   - ① 검색이 텍스트 목록 → **KakaoMapPicker(지도 시각화 + 마커 선택 + 자동입력)** 로 통일
 *     (이용권 등록 위저드 1단계와 같은 경험).
 *   - `initialPlace` 를 주면 그 매장이 미리 선택된 채 열린다 — 이용권 위저드에서 지도로 찾은
 *     매장을 그대로 매장 관리에 등록하는 다리.
 *   - ②채널(직접/중개) ③국세청 사업자 확인 → POST /api/seller/stores 는 종전 계약 그대로.
 *
 *   ⚠️ 2026-08-26 (대표): **선택지에 수수료율을 표시하지 않는다.** 가격표를 나란히 붙이면
 *   사장님이 '싼 쪽'(중개 5%)을 고르게 되고 — 채널은 사실(누가 운영하는가)이지 고르는 요금제가
 *   아니다. 잘못 고르면 유어딜 수입이 깎이고 소유권 판정(owner/operator)까지 틀어진다.
 *   실제 수수료는 이용권 등록의 '실수령가' 카드가 건별로 보여 준다(고를 수 없는 자리에서).
 *     같은 카카오 플레이스 중복 등록은 서버가 409 로 막는다(어디서 열어도 안전).
 */
import { useState } from 'react'
import api from '@/lib/api'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { formatPhone, isValidMobilePhone, digitsOnly } from '@/utils/format-phone'
import { readStoreReferrer, clearStoreReferrer } from '@/utils/store-referrer'
import { Loader2, MapPin, CheckCircle2, XCircle, BadgeCheck, FileImage } from 'lucide-react'

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
  const [managerPhone, setManagerPhone] = useState('')
  const [bno, setBno] = useState('')
  // 📄 2026-08-26 (대표 "당근마켓 플로우 정도로 하자"): 대표자명·개업일 **타이핑을 없앴다**.
  //   사장님이 외워서 적을 값이 아니고(개업일은 검색으로도 나온다) 위조도 쉽다. 당근처럼
  //   **등록증 사진**을 받고 사람이 심사한다(시안 05). 그 사진이 심사의 근거다.
  const [certUrl, setCertUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [nts, setNts] = useState<{ valid: boolean | null; message?: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  async function verify() {
    const clean = bno.replace(/-/g, '')
    if (!/^\d{10}$/.test(clean)) { alert('사업자번호는 숫자 10자리입니다'); return }
    setVerifying(true); setNts(null)
    try {
      const r = await api.post('/api/seller/stores/verify-business', { business_number: clean })
      setNts(r.data?.data || null)
    } catch (e: any) {
      setNts({ valid: null, message: e?.response?.data?.error || '확인 실패' })
    } finally { setVerifying(false) }
  }

  const managerOk = isValidMobilePhone(managerPhone)
  const certOk = !!certUrl

  async function uploadCert(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/api/upload/business-cert', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = r.data?.data?.url
      if (!r.data?.success || !url) throw new Error(r.data?.error || '업로드 실패')
      setCertUrl(url)
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '사업자등록증 업로드에 실패했습니다')
    } finally { setUploading(false) }
  }

  async function submit() {
    if (!picked || !channel || !managerOk || !certOk || submitting) return
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
        manager_phone: digitsOnly(managerPhone),
        business_number: bno.replace(/-/g, '') || undefined,
        business_cert_url: certUrl,
        // 🤝 2026-08-27: 소개자 초대 링크(`/store/new?ref=`)로 들어왔으면 그 사람에게 귀속된다.
        //   ⚠️ sessionStorage 를 거치는 이유 — 로그인이 필요한 페이지라 카카오를 다녀오면
        //   쿼리스트링이 날아간다. 그 사이 ref 를 잃으면 소개자가 보상을 못 받는다.
        referrer_user_id: readStoreReferrer() || undefined,
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      clearStoreReferrer()
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

          {/* ② 담당자 연락처 — 매장 대표번호(위에서 자동입력)와 별개인 '사람' 연락처 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">② 담당자 전화번호</p>
            <input
              value={formatPhone(managerPhone)}
              onChange={e => setManagerPhone(e.target.value)}
              placeholder="010-0000-0000"
              inputMode="tel"
              autoComplete="tel"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              이 매장을 관리하는 분의 휴대폰 번호예요. 승인·사용 문의·정산 확인 때 연락드립니다.
              {picked?.phone && <span className="text-gray-400"> (매장 대표번호 {picked.phone} 와는 별개)</span>}
            </p>
            {managerPhone && !managerOk && (
              <p className="text-[11px] text-red-600 mt-1">휴대폰 번호(01x)로 입력해주세요</p>
            )}
          </div>

          {/* ③ 운영 방식 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">③ 누가 운영하나요?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setChannel('direct')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'direct' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">내 가게에요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">제가 사장이고, 직접 운영해요</p>
              </button>
              <button onClick={() => setChannel('brokered')}
                className={`p-3 rounded-xl border text-left transition ${channel === 'brokered' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-bold text-gray-900">중개·대행사에요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">사장님을 대신해 등록·관리해요</p>
              </button>
            </div>
          </div>

          {/* ④ 사업자 확인 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">④ 사업자 확인 <span className="font-normal text-gray-400">(등록증 확인 후 활성화)</span></p>
            <div className="space-y-2">
              <input value={bno} onChange={e => setBno(e.target.value)} placeholder="사업자번호 10자리" inputMode="numeric" maxLength={12}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
              {/* 📄 사업자등록증 사본 — 개업일·대표자명을 외워 적는 대신 사진 1장. 이게 심사의 근거다. */}
              <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed cursor-pointer ${certUrl ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-gray-50'}`}>
                <input
                  type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void uploadCert(f); e.target.value = '' }}
                />
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                  : certUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <FileImage className="w-4 h-4 text-gray-400 shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-gray-900">
                    {uploading ? '올리는 중…' : certUrl ? '사업자등록증 첨부됨' : '사업자등록증 사진 첨부'}
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    {certUrl ? '다시 누르면 교체할 수 있어요' : '내용이 잘 보이는 사진으로 · 10MB 이하 jpg·png'}
                  </span>
                </span>
              </label>
              <button onClick={verify} disabled={verifying || !bno}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} 국세청 확인
              </button>
              {nts && (
                <p className={`text-[11px] flex items-center gap-1 ${nts.valid === true ? 'text-emerald-600' : nts.valid === false ? 'text-red-600' : 'text-gray-500'}`}>
                  {nts.valid === true ? <CheckCircle2 className="w-3.5 h-3.5" /> : nts.valid === false ? <XCircle className="w-3.5 h-3.5" /> : null}
                  {nts.valid === true ? `국세청에 등록된 번호예요${nts.message ? ` (${nts.message})` : ''}` : nts.valid === false ? '조회되지 않는 번호예요 — 입력을 확인해주세요' : (nts.message || '확인 불가 — 등록 후 검토됩니다')}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button onClick={submit} disabled={!picked || !channel || !managerOk || !certOk || submitting}
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
            {submitting ? '등록 중…' : '매장 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
