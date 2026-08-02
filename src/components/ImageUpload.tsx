/**
 * 이미지 업로드 컴포넌트
 * 
 * 기능:
 * - 파일 선택 또는 드래그 앤 드롭
 * - 자동 압축 (800KB 이하)
 * - 이미지 미리보기
 * - R2 또는 Base64 자동 선택
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { compressForUpload } from '@/lib/image-compress'
import api from '@/lib/api'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  maxSizeKB?: number
  /**
   * 🎨 `compact` = **정사각 슬롯 하나**〔시안 `docs/design/operator-mall-pilot.md` 화면 B〕.
   *
   * 기본 UI 는 드롭존 + `h-48` 미리보기 + URL 직접입력까지 붙은 **풀 폼**이라, 한 손으로 쓰는
   * 3분 등록 화면에서는 그것만으로 첫 화면이 다 찬다(UX 기준 ④).
   *
   * ⚠️ 기본값 `'default'` — **기존 14개 호출부는 한 줄도 안 바뀐다.**
   */
  variant?: 'default' | 'compact'
  /** `compact` 전용. 제출을 눌렀는데 사진이 비어 있는 상태〔시안 B-2〕. */
  invalid?: boolean
}

export default function ImageUpload({
  value,
  onChange,
  label,
  maxSizeKB = 800,
  variant = 'default',
  invalid = false
}: ImageUploadProps) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('common.imageUpload', { defaultValue: '이미지 업로드' })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [storageType, setStorageType] = useState<'r2' | 'base64' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    setUploading(true)

    try {
      // 파일 타입 검증
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드 가능합니다.')
      }

      // 파일 크기 검증 (10MB 초과 시 거부)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('이미지 크기는 10MB 이하여야 합니다.')
      }

      // 클라이언트 사이드 강한 압축 (CF Images 유료 회피).
      // WebP 변환 + 1280px 제한 + 0.82 품질.
      const compressedFile = await compressForUpload(file, {
        maxSizeMB: maxSizeKB / 1024,
        maxWidthOrHeight: 1280,
        toWebP: true,
      })

      // 🛡️ 서버 엔드포인트는 multipart/form-data 만 허용 (JSON+base64 는 무효).
      //   기존 base64 코드는 항상 400 으로 실패하고 있었음.
      try {
        const formData = new FormData()
        // 압축 결과 파일명/타입을 원본에 맞춰 서버 확장자 검증 통과 보장.
        // compressForUpload 가 이미 File 객체로 webp 확장자/타입을 정규화함.
        formData.append('image', compressedFile)

        const response = await api.post('/api/seller/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        if (response.data.success) {
          onChange(response.data.url)
          setStorageType(response.data.storage ?? 'r2')
          if (response.data.warning) {
            if (import.meta.env.DEV) console.warn('[Image Upload]', response.data.warning)
          }
        } else {
          throw new Error(response.data.error || '업로드 실패')
        }
      } catch (apiError: any) {
        if (import.meta.env.DEV) console.error('API upload error:', apiError)
        throw new Error(apiError.response?.data?.error || apiError.message || '업로드 실패')
      } finally {
        setUploading(false)
      }

    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Image upload error:', err)
      setError(err.message || t('common.imageUploadFailed', { defaultValue: '이미지 업로드에 실패했습니다.' }))
      setUploading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave() {
    setDragActive(false)
  }

  function handleRemove() {
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 🎨 정사각 슬롯 1개. 라벨·URL 직접입력·업로드 안내문을 **전부 뺀다** — 그 설명은 슬롯 옆에
   * 부모가 자기 문장으로 쓴다(시안 B: *"정사각형으로 잘려요 / 밝은 곳에서 위에서 찍으면 잘 나와요"*).
   */
  if (variant === 'compact') {
    return (
      <div>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          aria-label={resolvedLabel}
          className={`relative w-[92px] h-[92px] rounded-[14px] overflow-hidden flex-none cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors ${
            value
              ? 'bg-[#F5F2F3] border border-[#EAE5E7]'
              : invalid
                ? 'bg-[#FDEEEE] border-[1.5px] border-dashed border-[#E9A9A2]'
                : dragActive
                  ? 'bg-[#F1EDEF] border border-[#DFD9DC]'
                  : 'bg-[#F5F2F3] border border-[#EAE5E7]'
          } ${uploading ? 'pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <Loader2 className="w-5 h-5 text-[#8A8288] animate-spin" />
          ) : value ? (
            <>
              <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove() }}
                aria-label={t('common.imageRemove', { defaultValue: '이미지 제거' })}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[rgba(20,17,19,.72)] text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : invalid ? (
            <>
              <ImageIcon className="w-[22px] h-[22px] text-[#D0685E]" strokeWidth={1.8} />
              <span className="text-[11px] font-bold text-[#C0554B] tracking-[-0.02em]">사진 필요</span>
            </>
          ) : (
            <>
              <Upload className="w-[22px] h-[22px] text-[#A9A2A6]" strokeWidth={1.8} />
              <span className="text-[11px] font-bold text-[#8A8288] tracking-[-0.02em]">사진 올리기</span>
            </>
          )}
        </div>

        {error && <p className="mt-2 text-[12px] text-[#C0392F] tracking-[-0.02em]">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {resolvedLabel}
      </label>

      {/* 업로드 영역 */}
      {!value && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-600">{t('common.imageCompressing', { defaultValue: '이미지 압축 중...' })}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {t('common.imageDropHint', { defaultValue: '클릭하거나 이미지를 드래그하세요' })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('common.imageFormatHint', { maxSizeKB, defaultValue: 'JPG, PNG, GIF (최대 10MB) • 자동으로 {{maxSizeKB}}KB 이하로 압축됩니다' })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 미리보기 */}
      {value && (
        <div className="relative">
          <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border">
            <img
              src={value}
              alt={t('common.imageUploaded', { defaultValue: '업로드된 이미지' })}
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Error'
              }}
            />
            <button
              type="button"
              onClick={handleRemove}
              aria-label={t('common.imageRemove', { defaultValue: '이미지 제거' })}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            {t('common.imageUploadedMsg', { defaultValue: '이미지가 업로드되었습니다' })}
            {storageType && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                {storageType === 'r2' ? '✅ R2' : '⚠️ Base64'}
              </span>
            )}
          </p>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* URL 입력 옵션 */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
          {t('common.imageUrlInput', { defaultValue: '또는 이미지 URL 직접 입력' })}
        </summary>
        <div className="mt-2">
          <input
            type="url"
            value={value.startsWith('http') ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('common.imageUrlHint', { defaultValue: 'Unsplash, Pexels 등의 이미지 URL을 입력할 수 있습니다' })}
          </p>
        </div>
      </details>
    </div>
  )
}
