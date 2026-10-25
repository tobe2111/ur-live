/**
 * 🏠 요청서 사진 시트 (2026-10-25 대표 "모두 개선해줘") — 간판·인테리어·수리·냉장 설비.
 * 업체는 현장을 봐야 견적을 낸다. 사진은 **견적을 보내는 업체에게 보인다**(고르기 전에도) — 그래서
 * 얼굴·서류·번호판은 빼 달라고 시트에 적는다.
 *
 * 업로드는 로그인이 필요하다(`/api/upload/image`). 로그인은 요청서 맨 끝이라, 로그아웃 상태에서는
 * 저장하고 로그인하러 가거나 건너뛰게 한다(사진은 선택 칸).
 */
import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { MAX_REQUEST_PHOTOS, isRequestPhotoUrl, type RequestField } from '@/shared/home-service'
import { prepareImageForUpload, UploadTooLargeError, uploadTooLargeMessage } from '@/lib/prepare-upload'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { Sheet } from './Sheet'

const DONE = 'ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-50'
const SKIP = 'ur-btn ur-btn-lg flex w-full justify-center bg-surface text-ink shadow-lift'

export function PhotoSheet({ f, value, loggedIn, onDone, onClose, onLogin }: {
  f: RequestField
  value: string
  loggedIn: boolean
  onDone: (v: string) => void
  onClose: () => void
  onLogin: () => void
}) {
  const [urls, setUrls] = useState<string[]>(() => value.split(',').map((u) => u.trim()).filter(Boolean))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function add(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setBusy(true)
    const next = [...urls]
    try {
      for (const file of Array.from(files).slice(0, MAX_REQUEST_PHOTOS - next.length)) {
        const ready = await prepareImageForUpload(file)
        const fd = new FormData()
        fd.append('file', ready)
        const r = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        const url = r.data?.data?.url
        if (!r.data?.success || typeof url !== 'string' || !isRequestPhotoUrl(url)) { setError('사진을 올리지 못했어요'); break }
        next.push(url)
        setUrls([...next])
      }
    } catch (e) {
      if (e instanceof UploadTooLargeError) setError(uploadTooLargeMessage(e))
      else setError('사진을 올리지 못했어요')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  if (!loggedIn) {
    return (
      <Sheet title="현장 사진" onClose={onClose} footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={SKIP} onClick={() => onDone('')}>건너뛰기</button>
          <button type="button" className={DONE} onClick={onLogin}>로그인하고 올리기</button>
        </div>
      }>
        <p className="pb-4 text-[15px] leading-relaxed">사진은 로그인한 뒤에 올릴 수 있어요. 적은 내용은 그대로 남아 있어요.</p>
      </Sheet>
    )
  }

  return (
    <Sheet title={`${f.label} (최대 ${MAX_REQUEST_PHOTOS}장)`} onClose={onClose} footer={
      <button type="button" className={DONE} disabled={busy} onClick={() => onDone(urls.join(','))}>
        {busy ? '올리는 중' : urls.length ? `사진 ${urls.length}장으로 계속` : '사진 없이 계속'}
      </button>
    }>
      <p className="pb-3 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        현장을 보면 업체가 더 정확한 견적을 낼 수 있어요. 사진은 견적을 보내는 업체에게 보이니 얼굴·서류·차 번호판은 빼 주세요.
      </p>
      <div className="flex flex-wrap gap-2 pb-2">
        {urls.map((u) => (
          <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl bg-warm">
            <img src={cfImage(u, { width: 160, height: 160, fit: 'cover' })} alt="올린 사진" width={80} height={80}
              className="h-full w-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, u)} />
            <button type="button" aria-label="사진 빼기" onClick={() => setUrls(urls.filter((x) => x !== u))}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {urls.length < MAX_REQUEST_PHOTOS && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface text-[13px] text-gray-500 shadow-lift dark:text-gray-400">
            {busy ? '올리는 중' : '+ 사진'}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      {error && <p className="pt-2 text-[13px] font-bold text-tone-bad">{error}</p>}
    </Sheet>
  )
}
