/**
 * 🛡️ 2026-05-18: 이미지 업로드 컴포넌트 (R2 backend).
 *
 *   사용처: 숙소 객실 이미지 / 사업자등록증 / 상품 이미지 등.
 *
 *   특징:
 *   - 드래그&드롭 + 클릭 업로드
 *   - 진행 상태 표시
 *   - 검증 (10MB / 이미지 타입)
 *   - 업로드 성공 시 URL 반환 (onChange callback)
 *   - 기존 URL 표시 (value prop)
 */
import { useState, useRef } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Props {
  value?: string
  onChange: (url: string) => void
  tokenKey?: 'seller_token' | 'admin_token' | 'agency_token' | 'access_token'
  label?: string
  required?: boolean
  aspectRatio?: 'square' | 'video' | 'auto'
  className?: string
}

const TOKEN_KEYS = ['seller_token', 'admin_token', 'agency_token', 'access_token'] as const

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
    // Client-side 검증 (서버에서도 검증하지만 사용자 즉시 피드백).
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일이 너무 큽니다 (최대 10MB)')
      return
    }
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
      const fd = new FormData()
      fd.append('file', file)
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
    : ''

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
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
        <div className={`relative ${aspectClass} border-2 border-gray-200 dark:border-[#2A2A2A] rounded-lg overflow-hidden group`}>
          <img src={value} alt={label || 'uploaded'} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded shadow disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : '변경'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded shadow"
            >
              <X className="w-3 h-3 inline mr-0.5" />제거
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
            'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
              <p className="text-xs text-blue-600 font-semibold">업로드 중...</p>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-400 mb-2" />
              <p className="text-xs text-gray-600 font-semibold">클릭 또는 드래그</p>
              <p className="text-[10px] text-gray-400 mt-0.5">JPG / PNG / WEBP — 최대 10MB</p>
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
      {label && <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {values.map((url, i) => (
          <div key={i} className="relative aspect-square border border-gray-200 dark:border-[#2A2A2A] rounded-lg overflow-hidden group">
            <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            {i === 0 && (
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded">대표</div>
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
      <p className="text-[10px] text-gray-400 mt-1">{values.length}/{max} 장 — 첫 번째가 대표 이미지</p>
    </div>
  )
}

// ImageIcon은 dead-import 가드용. 사용 안 함.
void ImageIcon
