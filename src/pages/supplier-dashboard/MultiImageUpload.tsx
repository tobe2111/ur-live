/**
 * 🖼️ 2026-06-13 (사용자 요청): 상세페이지 이미지 멀티 업로더 — 세로로 길고 용량 큰 사진 다수 + GIF.
 *
 *   설계 원칙 (이상적 구현):
 *   - **원본 업로드(무압축)**: 상세 이미지는 세로로 긴 설명컷/GIF 애니메이션이라 클라 압축 금지
 *     (압축하면 GIF 정지·세로 디테일 뭉개짐). 서버 /api/upload/image 가 10MB·gif/webp/png/jpg 허용 → 그대로.
 *   - **여러 장 + 순서**: 드래그 추가, 위/아래 정렬, 개별 삭제. 결과는 URL 배열 → 부모가 쉼표 join.
 *   - **GIF 보존 뱃지** 표시. supplier_token Bearer + multipart (supplierApi 는 JSON 전용이라 raw fetch).
 *
 *   라이트 고정. value=쉼표구분 URL 문자열(서버/엑셀과 동일 포맷) ↔ onChange.
 */
import { useRef, useState } from 'react'
import { ImagePlus, X, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { getSupplierToken } from '@/lib/supplier-api'
import { toast } from '@/hooks/useToast'

// 🖼️ 2026-06-30: 상세이미지 최대 장수 10→30 (긴 상세페이지 슬라이스 대응). 서버 3곳과 동기:
//   supplier-dashboard POST/bulk 저장 slice, wholesale catalog/:id 표시 slice.
const MAX_FILES = 30
const MAX_SIZE = 10 * 1024 * 1024

function splitUrls(v: string): string[] {
  return v.split(/[,\n|]/).map(u => u.trim()).filter(Boolean)
}

export default function MultiImageUpload({ value, onChange, t }: {
  value: string
  onChange: (commaJoined: string) => void
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const urls = splitUrls(value)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setUrls = (next: string[]) => onChange(next.slice(0, MAX_FILES).join(','))

  async function uploadOne(file: File): Promise<string | null> {
    if (file.size > MAX_SIZE) { toast.error(`${file.name}: 10MB 를 초과합니다`); return null }
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) { toast.error(`${file.name}: 지원하지 않는 형식(JPG/PNG/WebP/GIF)`); return null }
    const fd = new FormData()
    fd.append('image', file) // ⚠️ 무압축 원본 — GIF 애니메이션·세로 디테일 보존
    const token = getSupplierToken()
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).catch(() => null)
    if (!res) { toast.error(`${file.name}: 업로드 실패(네트워크)`); return null }
    const data = await res.json().catch(() => null) as { success?: boolean; data?: { url?: string }; url?: string; error?: string } | null
    const url = data?.data?.url || data?.url
    if (!res.ok || !data?.success || !url) { toast.error(`${file.name}: ${data?.error || '업로드 실패'}`); return null }
    return url
  }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return
    const room = MAX_FILES - urls.length
    if (room <= 0) { toast.error(`상세 이미지는 최대 ${MAX_FILES}장까지예요`); return }
    const picked = Array.from(files).slice(0, room)
    setUploading(true)
    const added: string[] = []
    for (const f of picked) {
      const u = await uploadOne(f)
      if (u) added.push(u)
    }
    if (added.length) setUrls([...urls, ...added])
    setUploading(false)
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= urls.length) return
    const next = [...urls]
    ;[next[i], next[j]] = [next[j], next[i]]
    setUrls(next)
  }
  const remove = (i: number) => setUrls(urls.filter((_, idx) => idx !== i))

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden
        onChange={e => { onFiles(e.target.files); if (e.target) e.target.value = '' }} />
      {urls.length > 0 && (
        <div className="space-y-2 mb-2">
          {urls.map((u, i) => (
            <div key={u + i} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <span className="text-[11px] font-bold text-gray-400 w-5 text-center shrink-0">{i + 1}</span>
              <div className="relative shrink-0">
                <img src={u} alt="" className="w-12 h-12 rounded object-cover bg-white" loading="lazy" />
                {/\.gif(\?|$)/i.test(u) && <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-black/70 text-white px-1 rounded">GIF</span>}
              </div>
              <span className="flex-1 min-w-0 text-[11px] text-gray-500 truncate">{u.split('/').pop()}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === urls.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || urls.length >= MAX_FILES}
        className="w-full h-11 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-gray-50 disabled:opacity-50">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        {uploading ? t('common.loading', { defaultValue: '업로드 중...' }) : t('supplier.detailUploadBtn', { defaultValue: '상세 이미지 추가 (여러 장·GIF 가능)' })}
        <span className="text-[11px] text-gray-400">({urls.length}/{MAX_FILES})</span>
      </button>
      <p className="text-[10.5px] text-gray-400 mt-1">{t('supplier.detailUploadHint', { defaultValue: '세로로 긴 설명 이미지·GIF 모두 원본 화질 그대로 업로드돼요 (장당 최대 10MB). 순서는 위/아래 버튼으로 조정.' })}</p>
    </div>
  )
}
