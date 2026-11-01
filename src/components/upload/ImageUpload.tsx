/**
 * 🛡️ 2026-05-18: 이미지 업로드 컴포넌트 (R2 backend).
 *
 *   사용처: 숙소 객실 이미지 / 사업자등록증 / 상품 이미지 등.
 *
 *   특징:
 *   - 드래그&드롭 + 클릭 업로드
 *   - 진행 상태 표시
 *   - 검증 (이미지 타입) · 큰 사진은 자동으로 줄여 올림(공용 `prepareImageForUpload`)
 *   - 업로드 성공 시 URL 반환 (onChange callback)
 *   - 기존 URL 표시 (value prop)
 */
import { uploadSizedImage } from '@/lib/image-sized'
import { useState, useRef } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { prepareImageForUpload, UploadTooLargeError, uploadTooLargeMessage } from '@/lib/prepare-upload'

interface Props {
  value?: string
  onChange: (url: string) => void
  tokenKey?: 'seller_token' | 'admin_token' | 'agency_token' | 'access_token'
  label?: string
  required?: boolean
  aspectRatio?: 'square' | 'video' | 'auto' | 'banner'
  className?: string
}

const TOKEN_KEYS = ['seller_token', 'admin_token', 'agency_token', 'access_token'] as const

// 🗜️ 2026-10-14: 자체 캔버스 압축(1600px · WebP 0.85)을 공용 준비 헬퍼로 옮겼다. 종전 것은
//   ① 1MB 미만이면 그대로 ② 변환 결과가 더 크면 원본으로 되돌려 **천장(1MB) 검사가 없었고**
//   ③ GIF 는 크기와 상관없이 원본을 보내 1MB 넘으면 413 이었다. 해상도(1600px)는 그대로 지킨다.
const PREP_SIZE = { maxSizeMB: 0.9, maxWidthOrHeight: 1600 } as const

export default function ImageUpload({
  value, onChange, tokenKey, label, required, aspectRatio = 'auto', className = '',
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function getToken(): string {
    if (tokenKey) return localStorage.getItem(tokenKey) || ''
    // tokenKey 미지정 시 자동 탐색.
    for (const k of TOKEN_KEYS) {
      const t = localStorage.getItem(k)
      if (t) return t
    }
    return ''
  }

  async function uploadFile(file: File) {
    // 압축 **전** 크기로 자르지 않는다 — 큰 폰 사진도 줄이면 올라간다(준비 헬퍼가 판정한다).
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다')
      return
    }

    const token = getToken()
    if (!token) {
      toast.error('로그인이 필요합니다')
      return
    }

    setUploading(true)
    try {
      // 🖼️ 2026-11-01: 먼저 브라우저가 세 크기로 줄여 올린다(변환 한도 0 — `lib/image-sized.ts`). 안 되면 아래 종전 경로.
      const sizedUrl = await uploadSizedImage(file, async (fd) => {
        const r = await fetch('/api/upload/image-sized', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
        return r.ok ? r.json() : null
      }).catch(() => null)
      if (sizedUrl) { onChange(sizedUrl); toast.success('업로드 완료'); return }
      // 1600px · WebP 로 줄이고(천장 안 GIF 는 움직임 보존), 줄여도 1MB 를 넘으면 413 전에 우리 문구로 멈춘다.
      const optimized = await prepareImageForUpload(file, { size: PREP_SIZE })
      const fd = new FormData()
      fd.append('file', optimized)
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json() as { success: boolean; data?: { url: string; key: string }; error?: string }
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      onChange(data.data.url)
      toast.success('업로드 완료')
    } catch (err: unknown) {
      if (err instanceof UploadTooLargeError) { toast.error(uploadTooLargeMessage(err)); return }
      toast.error((err as Error).message || '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) uploadFile(f)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) uploadFile(f)
  }

  const aspectClass = aspectRatio === 'square' ? 'aspect-square'
    : aspectRatio === 'video' ? 'aspect-video'
    : aspectRatio === 'banner' ? 'aspect-[16/6]'
    : ''

  return (
    <div className={className}>
      {label && (
        <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-200 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleSelect}
        className="hidden"
        disabled={uploading}
      />
      {value ? (
        <div className={`relative ${aspectClass} border-2 border-line rounded-lg overflow-hidden group`}>
          <img src={value} alt={label || 'uploaded'} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 bg-surface text-gray-900 dark:text-white text-[12px] font-medium rounded shadow disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : '변경'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-2 bg-red-500 text-white text-[12px] font-medium rounded shadow"
            >
              <X className="w-3 h-3 inline mr-1" />제거
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`${aspectClass} border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all p-4 ${
            uploading ? 'border-blue-300 bg-blue-50 cursor-wait' :
            dragOver ? 'border-blue-500 bg-blue-50' :
            'border-gray-300 dark:border-[#2C2F35] bg-gray-50 dark:bg-[#1D1F29] hover:border-gray-400 hover:bg-gray-100 dark:hover:bg-[#1D1F29]'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
              <p className="text-[12px] text-blue-600 font-medium">업로드 중...</p>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-400 mb-2" />
              <p className="text-[12px] text-gray-600 font-medium">클릭 또는 드래그</p>
              <p className="text-[12px] text-gray-400 mt-1">JPG / PNG / WEBP — 큰 사진은 자동으로 줄여요</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// 다중 업로드 (객실 갤러리 등에서 사용).
interface MultiProps {
  values: string[]
  onChange: (urls: string[]) => void
  max?: number
  tokenKey?: 'seller_token' | 'admin_token' | 'agency_token' | 'access_token'
  label?: string
}

export function MultiImageUpload({ values, onChange, max = 10, tokenKey, label }: MultiProps) {
  return (
    <div>
      {label && <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-200 mb-2">{label}</label>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {values.map((url, i) => (
          <div key={i} className="relative aspect-square border border-line rounded-lg overflow-hidden group">
            <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            {/* 사진 위 스크림 배지 — 누르는 것이 아니다(브랜드 면으로 칠하면 바로 위 삭제 버튼과 헷갈린다). */}
            {i === 0 && (
              <div className="absolute bottom-1 left-1 px-2 py-1 bg-gray-900 text-white text-[12px] font-medium rounded">대표</div> /* primary-button-ok */
            )}
          </div>
        ))}
        {values.length < max && (
          <div className="aspect-square">
            <ImageUpload
              value=""
              onChange={(url) => onChange([...values, url])}
              tokenKey={tokenKey}
              aspectRatio="square"
            />
          </div>
        )}
      </div>
      <p className="text-[12px] text-gray-400 mt-1">{values.length}/{max} 장 — 첫 번째가 대표 이미지</p>
    </div>
  )
}

// ImageIcon은 dead-import 가드용. 사용 안 함.
void ImageIcon
