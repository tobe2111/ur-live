// 🧭 2026-07-01 (대표 — "수기로 진짜 매장 올리기"): 동네딜 직접 등록 폼(1건씩).
//   카카오 매장 검색(`/api/kakao/place/search`)으로 매장명·주소·좌표(x/y)·전화 자동완성 →
//   POST `/api/admin/dongnedeal/create` (좌표 저장 → 지도에 바로 마커). 라이트 테마(어드민, dark: 미사용).
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Search, PlusCircle, MapPin, CheckCircle2, AlertTriangle, Store, Image as ImageIcon, X, Pencil } from 'lucide-react'
import type { DealRow } from './types'

interface KakaoPlace {
  place_name: string
  road_address_name?: string
  address_name?: string
  phone?: string
  x: string // lng
  y: string // lat
  category_name?: string
  // 🎯 2026-07-01: 카카오 장소 페이지 직접 링크 — place_url(place.map.kakao.com/{id}) 또는 id.
  id?: string
  place_url?: string
}

const CATS = [
  { v: 'meal_voucher', label: '식사' },
  { v: 'beauty_voucher', label: '미용' },
  { v: 'etc_voucher', label: '기타' },
  { v: 'general', label: '일반' },
]

const EMPTY = { name: '', category: 'meal_voucher', price: '', original_price: '', restaurant_name: '', restaurant_address: '', restaurant_phone: '', image_url: '', description: '', max_per_person: '', kakao_place_url: '' }

