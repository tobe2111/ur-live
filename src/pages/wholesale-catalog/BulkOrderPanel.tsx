import { useState, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, FileSpreadsheet, X, ShoppingCart, Upload, Download } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT, won, comma } from '../wholesale/wholesale-theme'
import { useWholesaleCart } from '../wholesale/useWholesaleCart'
import { parseCsvLine, downloadOrderForm, exportCatalog, exportPriceListCsv } from './csv-utils'
import { readTableFileAsCsv } from '@/lib/read-table-file'

// ── 대량 주문(엑셀) — 양식 다운로드 + 작성본 업로드 → 서버 검증/미리보기 → 카트 담기 → 예치금 체크아웃 ──
//   BIZ-9 (2026-06-09): 업로드 즉시 청구하지 않음. 서버 /orders/bulk-preview 가 product_id 매칭 +
//   MOQ/박스단위/재고 검증 → 유효 라인 + 오류행(사유) 반환. 사용자가 확인 후 카트에 담아 기존 예치금 결제.
//   WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0) — 패널 전용 상태/핸들러는 이 컴포넌트로 이동.
export default function BulkOrderPanel({ token }: { token: string | null }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const cart = useWholesaleCart()
  const bulkInputRef = useRef<HTMLInputElement | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  type BulkPreviewItem = { product_id: number; name: string; image_url: string | null; qty: number; unit_price: number; line_total: number; moq: number; order_multiple: number }
  type BulkPreviewError = { row?: number; product_id?: number | null; name?: string; qty?: number; reason: string }
  const [bulkPreview, setBulkPreview] = useState<{ items: BulkPreviewItem[]; subtotal: number; errors: BulkPreviewError[] } | null>(null)
  async function onBulkFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '' // 같은 파일 재선택 허용
    if (!file || bulkBusy) return
    setBulkBusy(true)
    setBulkPreview(null)
    try {
      const text = await readTableFileAsCsv(file) // 📥 2026-06-12: .xlsx 직접 업로드 + CP949 CSV 한글 복구
      const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { toast.error('내용이 없는 파일이에요'); return }
      const header = parseCsvLine(lines[0]).map(h => h.trim())
      const pidIdx = header.findIndex(h => h.toLowerCase() === 'product_id')
      let qtyIdx = header.findIndex(h => h.replace(/\s/g, '') === '주문수량')
      if (pidIdx < 0) { toast.error('product_id 열을 찾을 수 없어요 (양식을 다시 받아주세요)'); return }
      if (qtyIdx < 0) qtyIdx = header.length - 1 // 주문수량 헤더 없으면 마지막 열
      const MAX_ROWS = 5000
      // 행번호(엑셀 기준, 헤더=1행) 포함해 서버로 전송 — blank/0 qty 도 서버가 오류로 분류·안내.
      const rows: { product_id: number; qty: number; row: number }[] = []
      for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
        const cols = parseCsvLine(lines[i])
        const pidRaw = String(cols[pidIdx] ?? '').replace(/[^0-9]/g, '')
        const qtyRaw = String(cols[qtyIdx] ?? '').replace(/[^0-9.]/g, '')
        const pid = Number(pidRaw)
        const qty = Math.floor(Number(qtyRaw))
        // product_id 없는 완전 빈 줄은 skip. qty 비었거나 0 인 행도 서버에 보내 사유 안내(단, pid 는 있어야 함).
        if (!pidRaw || !Number.isFinite(pid) || pid <= 0) continue
        rows.push({ product_id: pid, qty: Number.isFinite(qty) ? qty : 0, row: i + 1 })
      }
      if (!rows.length) { toast.error('상품코드(product_id)가 있는 행이 없어요. 양식을 다시 받아주세요'); return }
      // 서버 검증/미리보기 — 청구하지 않음.
      const r = await api.post('/api/wholesale/orders/bulk-preview', { items: rows }, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.data?.success) { toast.error(r.data?.error || '주문서 검증에 실패했어요'); return }
      const items: BulkPreviewItem[] = r.data.items || []
      const errors: BulkPreviewError[] = r.data.errors || []
      const subtotal = Number(r.data.subtotal) || 0
      if (!items.length && !errors.length) { toast.error('처리할 행이 없어요'); return }
      setBulkPreview({ items, subtotal, errors })
      if (items.length) toast.success(`${comma(items.length)}개 담을 수 있어요${errors.length ? ` · ${comma(errors.length)}개 오류` : ''}`)
      else toast.error(`담을 수 있는 항목이 없어요 (${comma(errors.length)}개 오류)`)
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || '주문서 업로드 중 오류가 발생했어요')
    } finally { setBulkBusy(false) }
  }
  // 미리보기 유효 라인 → 도매 카트에 담기 → 카트(검토·예치금 결제)로 이동.
  function addBulkToCart() {
    if (!bulkPreview?.items.length) return
    for (const it of bulkPreview.items) {
      cart.add({ id: it.product_id, qty: it.qty, name: it.name, image_url: it.image_url, price: it.unit_price, moq: it.moq })
    }
    const n = bulkPreview.items.length
    setBulkPreview(null)
    toast.success(`장바구니에 ${comma(n)}개 품목 담았어요`)
    navigate('/wholesale/cart')
  }
  // 오류행 리포트 CSV 다운로드 (행번호·상품코드·수량·사유).
  function downloadBulkErrors() {
    if (!bulkPreview?.errors.length) return
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const head = ['행', 'product_id', '상품명', '주문수량', '오류사유']
    const body = bulkPreview.errors.map(e => [e.row ?? '', e.product_id ?? '', e.name ?? '', e.qty ?? '', e.reason].map(esc).join(','))
    const csv = '﻿' + head.join(',') + '\r\n' + body.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `wholesale-order-errors-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  return (
            <div className="mb-4 rounded-2xl p-4" style={{ border: '1px solid ' + WT.line, background: WT.fill2 }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-bold" style={{ color: WT.ink }}>대량 주문 (엑셀)</span>
                <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: WT.brandSoft, color: WT.brand }}>주문 많을 때</span>
              </div>
              <p className="text-[12px] mb-3" style={{ color: WT.ink3 }}>{t('wholesale.bulk.desc', { defaultValue: '주문 양식(내 카탈로그·등급가 포함)을 받아 주문수량만 채워 업로드하면, 장바구니에 담아 예치금으로 한 번에 결제할 수 있어요.' })}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={downloadOrderForm} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold" style={{ background: '#fff', color: WT.ink, border: '1px solid ' + WT.line }}>
                  <Download className="w-4 h-4" /> {t('wholesale.bulk.download', { defaultValue: '주문 양식 다운로드' })}
                </button>
                <button onClick={() => bulkInputRef.current?.click()} disabled={bulkBusy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: WT.ink }}>
                  {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t('wholesale.bulk.upload', { defaultValue: '작성본 업로드 → 검토' })}
                </button>
                <input ref={bulkInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onBulkFile} className="hidden" />
              </div>

              {/* BIZ-9: 업로드 결과 패널 — N개 담김 · M개 오류(사유). 청구 전 검토 단계. */}
              {bulkPreview && (
                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid ' + WT.line, background: '#fff' }}>
                  <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: '1px solid ' + WT.line, background: WT.fill }}>
                    <span className="text-[13px] font-bold" style={{ color: WT.ink }}>
                      {t('wholesale.bulk.resultTitle', { defaultValue: '업로드 결과' })}
                      {' · '}
                      <span style={{ color: WT.brand }}>{comma(bulkPreview.items.length)}{t('wholesale.bulk.matchedSuffix', { defaultValue: '개 담김' })}</span>
                      {bulkPreview.errors.length > 0 && <span style={{ color: '#D92D20' }}>{' · '}{comma(bulkPreview.errors.length)}{t('wholesale.bulk.errorSuffix', { defaultValue: '개 오류' })}</span>}
                    </span>
                    <button onClick={() => setBulkPreview(null)} aria-label="닫기"><X className="w-4 h-4" style={{ color: WT.ink3 }} /></button>
                  </div>

                  {bulkPreview.items.length > 0 && (
                    <div className="px-3.5 py-2.5" style={{ borderBottom: bulkPreview.errors.length ? '1px solid ' + WT.line : undefined }}>
                      <div className="max-h-40 overflow-y-auto -mx-1 px-1">
                        {bulkPreview.items.slice(0, 50).map((it) => (
                          <div key={it.product_id} className="flex items-center justify-between py-1 text-[12px]">
                            <span className="truncate pr-2" style={{ color: WT.ink2 }}>{it.name}</span>
                            <span className="shrink-0 tabular-nums" style={{ color: WT.ink3 }}>{comma(it.qty)}개 · {won(it.line_total)}</span>
                          </div>
                        ))}
                        {bulkPreview.items.length > 50 && <p className="py-1 text-[11px]" style={{ color: WT.ink4 }}>외 {comma(bulkPreview.items.length - 50)}개…</p>}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 text-[13px] font-bold" style={{ borderTop: '1px dashed ' + WT.line, color: WT.ink }}>
                        <span>{t('wholesale.bulk.subtotal', { defaultValue: '합계' })}</span>
                        <span className="tabular-nums" style={{ color: WT.brand }}>{won(bulkPreview.subtotal)}</span>
                      </div>
                    </div>
                  )}

                  {bulkPreview.errors.length > 0 && (
                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-bold" style={{ color: '#D92D20' }}>{t('wholesale.bulk.errorRows', { defaultValue: '제외된 행' })} ({comma(bulkPreview.errors.length)})</span>
                        <button onClick={downloadBulkErrors} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: WT.ink3 }}>
                          <Download className="w-3 h-3" /> {t('wholesale.bulk.errorReport', { defaultValue: '오류 리포트' })}
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto -mx-1 px-1">
                        {bulkPreview.errors.slice(0, 30).map((er, i) => (
                          <div key={i} className="py-0.5 text-[11px]" style={{ color: WT.ink3 }}>
                            <span className="font-bold" style={{ color: WT.ink2 }}>{er.row ? `${er.row}행 ` : ''}{er.name || (er.product_id ? `#${er.product_id}` : '')}</span> — {er.reason}
                          </div>
                        ))}
                        {bulkPreview.errors.length > 30 && <p className="py-0.5 text-[11px]" style={{ color: WT.ink4 }}>외 {comma(bulkPreview.errors.length - 30)}개… (리포트 다운로드로 전체 확인)</p>}
                      </div>
                    </div>
                  )}

                  {bulkPreview.items.length > 0 && (
                    <div className="px-3.5 py-2.5" style={{ borderTop: '1px solid ' + WT.line }}>
                      <button onClick={addBulkToCart} className="w-full flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold text-white" style={{ background: WT.ink }}>
                        <ShoppingCart className="w-4 h-4" /> {t('wholesale.bulk.toCart', { defaultValue: '장바구니에 담고 결제하기' })}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button onClick={exportCatalog} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-10 text-[12px] font-bold" style={{ background: '#fff', color: WT.ink3, border: '1px solid ' + WT.line }}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 단가표 (.xlsx)
                </button>
                <button onClick={exportPriceListCsv} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl h-10 text-[12px] font-bold" style={{ background: '#fff', color: WT.ink3, border: '1px solid ' + WT.line }}>
                  <Download className="w-3.5 h-3.5" /> 단가표 다운로드 (CSV)
                </button>
              </div>
            </div>
  )
}
