/**
 * 이미지 업로드 컴포넌트
 * 
 * 기능:
 * - 파일 선택 또는 드래그 앤 드롭
 * - 자동 압축 (800KB 이하)
 * - 이미지 미리보기
 * - Base64 인코딩 (R2 미사용 시)
 */

import { useState, useRef } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  maxSizeKB?: number
}

export default function ImageUpload({ 
  value, 
  onChange, 
  label = '이미지 업로드',
  maxSizeKB = 800 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
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

      // 이미지 압축
      const options = {
        maxSizeMB: maxSizeKB / 1024, // KB를 MB로 변환
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg'
      }

      const compressedFile = await imageCompression(file, options)
      
      // Base64로 변환 (임시 방안)
      // TODO: R2 활성화 후 실제 업로드로 변경
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        onChange(base64)
        setUploading(false)
      }
      reader.onerror = () => {
        throw new Error('파일 읽기에 실패했습니다.')
      }
      reader.readAsDataURL(compressedFile)

      console.log('압축 완료:', {
        원본: `${(file.size / 1024).toFixed(2)}KB`,
        압축: `${(compressedFile.size / 1024).toFixed(2)}KB`,
        압축률: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
      })

    } catch (err: any) {
      console.error('Image upload error:', err)
      setError(err.message || '이미지 업로드에 실패했습니다.')
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

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
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
              <p className="text-sm text-gray-600">이미지 압축 중...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  클릭하거나 이미지를 드래그하세요
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, GIF (최대 10MB) • 자동으로 {maxSizeKB}KB 이하로 압축됩니다
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
              alt="업로드된 이미지"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Error'
              }}
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            이미지가 업로드되었습니다
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
          또는 이미지 URL 직접 입력
        </summary>
        <div className="mt-2">
          <input
            type="url"
            value={value.startsWith('http') ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Unsplash, Pexels 등의 이미지 URL을 입력할 수 있습니다
          </p>
        </div>
      </details>
    </div>
  )
}
