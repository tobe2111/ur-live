/**
 * 📷 첫 이용권 사진 — 2026-11-03 대표 확정:
 *   *"사장님이 자신의 사진을 첨부파일로 올릴 수 있는게 최우선, 그리고 네이버에서 고를 수 있게끔"* · *"사진이 없으면 막자"*.
 *
 * - **내 사진 올리기**가 맨 앞의 큰 칸이다. 네이버 사진은 그 아래 "눌러서 추가" 줄과 [더 보기] 창.
 * - 네이버 사진은 **자동으로 넣지 않는다** — 남의 블로그 사진일 수 있어 사장님이 고르게 하고, 그 사실을 화면에 적는다.
 * - 첫 장이 대표 사진(카드·검색·공유가 읽는 `image_url`). 사진마다 출처(내 사진/네이버)를 작게 보여 준다.
 * - 막는 판정(0장)은 이 부품이 아니라 페이지의 [이용권 올리기] 버튼이 한다(이유 한 줄과 함께).
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { uploadVoucherPhoto, searchNaverPhotos, dongOf, PHOTO_MAX } from './upload-photo'
import NaverPhotoSheet from './NaverPhotoSheet'

export interface PickedPhoto { url: string; from: 'mine' | 'naver' }

interface Props {
  photos: PickedPhoto[]
  onChange: (next: PickedPhoto[]) => void
  storeName?: string
  storeAddress?: string
}

export default function VoucherPhotos({ photos, onChange, storeName, storeAddress }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [suggest, setSuggest] = useState<string[]>([])
  const [sheet, setSheet] = useState(false)
  const baseQuery = [storeName, dongOf(storeAddress)].filter(Boolean).join(' ')
  const room = PHOTO_MAX - photos.length

  useEffect(() => {
    if (!baseQuery) return
    let alive = true
    searchNaverPhotos(baseQuery, 9).then((u) => { if (alive) setSuggest(u) })
    return () => { alive = false }
  }, [baseQuery])

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const picked = Array.from(list).slice(0, Math.max(0, room))
    if (picked.length === 0) { toast.error(`사진은 최대 ${PHOTO_MAX}장까지예요`); return }
    setUploading(picked.length)
    const added: PickedPhoto[] = []
    for (const f of picked) {
      const r = await uploadVoucherPhoto(f)
      if (r.ok) added.push({ url: r.url, from: 'mine' })
      else toast.error(r.message)
      setUploading((n) => n - 1)
    }
    if (added.length) onChange([...photos, ...added].slice(0, PHOTO_MAX))
  }

  function addNaver(urls: string[]) {
    const fresh = urls.filter((u) => !photos.some((p) => p.url === u)).slice(0, Math.max(0, room))
    if (fresh.length === 0) { if (room <= 0) toast.error(`사진은 최대 ${PHOTO_MAX}장까지예요`); return }
    onChange([...photos, ...fresh.map((url) => ({ url, from: 'naver' as const }))])
  }
  const remove = (i: number) => onChange(photos.filter((_, k) => k !== i))
  const makeFirst = (i: number) => { if (i > 0) onChange([photos[i], ...photos.filter((_, k) => k !== i)]) }

  const shown = suggest.filter((u) => !photos.some((p) => p.url === u)).slice(0, 4)

  return (
    <section className="mt-5" aria-label="이용권 사진">
      <div className="flex items-baseline justify-between">
        <p className="text-[16px] font-semibold">사진 <span className="text-[13px] font-normal text-ink-soft">{photos.length ? `${photos.length} / ${PHOTO_MAX}` : `필수 · 최대 ${PHOTO_MAX}장`}</span></p>
        <span className="text-[12px] text-ink-soft">{photos.length > 1 ? '사진을 누르면 대표가 돼요' : '첫 장이 대표 사진'}</span>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" data-testid="first-voucher-file"
        onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />

      <div className="mt-3 flex gap-2 overflow-x-auto overscroll-contain -mx-1 px-1 pb-1">
        {photos.map((p, i) => (
          <div key={p.url} className="ur-rise relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-wash">
            <button type="button" onClick={() => makeFirst(i)} aria-label={i === 0 ? '대표 사진' : '대표 사진으로'} className="block w-full h-full">
              <img src={cfImage(p.url, { width: 192 })} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, p.url)} />
            </button>
            {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-brand px-2 text-[12px] font-medium text-white">대표</span>}
            <span className="absolute left-1 bottom-1 rounded bg-black/50 px-1 text-[12px] text-white">{p.from === 'mine' ? '내 사진' : '네이버'}</span>
            <button type="button" onClick={() => remove(i)} aria-label="사진 빼기"
              className="absolute right-1 top-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X size={14} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="w-24 h-24 shrink-0 rounded-xl bg-wash flex items-center justify-center text-[12px] text-ink-soft">올리는 중…</div>
        ))}
        {room > 0 && (
          <button type="button" onClick={() => fileRef.current?.click()} data-testid="first-voucher-upload"
            className={`w-24 h-24 shrink-0 rounded-xl border-[1.5px] border-dashed flex flex-col items-center justify-center gap-1 text-[13px] font-medium ${photos.length ? 'border-line text-ink-soft' : 'border-brand bg-brand-tint text-brand-text'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            {photos.length ? '더 올리기' : '내 사진 올리기'}
          </button>
        )}
        {photos.length === 0 && uploading === 0 && (
          <div className="flex-1 min-w-[120px] h-24 rounded-xl bg-wash flex items-center justify-center px-3 text-center text-[13px] leading-relaxed text-ink-soft">
            직접 찍은 메뉴·가게 사진이<br />가장 잘 팔려요
          </div>
        )}
      </div>

      {room > 0 && shown.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <p className="text-[13px] text-ink-soft">네이버에서 찾은 이 가게 사진 · 눌러서 추가</p>
            <button type="button" onClick={() => setSheet(true)} className="text-[13px] font-medium text-brand-text">더 보기</button>
          </div>
          <div className="mt-2 flex gap-2">
            {shown.map((u) => (
              <button key={u} type="button" onClick={() => addNaver([u])} aria-label="이 사진 추가"
                className="relative w-[72px] h-[72px] shrink-0 rounded-[10px] overflow-hidden bg-wash">
                <img src={cfImage(u, { width: 144 })} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, u)} />
                <span className="absolute right-1 bottom-1 w-5 h-5 rounded-full bg-black/60 text-white text-[12px] leading-5 text-center" aria-hidden="true">+</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">다른 사람이 찍은 사진일 수 있어요. 우리 가게 사진인지 확인하고 골라 주세요.</p>
        </>
      )}

      {sheet && <NaverPhotoSheet baseQuery={baseQuery} room={room} onClose={() => setSheet(false)} onAdd={(urls) => { addNaver(urls); setSheet(false) }} />}
    </section>
  )
}
