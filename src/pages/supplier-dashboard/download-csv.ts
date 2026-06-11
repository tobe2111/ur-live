import { toast } from '@/hooks/useToast'
import { getSupplierToken } from '@/lib/supplier-api'

// 인증 헤더로 CSV 다운로드 → blob 저장 (anchor href 는 토큰 미첨부라 fetch 사용).
export async function downloadSupplierCsv(path: string, filename: string) {
  const token = getSupplierToken()
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { toast.error('다운로드 실패'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
