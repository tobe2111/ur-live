import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { downloadSellerTemplate } from '@/utils/product-template'

/**
 * 🛡️ 상품 일괄 등록 도구 — 엑셀 템플릿 다운로드 + CSV 업로드.
 *   한 건씩 폼으로 올리기 어려운 사용자를 위한 대안 경로. SellerProductNewPage 에서 분리.
 */
export default function BulkUploadTools() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { toast.error(t('common.noData')); return }
      const headers = lines[0].split(',').map(h => h.trim())
      const token = localStorage.getItem('seller_token')
      let success = 0, fail = 0
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = values[idx] || '' })
        try {
          await api.post('/api/seller/products', {
            name: row['name'] || row['상품명'],
            description: row['description'] || row['설명'] || '',
            price: Number(row['price'] || row['가격'] || 0),
            stock: Number(row['stock'] || row['재고'] || 0),
            image_url: row['image_url'] || row['이미지'] || '',
            category: row['category'] || row['카테고리'] || 'lifestyle',
          }, { headers: { Authorization: `Bearer ${token}` } })
          success++
        } catch { fail++ }
      }
      toast.success(t('seller.products.bulkResult', { success, fail }))
      if (success > 0) navigate('/seller/products')
    } catch { toast.error(t('seller.products.csvReadFailed')) }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={downloadSellerTemplate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
        >
          <Download className="h-4 w-4" />
          {t('seller.bulkUploadTemplate')}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100">
          <FileText className="h-4 w-4" />
          {t('seller.products.csvBulkUpload')}
          <input type="file" accept=".csv" className="hidden" onChange={handleCsv} />
        </label>
      </div>
      <p className="text-xs text-gray-500">{t('seller.products.bulkUploadHint')}</p>
    </div>
  )
}
