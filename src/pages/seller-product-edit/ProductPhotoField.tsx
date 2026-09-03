import { useTranslation } from 'react-i18next'
import ImageUpload from '@/components/ImageUpload'
import PhotoGalleryEditor from '@/components/seller/PhotoGalleryEditor'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'

/**
 * 🖼️ 상품 수정 화면의 사진 칸 (2026-09-03 대표 "이용권에 사진 여러 장").
 *
 * **이용권은 등록 폼과 같은 갤러리 편집기**를 쓴다 — 등록에서 5장을 넣었는데 수정 화면이 1장짜리면
 * 한 번 저장할 때마다 나머지가 사라진다. 쇼핑 상품은 종전 단일 업로더 유지(이번 요청 범위 밖이고,
 * 두 흐름을 한꺼번에 바꾸면 회귀 범위가 커진다).
 */
export function parseProductPhotos(product: { images?: unknown; image_url?: string | null }): string[] {
  // `images` 가 없던 시절의 상품은 대표 1장뿐 — 그것을 첫 장으로 세운다. 안 그러면 편집기가
  // "0장"으로 보이고 한 번 손대면 원래 사진이 사라진다.
  try {
    const raw = product.images
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(arr)) {
      const list = arr.filter((u): u is string => typeof u === 'string' && !!u)
      if (list.length) return list
    }
  } catch { /* 형식이 깨졌으면 대표 1장으로 */ }
  return product.image_url ? [product.image_url] : []
}

interface Props {
  category: string
  photos: string[]
  imageUrl: string
  onPhotos: (next: string[]) => void
  onImageUrl: (url: string) => void
}

export default function ProductPhotoField({ category, photos, imageUrl, onPhotos, onImageUrl }: Props) {
  const { t } = useTranslation()
  if (!isVoucherCategory(category)) {
    return <ImageUpload value={imageUrl} onChange={onImageUrl} label={t('seller.productImage')} maxSizeKB={800} />
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{t('seller.productImage')}</label>
      <PhotoGalleryEditor photos={photos} onChange={onPhotos} />
    </div>
  )
}
