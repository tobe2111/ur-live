import { toast } from '@/hooks/useToast'
import { getSupplierToken } from '@/lib/supplier-api'

export function exportCatalog() {
    const t = localStorage.getItem('seller_token') || getSupplierToken()
    fetch('/api/wholesale/catalog-export', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('단가표 다운로드에 실패했어요'))
  }

  // 🏭 BIZ-8 (2026-06-08) 단가표 CSV — 내 등급가 + MOQ/박스단위/재고 (엑셀로 바로 열림).
  //   서버 /catalog/export?format=csv 가 내 등급 단가만 계산(타 등급가 누출 없음).
export function exportPriceListCsv() {
    const t = localStorage.getItem('seller_token')
    fetch('/api/wholesale/catalog/export?format=csv', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wholesale-pricelist-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('단가표 다운로드에 실패했어요'))
  }

export function downloadOrderForm() {
    const t = localStorage.getItem('seller_token')
    fetch('/api/wholesale/order-template', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wholesale-order-form-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('주문 양식 다운로드에 실패했어요'))
  }
  // 따옴표 포함 CSV 한 줄 파싱.
export function parseCsvLine(line: string): string[] {
    const out: string[] = []; let cur = ''; let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
      else if (ch === '"') q = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur); return out
  }
