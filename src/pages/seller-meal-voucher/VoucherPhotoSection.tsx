import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/useToast'
import PhotoGalleryEditor, { PHOTO_MAX } from '@/components/seller/PhotoGalleryEditor'
import type { VoucherForm } from './voucher-form'

/**
 * 📸 **이용권 사진** — 2026-09-03 대표 시안 승인(*"응응 그렇게 하자. 상한도 두고"*).
 *
 * ## 무엇이 달라졌나
 * 종전엔 첫 사진을 넣기까지 층이 여섯이었다(안내 일러스트 · 미리보기 · **이미지 URL 칸** ·
 * 지도 프리셋 · 파일 업로드 · 재검색 · 추천 그리드). 대표 지시로 **일러스트와 상시 URL 칸을 없애고**
 * 실제로 쓰는 길 둘 — **지도에서 가져오기 / 내 파일에서** — 을 맨 위에 둔다. 나머지는 누른 뒤에 펼쳐진다.
 *
 * ## 🔑 URL 칸을 왜 완전히 없애지 않았나 (대표 확인 후 1안)
 * **카카오맵은 공개 API 가 장소 사진을 주지 않는다.** 그래서 지금 방식은 그 매장의 카카오맵 페이지를
 * 열어 주고 셀러가 사진 주소를 복사해 붙여넣는 것이다. 상시 칸을 그냥 지우면 **그 경로가 통째로 끊긴다.**
 * ⇒ 평소 화면엔 칸이 없고, **카카오맵을 여는 사람에게만** 그 자리에서 붙여넣기 칸이 열린다.
 * (2안 "카카오맵 버튼도 제거"를 고르면 이 블록과 `kakao_place_url` 사용처만 지우면 된다.)
 *
 * ## 사진은 이제 여러 장
 * `PhotoGalleryEditor`(공용)가 최대 5장을 관리하고 **첫 장이 대표**다. 첫 장은 `image_url` 로도
 * 미러링해서 저장한다 — 소비자 카드·검색·OG 가 그 컬럼을 읽기 때문이다. 둘이 어긋나면 화면마다
 * 다른 사진이 뜬다.
 */
interface Props {
  form: VoucherForm
  update: (key: string, value: string | number | string[]) => void
  suggestedImages: string[]
  loadingImages: boolean
  onSearchImages: (query: string) => void
}

