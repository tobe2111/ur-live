import { useRef, useState } from 'react'
import api from '@/lib/api'
import { Upload, X } from 'lucide-react'

/**
 * 🖼️🎬 배너 이미지·영상 업로드 (2026-08-04 대표 "히어로도 영상으로").
 *
 * 기존 배너 폼은 **URL 입력칸만** 있었다 — 즉 대표가 어딘가에 파일을 올려 URL 을 구해 와야
 * 히어로를 채울 수 있었고, 그건 사실상 "못 쓴다"는 뜻이다. 여기서 바로 올린다.
 *
 * ⚠️ 영상은 **어드민 전용 엔드포인트**(`/api/upload/banner-video`)로 간다.
 *   공용 `/upload/image` 에 영상 MIME 을 열면 모든 셀러가 영상을 올릴 수 있게 된다.
 *
 * ⚠️ 업로드는 URL 을 **채워 줄 뿐** 저장은 아니다 — 폼의 '수정/생성' 을 눌러야 반영된다.
 *   (그 사실을 화면에 적어 둔다. 안 적으면 올리고 나가서 "왜 안 됐지" 가 된다.)
 */
export default function BannerMediaUpload({
  kind, value, onChange,
}: {
  kind: 'image' | 'video'
  value: string
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const isVideo = kind === 'video'
  const endpoint = isVideo ? '/api/upload/banner-video' : '/api/upload/image'
  const accept = isVideo ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/gif'

  async function pick(file: File) {
    setErr(''); setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(endpoint, fd)
      const url = res?.data?.data?.url
      if (!url) throw new Error('no url')
      onChange(url)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg || '업로드 실패')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder={isVideo ? 'https://.../hero.mp4 (또는 파일 올리기)' : 'https://... (또는 파일 올리기)'}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" /> {busy ? '올리는 중...' : '파일 올리기'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="지우기"
            className="shrink-0 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pick(f) }}
      />
      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      <p className="mt-1.5 text-xs text-gray-400">
        {isVideo
          ? 'MP4 · WebM · 최대 10MB(5MB 이하 권장 — 홈 최상단이라 클수록 첫 화면이 느려집니다).'
          : 'JPG · PNG · WebP · GIF · 최대 10MB.'}
        {' '}<strong className="text-gray-500">올린 뒤 아래 저장 버튼을 눌러야 반영됩니다.</strong>
      </p>
    </div>
  )
}
