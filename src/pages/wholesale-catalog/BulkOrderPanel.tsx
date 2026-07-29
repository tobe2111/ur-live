import { useState, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, FileSpreadsheet, X, ShoppingCart, Upload, Download } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT, won, comma } from '../wholesale/wholesale-theme'
import { parseCsvLine, downloadOrderForm, exportCatalog, exportPriceListCsv } from './csv-utils'
import { readTableFileAsCsv } from '@/lib/read-table-file'

// ── 대량 주문(엑셀) — 양식 다운로드 + 작성본 업로드 → 서버 검증/미리보기 → 카트 담기 → 예치금 체크아웃 ──
//   BIZ-9 (2026-06-09): 업로드 즉시 청구하지 않음. 서버 /orders/bulk-preview 가 product_id 매칭 +
//   MOQ/박스단위/재고 검증 → 유효 라인 + 오류행(사유) 반환. 사용자가 확인 후 카트에 담아 기존 예치금 결제.
//   WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0) — 패널 전용 상태/핸들러는 이 컴포넌트로 이동.
export default function BulkOrderPanel({ token }: { token: string | null }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const bulkInputRef = useRef<HTMLInputElement | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  type ShipTo = { name: string; phone: string; postal: string; address: string; message: string }
  type BulkPreviewItem = { row: number; product_id: number; name: string; image_url: string | null; option: string; qty: number; unit_price: number; line_total: number; ship_to: ShipTo; ext_order_no: string }
  type BulkPreviewError = { row?: number; product_id?: number | null; name?: string; qty?: number; reason: string }
  const [bulkPreview, setBulkPreview] = useState<{ items: BulkPreviewItem[]; subtotal: number; shippingTotal: number; grandTotal: number; allMinMet: boolean; errors: BulkPreviewError[]; idem: string } | null>(null)

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
      const norm = header.map(h => h.replace(/\s/g, '')) // 공백 제거 후 매칭(외부 발주서 헤더도 유연 인식)
      const incl = (...kws: string[]) => { for (const kw of kws) { const i = norm.findIndex(h => h.includes(kw)); if (i >= 0) return i } return -1 }
      const pidIdx = norm.findIndex(h => h.toLowerCase() === 'product_id')
      const codeIdx = incl('상품코드')
      let qtyIdx = norm.findIndex(h => h === '주문수량'); if (qtyIdx < 0) qtyIdx = incl('수량')
      const optIdx = incl('옵션', '상품상세')   // 옵션(상품상세1 = 옵션)
      const recipIdx = incl('받는사람', '수령인', '수취인', '받는분')
      const phoneIdx = incl('전화', '연락처', '휴대폰', '핸드폰')
      const postalIdx = incl('우편')
      const addrIdx = incl('주소')
      const msgIdx = incl('배송메시지', '배송요청', '메시지', '메모', '요청사항')
      const orderNoIdx = incl('주문번호')
      if (pidIdx < 0 && codeIdx < 0) { toast.error('product_id 또는 상품코드 열을 찾을 수 없어요 (양식을 다시 받아주세요)'); return }
      if (qtyIdx < 0) qtyIdx = norm.length - 1 // 주문수량/수량 헤더 없으면 마지막 열
      const MAX_ROWS = 5000
      const val = (cols: string[], idx: number) => idx >= 0 ? String(cols[idx] ?? '').trim() : ''
      // 행번호(엑셀 기준, 헤더=1행) 포함해 서버로 전송. 한 행 = 한 명에게 보내는 1건(드랍십).
      const rows: Array<{ product_id?: number; code?: string; qty: number; option: string; ext_order_no: string; ship_to: ShipTo; row: number }> = []
      for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
        const cols = parseCsvLine(lines[i])
        const pidRaw = pidIdx >= 0 ? String(cols[pidIdx] ?? '').replace(/[^0-9]/g, '') : ''
        const pid = Number(pidRaw)
        const code = val(cols, codeIdx)
        const qty = Math.floor(Number(String(cols[qtyIdx] ?? '').replace(/[^0-9.]/g, '')))
        const ship_to: ShipTo = { name: val(cols, recipIdx), phone: val(cols, phoneIdx), postal: val(cols, postalIdx), address: val(cols, addrIdx), message: val(cols, msgIdx) }
        const hasPid = !!pidRaw && Number.isFinite(pid) && pid > 0
        // 매칭키(product_id/상품코드)도 없고 받는사람/주소도 없는 완전 빈 줄은 skip.
        if (!hasPid && !code && !ship_to.name && !ship_to.address) continue
        rows.push({ product_id: hasPid ? pid : undefined, code: code || undefined, qty: Number.isFinite(qty) ? qty : 0, option: val(cols, optIdx), ext_order_no: val(cols, orderNoIdx), ship_to, row: i + 1 })
      }
      if (!rows.length) { toast.error('처리할 행이 없어요. 양식을 다시 받아주세요'); return }
      const idem = (globalThis.crypto?.randomUUID?.() || `bulk-${Date.now()}-${Math.floor(Math.random() * 1e6)}`)
      // 서버 검증/미리보기 — 청구하지 않음. (상품코드는 product_id 로 해석됨)
      const r = await api.post('/api/wholesale/orders/bulk-preview', { items: rows }, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.data?.success) { toast.error(r.data?.error || '주문서 검증에 실패했어요'); return }
      const items: BulkPreviewItem[] = r.data.items || []
      const errors: BulkPreviewError[] = r.data.errors || []
      const subtotal = Number(r.data.subtotal) || 0
      const shippingTotal = Number(r.data.shipping_total) || 0
      const grandTotal = Number(r.data.grand_total) || (subtotal + shippingTotal)
      const allMinMet = r.data.all_min_met !== false
      if (!items.length && !errors.length) { toast.error('처리할 행이 없어요'); return }
      setBulkPreview({ items, subtotal, shippingTotal, grandTotal, allMinMet, errors, idem })
      if (items.length) toast.success(`${comma(items.length)}건 발주 가능${errors.length ? ` · ${comma(errors.length)}개 오류` : ''}`)
      else toast.error(`발주 가능한 건이 없어요 (${comma(errors.length)}개 오류)`)
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || '주문서 업로드 중 오류가 발생했어요')
    } finally { setBulkBusy(false) }
  }
  // 미리보기(받는사람별 라인) → 예치금으로 즉시 발주(드랍십). 제조사가 각 받는사람에게 직배.
  async function submitDropshipOrder() {
    if (!bulkPreview?.items.length || submitting) return
    setSubmitting(true)
    try {
      const orderItems = bulkPreview.items.map(it => ({ product_id: it.product_id, qty: it.qty, option: it.option, ext_order_no: it.ext_order_no, ship_to: it.ship_to }))
      const res = await api.post('/api/wholesale/orders', { dropship: true, items: orderItems, idempotency_key: bulkPreview.idem }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) {
        const n = Number(res.data.line_count) || orderItems.length
        setBulkPreview(null)
        toast.success(`${comma(n)}건 발주 완료 · ${won(Number(res.data.amount) || 0)} 예치금 결제`)
        navigate('/wholesale/orders')
      } else {
        toast.error(res.data?.error || '발주에 실패했어요')
      }
    } catch (err) {
      const d = (err as { response?: { data?: { error?: string; code?: string; required?: number } } })?.response?.data
      if (d?.code === 'INSUFFICIENT_DEPOSIT') {
        toast.error(`예치금이 부족해요 (필요 ${won(Number(d.required) || 0)}). 충전 후 다시 발주해주세요`)
        navigate('/wholesale/deposits')
      } else {
        toast.error(d?.error || '발주 중 오류가 발생했어요')
      }
    } finally { setSubmitting(false) }
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
                <span className="text-[14px] font-bold" style={{ color: WT.ink }}>대량 발주 (엑셀 · 드랍십)</span>
                <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: WT.brandSoft, color: WT.brand }}>받는사람별 직배</span>
              </div>
              <p className="text-[12px] mb-3" style={{ color: WT.ink3 }}>{t('wholesale.bulk.desc', { defaultValue: '양식을 받아 한 행에 한 명씩(상품·옵션·수량·받는사람·주소)을 채워 업로드하면, 제조사가 각 받는사람에게 직접 발송합니다. 상품은 product_id 또는 상품코드로 매칭돼요.' })}</p>
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
                      <span style={{ color: WT.brand }}>{comma(bulkPreview.items.length)}{t('wholesale.bulk.matchedSuffix', { defaultValue: '건 발주 가능' })}</span>
                      {bulkPreview.errors.length > 0 && <span style={{ color: '#D92D20' }}>{' · '}{comma(bulkPreview.errors.length)}{t('wholesale.bulk.errorSuffix', { defaultValue: '개 오류' })}</span>}
                    </span>
                    <button onClick={() => setBulkPreview(null)} aria-label="닫기"><X className="w-4 h-4" style={{ color: WT.ink3 }} /></button>
                  </div>

                  {bulkPreview.items.length > 0 && (
                    <div className="px-3.5 py-2.5" style={{ borderBottom: bulkPreview.errors.length ? '1px solid ' + WT.line : undefined }}>
                      <div className="max-h-44 overflow-y-auto -mx-1 px-1">
                        {bulkPreview.items.slice(0, 50).map((it, i) => (
                          <div key={`${it.row}-${i}`} className="flex items-start justify-between py-1 text-[12px] gap-2">
                            <span className="min-w-0 flex-1" style={{ color: WT.ink2 }}>
                              <span className="font-semibold">{it.ship_to.name || '받는사람 미입력'}</span>
                              <span style={{ color: WT.ink4 }}> · {it.name}{it.option ? ` (${it.option})` : ''}</span>
                            </span>
                            <span className="shrink-0 tabular-nums" style={{ color: WT.ink3 }}>{comma(it.qty)}개 · {won(it.line_total)}</span>
                          </div>
                        ))}
                        {bulkPreview.items.length > 50 && <p className="py-1 text-[11px]" style={{ color: WT.ink4 }}>외 {comma(bulkPreview.items.length - 50)}건…</p>}
                      </div>
                      <div className="mt-2 pt-2 space-y-1 text-[12px]" style={{ borderTop: '1px dashed ' + WT.line }}>
                        <div className="flex items-center justify-between" style={{ color: WT.ink3 }}><span>상품 합계</span><span className="tabular-nums">{won(bulkPreview.subtotal)}</span></div>
                        {bulkPreview.shippingTotal > 0 && <div className="flex items-center justify-between" style={{ color: WT.ink3 }}><span>배송비</span><span className="tabular-nums">{won(bulkPreview.shippingTotal)}</span></div>}
                        <div className="flex items-center justify-between text-[13px] font-bold pt-0.5" style={{ color: WT.ink }}><span>총 결제(예치금)</span><span className="tabular-nums" style={{ color: WT.brand }}>{won(bulkPreview.grandTotal)}</span></div>
                      </div>
                      {!bulkPreview.allMinMet && <p className="mt-2 text-[11.5px] font-semibold" style={{ color: '#D92D20' }}>일부 제조사의 최소 주문 금액을 채우지 못했어요. 수량을 늘리거나 해당 행을 빼주세요.</p>}
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
                      <button onClick={submitDropshipOrder} disabled={submitting || !bulkPreview.allMinMet} className="w-full flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: WT.ink }}>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} {t('wholesale.bulk.submit', { defaultValue: '예치금으로 발주하기' })} · {won(bulkPreview.grandTotal)}
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
