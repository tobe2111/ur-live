/**
 * 📷 이용권 사진 한 장 올리기 — 첫 이용권 화면 전용(2026-11-03 대표 *"사장님이 자신의 사진을 첨부파일로 올릴 수 있는게 최우선"*).
 *
 * 길은 대시보드의 `PhotoGalleryEditor` 와 **같다**: 세 크기로 줄여 `/api/upload/image-sized` → 안 되면 한 장으로 줄여
 * `/api/upload/image`. 다른 점 하나 — **실패하면 data URL 로 바꿔 넣지 않는다.** 그 부품은 "등록은 계속돼야 한다"며
 * data URL 을 상품 사진 칸에 그대로 넣는데, 이 화면은 사진이 **필수**라 실패를 사진으로 위장하면 안 된다(안 올라간
 * 사진이 대표 사진이 되어 카드에 수백 KB 문자열이 실린다). 실패는 실패로 돌려주고 화면이 다시 시도하게 한다.
 */
import api from '@/lib/api'
import { uploadSizedImage } from '@/lib/image-sized'
import { getSellerToken } from '@/lib/seller-auth'
import { prepareImageForUpload, UploadTooLargeError, uploadTooLargeMessage } from '@/lib/prepare-upload'

export type UploadResult = { ok: true; url: string } | { ok: false; message: string }

export async function uploadVoucherPhoto(file: File): Promise<UploadResult> {
  const token = getSellerToken()
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  const sized = await uploadSizedImage(file, async (fd) => {
    const res = await api.post('/api/upload/image-sized', fd, { headers: { ...auth, 'Content-Type': 'multipart/form-data' } })
    return res.data
  }).catch(() => null)
  if (sized) return { ok: true, url: sized }
  try {
    const small = await prepareImageForUpload(file, { size: { maxSizeMB: 0.3, maxWidthOrHeight: 1280 } })
    const fd = new FormData()
    fd.append('file', new File([small], 'voucher.webp', { type: small.type || 'image/webp' }))
    const res = await api.post('/api/upload/image', fd, { headers: { ...auth, 'Content-Type': 'multipart/form-data' } })
    const url = res.data?.data?.url
    if (res.data?.success && url) return { ok: true, url }
    return { ok: false, message: '사진을 올리지 못했어요. 다시 시도해 주세요' }
  } catch (e) {
    return { ok: false, message: e instanceof UploadTooLargeError ? uploadTooLargeMessage(e) : '사진을 올리지 못했어요. 다시 시도해 주세요' }
  }
}

/** 네이버 이미지 검색 — 대시보드 등록 화면과 같은 길(`/api/naver/image/search`). http 주소는 https 로 바꾼다. */
export async function searchNaverPhotos(query: string, display = 9): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const res = await api.get(`/api/naver/image/search?query=${encodeURIComponent(q)}&display=${display}`)
    const items: Array<{ link?: string }> = res.data?.data?.items || []
    // 같은 사진이 여러 번 오면 한 번만 — 안 그러면 하나를 골라도 여러 칸에 같이 표시된다.
    return Array.from(new Set(items.map((i) => (i.link || '').replace(/^http:\/\//, 'https://')).filter(Boolean)))
  } catch { return [] }
}

/** 주소에서 동(洞) 하나 — 검색어를 좁힌다(종전 등록 화면과 같은 규칙). */
export function dongOf(address?: string): string {
  return (address || '').match(/[가-힣]+(동|읍|면|로|길)\s*\d*/)?.[0]?.replace(/\s*\d+/, '') || ''
}

export const PHOTO_MAX = 5
