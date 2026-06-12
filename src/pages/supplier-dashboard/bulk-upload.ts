/**
 * 📥 2026-06-12 (사용자 요청): 공급상품 대량등록 업로드 공용 로직.
 *   CatalogTab 툴바와 AddProductModal 의 "엑셀 대량등록" 옵션이 같은 흐름을 공유 —
 *   파일(.xlsx/.csv, CP949 자동복구) → CSV 변환 → POST /products/bulk → 결과 토스트
 *   (성공 합계 + 실패 행 상세 "3행: 공급가 오류").
 */
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'
import { readTableFileAsCsv } from '@/lib/read-table-file'

type T = (k: string, o?: Record<string, unknown>) => string

/** 대량등록 파일 업로드 — 성공(1건이라도 등록) 여부 반환. 토스트는 내부에서 처리. */
export async function uploadBulkProducts(file: File, t: T): Promise<boolean> {
  try {
    const csv = await readTableFileAsCsv(file)
    const res = await supplierApi.post<{ summary?: { created: number; failed: number }; results?: Array<{ row: number; name?: string; status: string; reason?: string }> }>('/api/supplier/products/bulk', { csv })
    const s = res.summary
    toast.success(t('supplier.bulkDone', { defaultValue: '{{c}}건 등록, {{f}}건 실패', c: s?.created ?? 0, f: s?.failed ?? 0 })
      .replace('{{c}}', String(s?.created ?? 0)).replace('{{f}}', String(s?.failed ?? 0)))
    const failedRows = (res.results || []).filter(r => r.status === 'error')
    if (failedRows.length > 0) {
      const detail = failedRows.slice(0, 8).map(r => `${r.row}행${r.name ? `(${r.name})` : ''}: ${r.reason || '오류'}`).join('\n')
      toast.error(t('supplier.bulkFailedRows', { defaultValue: '실패 행:\n{{d}}{{more}}' })
        .replace('{{d}}', detail)
        .replace('{{more}}', failedRows.length > 8 ? `\n…외 ${failedRows.length - 8}건` : ''), { duration: 12000 } as never)
    }
    return (s?.created ?? 0) > 0
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '대량 등록 실패')
    return false
  }
}

export const BULK_ACCEPT = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
