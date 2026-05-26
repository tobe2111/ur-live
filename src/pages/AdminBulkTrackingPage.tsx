/**
 * 🛡️ 2026-05-25 (migration 0279): 어드민 CSV 일괄 송장 업로드.
 *
 * /admin/shipping/bulk-tracking
 *
 * CSV 포맷:
 *   order_id,courier,tracking_number,shipped_at
 *   ORD-001,cj,123456789,2026-05-26
 *   ORD-002,한진,987654321,2026-05-26
 *
 * 동작:
 *   1. 드래그앤드롭 / 파일 선택
 *   2. 클라이언트 파싱 → preview
 *   3. dry_run=true 로 사전 검증 → 결과 표시
 *   4. 사용자 확인 → 실제 업로드 (dry_run=false)
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AdminLayout from '@/components/AdminLayout'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface ParsedRow {
  order_id: string
  courier: string
  tracking_number: string
  shipped_at?: string
}

interface UploadResult {
  status: 'ok' | 'skip' | 'error'
  order_id: string
  reason?: string
  courier?: string
}

interface UploadResponse {
  success: boolean
  dry_run: boolean
  summary: { total: number; succeeded: number; skipped: number; failed: number }
  results: UploadResult[]
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  // 헤더 자동 인식 — 첫 줄에 'order_id' 포함 시 skip
  const startIdx = lines[0].toLowerCase().includes('order_id') ? 1 : 0
  const rows: ParsedRow[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
    if (parts.length < 3) continue
    rows.push({
      order_id: parts[0],
      courier: parts[1],
      tracking_number: parts[2],
      shipped_at: parts[3] || undefined,
    })
  }
  return rows
}

export default function AdminBulkTrackingPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    setUploadResult(null)
    const text = await file.text()
    setRows(parseCSV(text))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function runUpload(dryRun: boolean) {
    if (!rows.length) {
      toast.error('업로드할 행이 없습니다')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/api/shipping/admin/bulk-tracking', {
        items: rows,
        dry_run: dryRun,
      })
      setUploadResult(res.data)
      if (res.data?.success) {
        if (dryRun) {
          toast.info(`사전 검증 완료 — 성공 ${res.data.summary.succeeded} / 실패 ${res.data.summary.failed}`)
        } else {
          toast.success(`업로드 완료 — 성공 ${res.data.summary.succeeded}`)
        }
      } else {
        toast.error(res.data?.error || '업로드 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '업로드 실패')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setRows([])
    setFileName(null)
    setUploadResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <AdminLayout title="CSV 일괄 송장 업로드">
      <div className="space-y-6">
        {/* 안내 */}
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-blue-900 mb-2">📋 CSV 포맷</h3>
          <pre className="text-xs text-blue-800 bg-white rounded p-2 overflow-x-auto">
{`order_id,courier,tracking_number,shipped_at
ORD-001,cj,123456789012,2026-05-26
ORD-002,한진,987654321098,2026-05-26
ORD-003,롯데,111122223333,`}
          </pre>
          <p className="text-xs text-blue-700 mt-2">
            • <strong>courier</strong>: cj / hanjin / lotte / kr_post / logen / cu / gs / daesin / ilyang / kdexp / 한글 표기도 OK<br/>
            • <strong>shipped_at</strong>: 비워두면 현재 시각<br/>
            • 같은 order_id 에 동일 송장이면 자동 skip (중복 처리 X)
          </p>
        </section>

        {/* 파일 업로드 */}
        {!rows.length ? (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-4xl mb-3">📤</p>
            <p className="text-base font-bold text-gray-700 mb-1">CSV 파일을 드래그하거나 클릭</p>
            <p className="text-xs text-gray-500">최대 1000행</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
        ) : (
          <>
            {/* preview */}
            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <header className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">📄 {fileName} — {rows.length}행</p>
                </div>
                <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700">초기화</button>
              </header>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">order_id</th>
                      <th className="px-3 py-2 text-left">courier</th>
                      <th className="px-3 py-2 text-left">tracking_number</th>
                      <th className="px-3 py-2 text-left">shipped_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-3 py-2">{r.order_id}</td>
                        <td className="px-3 py-2">{r.courier}</td>
                        <td className="px-3 py-2 font-mono">{r.tracking_number}</td>
                        <td className="px-3 py-2 text-gray-500">{r.shipped_at || '-'}</td>
                      </tr>
                    ))}
                    {rows.length > 20 && (
                      <tr><td colSpan={4} className="px-3 py-2 text-center text-gray-400">... 외 {rows.length - 20}행</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => runUpload(true)}
                disabled={loading}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl disabled:opacity-50"
              >
                🔍 사전 검증 (dry-run)
              </button>
              <button
                onClick={() => runUpload(false)}
                disabled={loading || !uploadResult?.dry_run}
                className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl disabled:opacity-50"
                title={!uploadResult?.dry_run ? '먼저 사전 검증을 실행하세요' : ''}
              >
                ✅ 실제 업로드
              </button>
            </div>

            {/* 결과 */}
            {uploadResult && (
              <section className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-bold mb-3">
                  {uploadResult.dry_run ? '🔍 사전 검증 결과' : '✅ 업로드 결과'}
                </h3>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">전체</p>
                    <p className="text-xl font-bold">{uploadResult.summary.total}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-emerald-700">성공</p>
                    <p className="text-xl font-bold text-emerald-700">{uploadResult.summary.succeeded}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-yellow-700">skip</p>
                    <p className="text-xl font-bold text-yellow-700">{uploadResult.summary.skipped}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-700">실패</p>
                    <p className="text-xl font-bold text-red-700">{uploadResult.summary.failed}</p>
                  </div>
                </div>

                {uploadResult.summary.failed > 0 && (
                  <div className="max-h-48 overflow-y-auto bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-red-700 mb-2">실패 행:</p>
                    {uploadResult.results
                      .filter(r => r.status === 'error')
                      .slice(0, 50)
                      .map((r, i) => (
                        <p key={i} className="text-xs text-red-700">
                          • <strong>{r.order_id}</strong>: {r.reason}
                        </p>
                      ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
