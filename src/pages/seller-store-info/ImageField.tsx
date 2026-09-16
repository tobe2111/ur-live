/**
 * 🖼️ 업체 정보의 이미지 칸 (대표 이미지·배너) — 2026-09-16.
 *
 * 종전엔 같은 업로드 코드가 `SellerMiniShopPage`(배너)와 `SellerProfileEditPage`(대표 이미지)에
 * **두 벌** 있었다. 한 페이지로 모으면서 부품 하나로 합친다 — 두 벌이면 한쪽만 고쳐지고,
 * 실제로 한쪽만 압축(`compressForUpload`)을 쓰고 있었다.
 *
 * ⚠️ 업로드가 끝나도 **저장된 것은 아니다**(URL 만 폼에 들어간다). 그 사실을 안내 문구가 말한다 —
 *    안 말하면 사장님이 업로드 직후 창을 닫고 "사진이 사라졌다" 고 신고한다.
 */
import { useRef, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { ImagePlus, Loader2, X } from 'lucide-react'
import api from '@/lib/api'
import { compressForUpload } from '@/lib/image-compress'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

interface Props {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  /** 미리보기 비율 — 배너는 가로로 길고 대표 이미지는 정사각이다. */
  aspect?: 'wide' | 'square'
}

export default function ImageField({ label, hint, value, onChange, aspect = 'wide' }: Props) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function pick(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 올릴 수 있어요'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('10MB 이하 이미지만 가능합니다'); return }
    setBusy(true)
    try {
      const c = await compressForUpload(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, toWebP: true })
      const up = c instanceof File ? c : new File([c], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('image', up)
      const res = await api.post('/api/seller/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data?.success && res.data?.url) {
        onChange(res.data.url)
        toast.success('올렸어요 — 아래 [저장]을 눌러야 손님에게 보입니다')
      } else {
        toast.error(res.data?.error || '업로드에 실패했어요')
      }
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '이미지 업로드에 실패했어요')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const box = aspect === 'wide' ? 'h-24 w-full' : 'h-20 w-20 rounded-full'

  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-gray-700">{label}</label>
      {hint && <p className="mb-1.5 text-[11px] text-gray-500">{hint}</p>}
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative shrink-0">
            <img
              src={cfImage(value, { width: aspect === 'wide' ? 480 : 160 })}
              onError={(e) => cfImageOnError(e.currentTarget, value)}
              alt="" width={aspect === 'wide' ? 480 : 160} height={aspect === 'wide' ? 120 : 160}
              className={`${box} ${aspect === 'wide' ? 'rounded-lg' : ''} object-cover border border-rule`}
            />
            <button
              type="button" onClick={() => onChange('')} aria-label={`${label} 지우기`}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 shadow-lift"
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        ) : (
          <div className={`${box} ${aspect === 'wide' ? 'rounded-lg' : ''} shrink-0 border border-dashed border-rule-strong bg-gray-50 flex items-center justify-center`}>
            <ImagePlus className="h-5 w-5 text-gray-300" strokeWidth={1.6} aria-hidden="true" />
          </div>
        )}
        <label className="ur-btn ur-btn-sm ur-btn-secondary shrink-0 cursor-pointer">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {busy ? '올리는 중…' : value ? '바꾸기' : '사진 올리기'}
          <input
            ref={inputRef} type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }}
          />
        </label>
      </div>
    </div>
  )
}
