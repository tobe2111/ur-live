/**
 * 🔍 서류 OCR — 읽은 값을 **등록 매장과 나란히** 보여 준다 (어드민 전용).
 *
 * 2026-09-16 (결재 `docs/decisions/2026-09-16-ocr-license-automation.md` §안전 레일 ①
 * *"1단계는 추출값을 어드민 화면에 입력값과 나란히 띄우기만 한다"*).
 *
 * ## 🩸 이 파일이 없으면 축 전체가 죽은 코드다
 * 라우트(`admin-seller-ocr.routes.ts`)·판정(`document-verify.ts`)·대조(`korean-address.ts`)를
 * 다 만들고도 **부르는 화면이 없었다.** 이 레포가 반복해 당한 *"코드에 있다 ≠ 살아 있다"* 가
 * 정확히 이 모양이다 — 에러도 안 나고, 테스트도 통과하고, 아무도 안 쓴다.
 *
 * ## 이 화면이 하지 않는 것
 * - **자동으로 안 돈다.** 어드민이 버튼을 눌러야 추론이 일어난다(비용을 사람이 쥔다).
 * - **승인·반려하지 않는다.** 판정은 참고고, 버튼은 이 패널 밖(기존 승인/반려)에 있다.
 * - 못 읽은 것을 "의심스럽다" 로 말하지 않는다 — `unreadable` 은 중립 톤이다.
 */
import { useState } from 'react'
import { ScanLine, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import type { DocKind } from '@/worker/utils/ocr-license'

interface OcrResponse {
  success: boolean
  code?: string
  error?: string
  kind?: DocKind
  kindLabel?: string
  verdict?: 'match' | 'review' | 'mismatch' | 'unreadable'
  summary?: string
  extracted?: {
    bizName: string | null; address: string | null; ownerName: string | null
    bizNumber: string | null; permitDate: string | null; fill: number
  }
  store?: { name: string | null; address: string | null }
  nameCheck?: { verdict: string; reason: string }
  addressCheck?: { verdict: string; reason: string }
  ledger?: { mgtNo: string; bizName: string | null; address: string | null; tradeState: string | null } | null
  ledgerNote?: string
}

/** 판정별 톤 — `mismatch` 만 빨강이고 `unreadable` 은 **중립**이다(자동 반려의 씨앗을 만들지 않는다). */
const VERDICT_TONE: Record<string, { label: string; cls: string }> = {
  match: { label: '일치', cls: 'bg-tone-ok-bg text-tone-ok' },
  review: { label: '확인 필요', cls: 'bg-tone-warn-bg text-tone-warn' },
  mismatch: { label: '불일치', cls: 'bg-tone-bad-bg text-tone-bad' },
  unreadable: { label: '못 읽음', cls: 'bg-gray-100 text-gray-600' },
}

function Row({ label, doc, store }: { label: string; doc: string | null; store?: string | null }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 break-all">{doc || <span className="text-gray-400">읽지 못함</span>}</span>
      <span className="text-gray-600 break-all">{store ?? <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function OcrComparePanel({ sellerId, hasPermit }: { sellerId: number; hasPermit?: boolean }) {
  const [busy, setBusy] = useState<DocKind | null>(null)
  const [res, setRes] = useState<OcrResponse | null>(null)

  async function run(kind: DocKind) {
    setBusy(kind)
    setRes(null)
    try {
      const r = await api.post<OcrResponse>(
        `/api/admin/sellers/${sellerId}/business-registration/ocr?kind=${kind}`, {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } },
      )
      setRes(r.data)
      // ⚠️ AI 바인딩 부재는 **실패가 아니라 부재**다 — 실패라고 하면 운영자가 사진을 다시 받으려 든다
      if (!r.data?.success) {
        const msg = r.data?.error || '읽지 못했습니다'
        if (r.data?.code === 'AI_UNAVAILABLE') toast.info(msg)
        else toast.error(msg)
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '요청에 실패했어요')
    } finally {
      setBusy(null)
    }
  }

  const tone = res?.verdict ? VERDICT_TONE[res.verdict] : null

  return (
    <div className="mt-4 rounded-lg border border-rule bg-white p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ScanLine className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">서류 읽어서 매장과 대조</span>
        <button type="button" onClick={() => run('business_registration')} disabled={!!busy}
          className="ur-btn ur-btn-sm ur-btn-secondary disabled:opacity-60">
          {busy === 'business_registration'
            ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> 읽는 중…</span>
            : '사업자등록증'}
        </button>
        {hasPermit && (
          <button type="button" onClick={() => run('business_license')} disabled={!!busy}
            className="ur-btn ur-btn-sm ur-btn-secondary disabled:opacity-60">
            {busy === 'business_license'
              ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> 읽는 중…</span>
              : '영업신고증'}
          </button>
        )}
      </div>

      {res?.success && res.extracted && (
        <div className="mt-3 text-xs">
          <div className="flex items-center gap-2 mb-2">
            {tone && <span className={`inline-flex px-2 py-0.5 rounded-full font-bold ${tone.cls}`}>{tone.label}</span>}
            <span className="text-gray-700">{res.summary}</span>
            <span className="ml-auto text-gray-400">{res.kindLabel} · 읽힘 {Math.round((res.extracted.fill || 0) * 100)}%</span>
          </div>

          <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2 pb-1 text-[11px] font-semibold text-gray-400 border-b border-gray-200">
            <span />
            <span>서류에서 읽은 값</span>
            <span>등록된 매장</span>
          </div>
          <Row label="상호" doc={res.extracted.bizName} store={res.store?.name} />
          <Row label="소재지" doc={res.extracted.address} store={res.store?.address} />
          <Row label="대표자" doc={res.extracted.ownerName} />
          <Row label={res.kind === 'business_license' ? '신고일' : '등록번호'}
            doc={res.kind === 'business_license' ? res.extracted.permitDate : res.extracted.bizNumber} />

          <div className="mt-2 space-y-1 text-[11px] text-gray-600">
            {res.addressCheck?.reason && <p>· 소재지 — {res.addressCheck.reason}</p>}
            {res.nameCheck?.reason && <p>· 상호 — {res.nameCheck.reason}</p>}
            {/* 원장은 커버리지가 1% 미만이라 **없는 것이 정상**이다 — 그 말을 서버 문구 그대로 싣는다 */}
            {res.ledgerNote && <p className="text-gray-500">· 인허가 원장 — {res.ledgerNote}</p>}
          </div>

          <p className="mt-2 text-[11px] text-gray-400">
            참고 자료입니다. 승인·반려는 아래 버튼으로 직접 판단해 주세요.
          </p>
        </div>
      )}
    </div>
  )
}