export default function VoucherPhotoSection({ form, update, suggestedImages, loadingImages, onSearchImages }: Props) {
  const { t } = useTranslation()
  const [mapOpen, setMapOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')

  const photos = form.images
  const setPhotos = (next: string[]) => {
    const capped = next.slice(0, PHOTO_MAX)
    update('images', capped)
    update('image_url', capped[0] || '')  // 대표 = 첫 장(카드·검색·OG 가 읽는 컬럼)
  }
  const addPhoto = (url: string) => {
    const u = url.trim()
    if (!u) return
    if (photos.includes(u)) { toast.error(t('seller.photo.dup', { defaultValue: '이미 담긴 사진이에요' })); return }
    if (photos.length >= PHOTO_MAX) { toast.error(t('seller.photo.limit', { defaultValue: `사진은 최대 ${PHOTO_MAX}장까지 올릴 수 있어요` })); return }
    setPhotos([...photos, u])
    toast.success(t('seller.mealVoucher.imageSelected'))
  }

  const runSearch = (suffix: string) => {
    const addr = form.restaurant_address || ''
    const dong = addr.match(/[가-힣]+(동|읍|면|로|길)\s*\d*/)?.[0]?.replace(/\s*\d+/, '') || ''
    onSearchImages([form.restaurant_name, dong, suffix].filter(Boolean).join(' '))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">📸</span>
        <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.mainImage')}</h2>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        {t('seller.mealVoucher.photoLead', { defaultValue: '매장 사진을 가져오거나, 직접 찍은 사진을 올려 주세요. 첫 장이 대표 사진이에요.' })}
      </p>

      {/* ① 두 개의 길 — 맨 위 */}
      <div className="flex gap-2 mb-3">
        {form.restaurant_name && (
          <button
            type="button"
            onClick={() => { const open = !mapOpen; setMapOpen(open); if (open && suggestedImages.length === 0) runSearch('') }}
            aria-expanded={mapOpen}
            className={`flex-1 px-3 py-3 rounded-xl text-[13px] font-bold border transition-colors ${
              mapOpen ? 'bg-brand text-white border-brand' : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
            }`}
          >
            🗺️ {t('seller.mealVoucher.fromMapShort', { defaultValue: '지도에서 가져오기' })}
          </button>
        )}
      </div>

      {/* ② 고른 사진들 (첫 장 = 대표) + 파일 업로드 버튼 */}
      <PhotoGalleryEditor photos={photos} onChange={setPhotos} />

      {/* ③ 지도 패널 — 누른 뒤에만 */}
      {mapOpen && form.restaurant_name && (
        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'place', label: t('seller.mealVoucher.mapPhotoPlace', { defaultValue: '매장 사진' }), suffix: '' },
              { key: 'food', label: t('seller.mealVoucher.mapPhotoFood', { defaultValue: '음식·메뉴' }), suffix: '메뉴' },
              { key: 'interior', label: t('seller.mealVoucher.mapPhotoInterior', { defaultValue: '매장 내부' }), suffix: '내부' },
            ].map(preset => (
              <button key={preset.key} type="button" onClick={() => runSearch(preset.suffix)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:border-gray-400">
                {preset.label}
              </button>
            ))}
            {form.kakao_place_url && (
              <a href={form.kakao_place_url} target="_blank" rel="noopener noreferrer"
                onClick={() => setPasteOpen(true)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:border-gray-400">
                {t('seller.mealVoucher.openKakaoPlace', { defaultValue: '카카오맵에서 보기 ↗' })}
              </a>
            )}
          </div>

          {/* 🔑 카카오맵을 연 사람에게만 붙여넣기 칸 — 그 사진은 자동으로 못 가져온다(공개 API 부재). */}
          {pasteOpen && (
            <div className="rounded-lg border border-gray-200 bg-white p-2.5">
              <p className="text-[11px] font-bold text-gray-700 mb-1.5">
                {t('seller.mealVoucher.pasteTitle', { defaultValue: '카카오맵 사진 주소 붙여넣기' })}
              </p>
              <div className="flex gap-1.5">
                <input
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhoto(pasted); setPasted('') } }}
                  placeholder={t('seller.mealVoucher.pastePlaceholder', { defaultValue: '사진에서 마우스 오른쪽 → 이미지 주소 복사' })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-brand focus:outline-none"
                />
                <button type="button" onClick={() => { addPhoto(pasted); setPasted('') }}
                  className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold">
                  {t('common.add', { defaultValue: '담기' })}
                </button>
              </div>
            </div>
          )}

          <input
            placeholder={t('seller.mealVoucher.imageSearchPlaceholder', { defaultValue: '다른 키워드로 이미지 재검색 (예: 가게 인테리어, 대표 메뉴 이름)' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-brand focus:outline-none"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const q = (e.target as HTMLInputElement).value.trim()
              if (q) onSearchImages(q)
            }}
          />

          {loadingImages && <p className="text-xs text-gray-500">{t('seller.mealVoucher.searchingImages')}</p>}
          {suggestedImages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">{t('seller.mealVoucher.suggestedImages')}</p>
              <div className="grid grid-cols-3 gap-2">
                {suggestedImages.map((url, i) => (
                  <button key={i} type="button" onClick={() => addPhoto(url)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      photos.includes(url) ? 'border-brand ring-2 ring-brand/25' : 'border-gray-200 hover:border-gray-400'
                    }`}>
                    <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