export default function ManualDealForm({ onSaved, editDeal, onCancelEdit }: { onSaved: () => void; editDeal?: DealRow | null; onCancelEdit?: () => void }) {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [places, setPlaces] = useState<KakaoPlace[]>([])
  const [f, setF] = useState({ ...EMPTY })
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState<{ link: string; thumbnail: string }[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)

  const isEdit = !!editDeal

  // 🖊️ 수정 모드: editDeal 이 바뀌면 폼에 채우고 위로 스크롤(부모가 스크롤). 좌표도 복원.
  useEffect(() => {
    if (!editDeal) return
    setF({
      name: editDeal.name || '',
      category: editDeal.category || 'meal_voucher',
      price: String(editDeal.price ?? ''),
      original_price: editDeal.original_price ? String(editDeal.original_price) : '',
      restaurant_name: editDeal.restaurant_name || '',
      restaurant_address: editDeal.restaurant_address || '',
      restaurant_phone: '',
      image_url: editDeal.image_url || '',
      description: '',
      max_per_person: editDeal.max_per_person ? String(editDeal.max_per_person) : '',
      kakao_place_url: editDeal.kakao_place_url || '',
    })
    setCoord(editDeal.restaurant_lat && editDeal.restaurant_lng ? { lat: editDeal.restaurant_lat, lng: editDeal.restaurant_lng } : null)
    setPlaces([]); setPhotos([]); setQ('')
  }, [editDeal])

  const set = (k: keyof typeof f, v: string) => setF((prev) => ({ ...prev, [k]: v }))

  const resetForm = () => { setF({ ...EMPTY }); setCoord(null); setQ(''); setPlaces([]); setPhotos([]) }

  // 🖼️ 네이버 이미지 검색으로 매장 대표 사진 후보 가져오기 (카카오=정보·좌표, 네이버=사진).
  const fetchPhotos = async () => {
    const query = (f.restaurant_name || f.name || q).trim()
    if (!query) { toast.info('먼저 매장명을 입력/검색하세요'); return }
    setPhotoBusy(true); setPhotos([])
    try {
      const res = await api.get(`/api/naver/image/search?query=${encodeURIComponent(query)}&display=8`)
      const items: { link?: string; thumbnail?: string }[] = res.data?.data?.items || []
      const mapped = items.map((it) => ({ link: it.link || '', thumbnail: it.thumbnail || it.link || '' })).filter((x) => x.link)
      setPhotos(mapped)
      if (mapped.length === 0) toast.info('네이버 사진 결과가 없어요 (다른 매장명으로 시도)')
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      toast.error(status === 500 ? '네이버 키가 아직 설정 안 됐어요 (이미지 URL 직접 붙여넣기 가능)' : '네이버 사진 검색 실패')
    } finally { setPhotoBusy(false) }
  }

  const search = async () => {
    if (!q.trim()) return
    setSearching(true); setPlaces([])
    try {
      const res = await api.get(`/api/kakao/place/search?query=${encodeURIComponent(q.trim())}&size=10`)
      const docs: KakaoPlace[] = res.data?.data?.documents || []
      setPlaces(docs)
      if (docs.length === 0) toast.info('검색 결과가 없어요. 다른 이름/주소로 시도하세요')
    } catch {
      toast.error('매장 검색 실패 (카카오 키 미설정일 수 있어요)')
    } finally { setSearching(false) }
  }

  const pick = (p: KakaoPlace) => {
    const lat = Number(p.y), lng = Number(p.x)
    setCoord(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null)
    setF((prev) => ({
      ...prev,
      restaurant_name: p.place_name || '',
      restaurant_address: p.road_address_name || p.address_name || '',
      restaurant_phone: p.phone || '',
      name: prev.name || p.place_name || '', // 상품명 비면 매장명으로 시드
      // 🎯 2026-07-01: 카카오 장소 페이지 URL 캡처 → 상세 지도가 매장 페이지 직접 연결.
      kakao_place_url: p.place_url || (p.id ? `https://place.map.kakao.com/${p.id}` : ''),
    }))
    setQ(p.place_name || '')
    setPlaces([])
  }

  const submit = async () => {
    if (!f.name.trim()) { toast.error('상품명을 입력하세요'); return }
    if (!(Number(f.price.replace(/[^\d]/g, '')) > 0)) { toast.error('판매가를 입력하세요'); return }
    setBusy(true)
    try {
      const payload = { ...f, lat: coord?.lat, lng: coord?.lng }
      if (isEdit && editDeal) {
        const res = await api.patch(`/api/admin/dongnedeal/${editDeal.id}`, payload, h)
        if (res.data?.success) { toast.success('수정 저장됨'); onSaved() }
        else toast.error(res.data?.error || '수정 실패')
      } else {
        const res = await api.post('/api/admin/dongnedeal/create', payload, h)
        if (res.data?.success) {
          toast.success(res.data.hasCoord ? '동네딜 등록 완료 — 지도에도 바로 표시됩니다 ✅' : '동네딜 등록 완료 — 주소 지오코딩 후 지도에 표시돼요(자동)')
          setF({ ...EMPTY, category: f.category }); setCoord(null); setQ(''); setPlaces([]); setPhotos([])
          onSaved()
        } else toast.error(res.data?.error || '등록 실패')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEdit ? '수정 중 오류' : '등록 중 오류'))
    } finally { setBusy(false) }
  }

  const card = 'bg-white rounded-2xl border border-gray-200 p-5'
  const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none focus:border-gray-500'
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <div className={`${card} ${isEdit ? 'ring-2 ring-gray-900' : ''}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isEdit ? <Pencil className="w-4 h-4 text-gray-700" /> : <Store className="w-4 h-4 text-gray-700" />}
          <p className="text-sm font-bold text-gray-900 truncate">{isEdit ? `동네딜 수정 (#${editDeal?.id})` : '동네딜 직접 등록 (수기 · 1건씩)'}</p>
        </div>
        {isEdit && (
          <button onClick={() => { resetForm(); onCancelEdit?.() }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-800 shrink-0">
            <X className="w-3.5 h-3.5" /> 수정 취소
          </button>
        )}
      </div>
      <p className="text-[12px] text-gray-500 mb-4">카카오맵에서 <b>매장을 검색해 선택</b>하면 매장명·주소·좌표·전화가 자동으로 채워집니다. (좌표가 있어야 지도에 마커로 떠요)</p>

      {/* 카카오 매장 검색 */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
            placeholder="카카오맵에서 매장 검색 (예: 스타벅스 강남대로점)"
            className={input}
          />
          <button onClick={search} disabled={searching || !q.trim()} className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">
            <Search className="w-4 h-4" /> {searching ? '검색 중…' : '검색'}
          </button>
        </div>
        {places.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {places.map((p, i) => (
              <button key={i} onClick={() => pick(p)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{p.place_name}</p>
                <p className="text-[11px] text-gray-500 truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{p.road_address_name || p.address_name || '주소 없음'}{p.phone ? ` · ${p.phone}` : ''}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 좌표 상태 */}
      <div className="mt-2">
        {coord ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> 좌표 확보됨 — 지도에 바로 표시됩니다</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> 좌표 없음 — 매장 검색으로 선택하면 지도에 바로 떠요 (주소만이면 자동 지오코딩 대기)</span>
        )}
      </div>

      {/* 입력 필드 */}
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <div className="sm:col-span-2">
          <label className={lbl}>상품명 <span className="text-red-500">*</span></label>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="예: [강남] 한우 오마카세 2인" className={input} />
        </div>
        <div>
          <label className={lbl}>카테고리</label>
          <select value={f.category} onChange={(e) => set('category', e.target.value)} className={input}>
            {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label className={lbl}>판매가(원) <span className="text-red-500">*</span></label>
          <input value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="89000" className={input} />
        </div>
        <div>
          <label className={lbl}>정가(원, 선택 · 취소선)</label>
          <input value={f.original_price} onChange={(e) => set('original_price', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="140000" className={input} />
        </div>
        {/* 🎯 2026-07-01 (대표 "어드민 도구에도"): 1인당 최대 구매 수량 (0=무제한, 최대 99). */}
        <div>
          <label className={lbl}>1인당 최대 구매 수량 (0=무제한)</label>
          <input value={f.max_per_person} onChange={(e) => set('max_per_person', e.target.value.replace(/[^\d]/g, '').slice(0, 2))} inputMode="numeric" placeholder="0" className={input} />
        </div>
        <div>
          <label className={lbl}>매장명</label>
          <input value={f.restaurant_name} onChange={(e) => set('restaurant_name', e.target.value)} placeholder="한우공방 강남점" className={input} />
        </div>
        <div>
          <label className={lbl}>전화(선택)</label>
          <input value={f.restaurant_phone} onChange={(e) => set('restaurant_phone', e.target.value)} placeholder="02-000-0000" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>주소</label>
          <input value={f.restaurant_address} onChange={(e) => { set('restaurant_address', e.target.value); setCoord(null) }} placeholder="서울 강남구 봉은사로 …" className={input} />
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-500">대표 사진</label>
            <button type="button" onClick={fetchPhotos} disabled={photoBusy} className="inline-flex items-center gap-1 text-[12px] font-bold text-gray-700 hover:text-gray-900 disabled:opacity-50">
              <ImageIcon className="w-3.5 h-3.5" /> {photoBusy ? '검색 중…' : '네이버에서 사진 가져오기'}
            </button>
          </div>
          <input value={f.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://… (네이버 검색으로 채우거나 직접 붙여넣기 · 비우면 카테고리 기본)" className={input} />
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {photos.map((p, i) => (
                <button
                  type="button" key={i}
                  onClick={() => { set('image_url', p.link); setPhotos([]) }}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 ${f.image_url === p.link ? 'border-gray-900' : 'border-gray-100'} hover:border-gray-400`}
                >
                  <img src={p.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy"
                    onError={(e) => { const b = (e.currentTarget.closest('button') as HTMLElement | null); if (b) b.style.display = 'none' }} />
                </button>
              ))}
            </div>
          )}
          {f.image_url && (
            <div className="mt-2 flex items-center gap-2">
              <img src={f.image_url} alt="미리보기" className="w-16 h-16 rounded-lg object-cover border border-gray-200" onError={(e) => { e.currentTarget.style.opacity = '0.25' }} />
              <span className="text-[11px] text-gray-400">선택된 대표 사진 미리보기 — 흐리게 보이면 안 열리는 이미지예요(다른 사진 선택)</span>
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>설명(선택)</label>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="2인 한우 코스 · 결제 즉시 이용권 발급" className={input} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-black disabled:opacity-50">
          {isEdit ? <Pencil className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />} {busy ? '저장 중…' : isEdit ? '수정 저장' : '동네딜 추가'}
        </button>
        <span className="text-[11px] text-gray-400">{isEdit ? '변경 즉시 반영됩니다.' : '등록 즉시 동네딜(홈·리스트·지도)에 노출됩니다.'}</span>
      </div>
    </div>
  )
}
