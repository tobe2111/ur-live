import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import { compressForUpload } from '@/lib/image-compress'

/**
 * 🖼️ **사진 여러 장 편집기** (2026-09-03 대표 *"이용권에 사진 여러 장 올릴 수 있어야하는데
 * 그렇게 안되어있네?"* → 시안 승인 *"응응 그렇게 하자. 상한도 두고"*).
 *
 * ## 왜 없었나
 * 등록 폼이 든 사진 칸은 `image_url` **하나뿐**이었다. 반면 소비자 화면은 진작부터 여러 장을
 * 지원한다 — 홈 카드는 넘겨 보는 캐러셀(서버가 카드당 3장으로 잘라 보낸다), 상세는 2단 갤러리.
 * **보여 줄 자리는 있는데 넣을 자리가 없는** 상태였다.
 *
 * ## 첫 장이 대표다
 * 별도의 "대표 지정" 스위치를 두지 않는다. 순서가 곧 의미다(첫 장 = 카드·검색에 쓰이는 사진).
 * 스위치를 따로 두면 `image_url` 과 배열이 어긋나는 상태가 생기고, 그건 화면마다 다른 사진이
 * 뜨는 사고가 된다.
 *
 * ## 💰 상한이 있는 이유는 트래픽이다
 * 카드 50장이 각자 사진을 전부 받으면 첫 화면 요청이 몇 배가 된다. 서버는 이미 카드당 3장으로
 * 자르고(`sliceCardGallery`), 여기서는 **5장**에서 막는다. 업로드는 클라에서 압축(WebP 1280px)
 * 후 R2 로 올라가고 **주소만** 저장된다 — base64 를 행에 담던 옛 방식으로 돌아가지 말 것
 * (목록 응답·임시저장까지 수백 KB 를 끌고 다녔다).
 *
 * ## 순서 바꾸기는 드래그가 아니라 ←→ 다
 * 시안에는 "끌어서"라고 적었지만, 셀러의 상당수가 폰에서 등록한다. HTML5 드래그는 터치에서
 * 사실상 동작하지 않는다 — 되는 척하는 것보다 되는 걸 준다.
 */
export const PHOTO_MAX = 5

interface Props {
  photos: string[]
  onChange: (next: string[]) => void
  max?: number
  /** 첫 장이 비었을 때 자리에 보일 문구 */
  emptyHint?: string
}

export default function PhotoGalleryEditor({ photos, onChange, max = PHOTO_MAX, emptyHint }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const full = photos.length >= max

  /** 업로드 → 압축 → R2. 실패해도 등록은 계속돼야 하므로 data URL 로 폴백(fail-soft). */
  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = max - photos.length
    if (room <= 0) { toast.error(t('seller.photo.limit', { defaultValue: `사진은 최대 ${max}장까지 올릴 수 있어요` })); return }
    setBusy(true)
    const added: string[] = []
    for (const f of Array.from(files).slice(0, room)) {
      if (f.size > 5 * 1024 * 1024) { toast.error(t('seller.mealVoucher.imageSizeLimit', { defaultValue: '5MB 이하 이미지만 업로드 가능합니다' })); continue }
      try {
        const compressed = await compressForUpload(f, { maxSizeMB: 0.3, maxWidthOrHeight: 1280, toWebP: true })
        try {
          const fd = new FormData()
          fd.append('file', new File([compressed], 'voucher.webp', { type: compressed.type || 'image/webp' }))
          const token = getSellerToken()
          const res = await api.post('/api/upload/image', fd, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'multipart/form-data' },
          })
          const url = res.data?.data?.url
          if (!res.data?.success || !url) throw new Error('upload failed')
          added.push(url)
        } catch {
          const dataUrl: string = await new Promise((resolve) => {
            const r = new FileReader()
            r.onload = () => resolve(r.result as string)
            r.readAsDataURL(compressed)
          })
          added.push(dataUrl)
        }
      } catch {
        toast.error(t('common.uploadFailed', { defaultValue: '업로드 실패' }))
      }
    }
    setBusy(false)
    if (added.length) {
      onChange([...photos, ...added].slice(0, max))
      toast.success(t('common.uploadComplete', { defaultValue: '업로드 완료' }))
    }
  }

  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= photos.length) return
    const next = [...photos]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const remove = (i: number) => onChange(photos.filter((_, k) => k !== i))

  return (
    <div className="space-y-2.5">
      {/* 대표(첫 장) — 크게 */}
      {photos[0] ? (
        <div className="relative inline-block">
          <img
            src={photos[0]}
            alt={t('seller.mealVoucher.mainImage', { defaultValue: '대표 이미지' })}
            className="w-full max-w-[240px] h-48 rounded-lg object-cover border border-gray-200"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.35' }}
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">
            {t('seller.photo.cover', { defaultValue: '대표' })}
          </span>
          <button
            type="button"
            onClick={() => remove(0)}
            aria-label={t('common.removeImage', { defaultValue: '이미지 제거' })}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
          >✕</button>
        </div>
      ) : (
        <div className="w-full max-w-[240px] h-48 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400 text-center px-4">
          {emptyHint || t('seller.photo.empty', { defaultValue: '사진을 고르면 여기에 보입니다' })}
        </div>
      )}

      {/* 나머지 장 — 썸네일 + 순서/삭제 */}
      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.slice(1).map((url, k) => {
            const i = k + 1
            return (
              <div key={`${url}-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.35' }} />
                <button
                  type="button" onClick={() => remove(i)}
                  aria-label={t('common.removeImage', { defaultValue: '이미지 제거' })}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] leading-none"
                >✕</button>
                <div className="absolute bottom-1 left-1 right-1 flex justify-between">
                  <button type="button" onClick={() => move(i, -1)} aria-label={t('seller.photo.moveLeft', { defaultValue: '앞으로' })}
                    className="w-5 h-5 rounded bg-black/55 text-white text-[10px] leading-none">←</button>
                  <button type="button" onClick={() => move(i, 1)} aria-label={t('seller.photo.moveRight', { defaultValue: '뒤로' })}
                    className="w-5 h-5 rounded bg-black/55 text-white text-[10px] leading-none"
                    disabled={i === photos.length - 1}>→</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={full || busy}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 hover:border-gray-400 disabled:opacity-40"
        >
          {busy
            ? t('seller.photo.uploading', { defaultValue: '올리는 중…' })
            : photos.length === 0
              ? t('seller.photo.pickFile', { defaultValue: '📁 내 파일에서' })
              : t('seller.photo.addMore', { defaultValue: '+ 사진 추가' })}
        </button>
        <span className="text-[11px] text-gray-500">
          {t('seller.photo.count', { defaultValue: `${photos.length} / ${max}장 · 첫 장이 대표 사진이에요` })}
        </span>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
      </div>
    </div>
  )
}
