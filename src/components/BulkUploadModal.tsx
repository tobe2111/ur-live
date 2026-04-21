import { useState, useRef, useEffect } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'
import api from '@/lib/api'

interface BulkUploadModalProps {
  open: boolean
  onClose: () => void
  tokenKey: 'admin_token' | 'seller_token'
  onSuccess?: () => void
}

interface ParsedProduct {
  [key: string]: string
}

interface UploadResult {
  success_count: number
  fail_count: number
  errors?: string[]
}

// CSV 한국어 헤더 → API 필드명 매핑
const HEADER_MAP: Record<string, string> = {
  '상품명*': 'name',
  '상품명': 'name',
  '상품설명': 'description',
  '상세설명': 'long_description',
  '판매가격*': 'price',
  '판매가격': 'price',
  '비교가격': 'compare_at_price',
  '공급가격': 'supply_price',
  '재고수량*': 'stock',
  '재고수량': 'stock',
  '카테고리*': 'category',
  '카테고리': 'category',
  '상품타입*': 'product_type',
  '상품타입': 'product_type',
  '이미지URL': 'image_url',
  '라이브특가': 'live_price',
  '옵션타입': 'option_type',
  '옵션값': 'option_value',
  '옵션추가금액': 'option_extra_price',
  '옵션재고': 'option_stock',
}

/** Parse a single CSV line handling quoted fields */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Remove BOM if present
  const cleaned = text.replace(/^\uFEFF/, '')
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map(parseCsvLine)
  return { headers, rows }
}

function mapRowToProduct(headers: string[], row: string[]): ParsedProduct {
  const product: ParsedProduct = {}
  headers.forEach((header, i) => {
    const fieldName = HEADER_MAP[header] || header
    if (i < row.length) {
      product[fieldName] = row[i]
    }
  })
  return product
}

export default function BulkUploadModal({ open, onClose, tokenKey, onSuccess }: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [allRows, setAllRows] = useState<string[][]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [parseError, setParseError] = useState('')

  function reset() {
    setFileName('')
    setHeaders([])
    setParsedProducts([])
    setAllRows([])
    setResult(null)
    setParseError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null)
    setParseError('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setParseError('CSV 파일만 업로드 가능합니다.')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const { headers: csvHeaders, rows } = parseCsv(text)

        if (csvHeaders.length === 0 || rows.length === 0) {
          setParseError('CSV 파일에 데이터가 없습니다.')
          return
        }

        const mappedHeaders = csvHeaders.map(h => HEADER_MAP[h] || h)
        setHeaders(mappedHeaders)
        setAllRows(rows)

        const products = rows.map(row => mapRowToProduct(csvHeaders, row))
        setParsedProducts(products)
      } catch {
        setParseError('CSV 파일 파싱에 실패했습니다.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleUpload() {
    if (parsedProducts.length === 0) return

    setUploading(true)
    setResult(null)

    try {
      const token = localStorage.getItem(tokenKey)
      const response = await api.post(
        '/api/bulk-upload/upload',
        { products: parsedProducts },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data) {
        setResult({
          success_count: response.data.success_count ?? response.data.data?.success_count ?? 0,
          fail_count: response.data.fail_count ?? response.data.data?.fail_count ?? 0,
          errors: response.data.errors ?? response.data.data?.errors,
        })
        if (onSuccess) onSuccess()
      }
    } catch (err: any) {
      setResult({
        success_count: 0,
        fail_count: parsedProducts.length,
        errors: [err.response?.data?.error || '업로드에 실패했습니다.'],
      })
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  const previewRows = allRows.slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            상품 대량등록
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* File Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">CSV 파일 선택</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FileText className="w-4 h-4" />
                파일 선택
              </button>
              <span className="text-sm text-gray-500">
                {fileName || '선택된 파일 없음'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {parseError && (
              <p className="mt-2 text-xs text-red-600">{parseError}</p>
            )}
          </div>

          {/* Preview Table */}
          {parsedProducts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">
                  미리보기 (총 {parsedProducts.length}개 상품 중 최대 5개)
                </label>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-gray-50">
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {row[ci] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedProducts.length > 5 && (
                <p className="mt-1 text-xs text-gray-400">... 외 {parsedProducts.length - 5}개 행</p>
              )}
            </div>
          )}

          {/* Upload Result */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.fail_count > 0 && result.success_count === 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-4 mb-2">
                {result.success_count > 0 && (
                  <div className="flex items-center gap-1.5 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">성공: {result.success_count}개</span>
                  </div>
                )}
                {result.fail_count > 0 && (
                  <div className="flex items-center gap-1.5 text-red-700">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">실패: {result.fail_count}개</span>
                  </div>
                )}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-xs text-red-600">- {err}</p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-xs text-red-500">... 외 {result.errors.length - 10}개 오류</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={parsedProducts.length === 0 || uploading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  등록하기 ({parsedProducts.length}개)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
