import { useMemo, useRef, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import {
  parseOutreachCsv, OUTREACH_STATUSES, OUTREACH_INGEST_MAX,
  type OutreachItem, type OutreachStatus,
} from '@/features/marketing/api/outreach-status-ingest'

/**
 * 📬 **발송 결과 붙여넣기** — 2026-08-04 대표 *"①부터 진행해줘"*.
 *
 * ## 왜 이게 먼저인가
 * 결과 유입 **엔드포인트는 이미 있다**(#1049 `POST /api/admin/ads/outreach/status`). 그런데 화면이 없어서
 * 넣으려면 `curl` 을 짜야 했고, 그래서 **라이브 `email_status` 가 0건**이었다 — 반응 루프의 열린 끝이
 * 기술이 아니라 **마찰**이었다는 뜻이다. 대표는 이미 엑셀로 내보내 직접 발송 중이므로,
 * **그 버튼 옆에 붙여넣기 하나**면 왕복이 닫힌다.
 *
 * ## 이 화면이 지키는 것
 *   · **파서는 서버와 같은 것을 쓴다**(`parseOutreachCsv` 를 그대로 import) — 화면이 "인식 N건"이라 해놓고
 *     서버가 다르게 세면 그 숫자는 거짓말이 된다. 두 벌을 두면 반드시 갈라진다.
 *   · **결과를 토스트로 흘리지 않는다** — `적용/미매칭/무시` 를 패널에 남긴다. 특히 `미매칭`(풀에 없는 주소)은
 *     조용한 0건과 구분이 안 되므로, 절반만 먹힌 업로드를 "성공"으로 읽지 않게 화면에 박아 둔다.
 *   · **무시 행의 실물을 보여준다**(최대 3줄) — 첫 업로드에서 컬럼 형식이 안 맞으면 그 줄이 곧 진단이다.
 *     이게 없으면 "invalid 400건" 만 보고 원인을 물어보는 왕복이 한 번 더 생긴다.
 *   · 500건 상한은 **클라에서 나눠 보낸다** — 대표가 파일을 쪼갤 이유가 없다.
 *
 * ⚠️ 어드민은 라이트 고정 — 다크 variant 금지(테스트가 소스 전체를 검사하므로 주석에도 쓰지 말 것).
 */
const STATUS_LABEL: Record<OutreachStatus, string> = {
  sent: '보냄', opened: '열람', replied: '회신', bounced: '반송', complained: '스팸신고', opt_out: '수신거부',
}

interface IngestResult { applied: number; unmatched: number; invalid: number; error?: string }

export default function OutreachResultPanel() {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 서버와 **같은 파서** — 화면의 "인식 N건"이 실제 반영 대상과 어긋나지 않게.
  const parsed = useMemo(() => parseOutreachCsv(raw), [raw])
  const byStatus = useMemo(() => {
    const m = new Map<OutreachStatus, number>()
    for (const it of parsed.items) m.set(it.status, (m.get(it.status) || 0) + 1)
    return m
  }, [parsed.items])
  // 🔎 무시된 줄의 실물 — 형식이 안 맞을 때 이게 곧 진단이다(없으면 원인 물어보는 왕복이 생긴다).
  const badLines = useMemo(() => {
    if (!parsed.invalid) return [] as string[]
    const ok = new Set(parsed.items.map(i => i.email))
    return raw.split(/\r?\n/).map(l => l.trim())
      .filter(l => l && !ok.has((l.split(/[,;\t]/)[0] || '').trim().replace(/^"|"$/g, '').toLowerCase()))
      .filter(l => !parsed.items.some(i => l.toLowerCase().includes(i.email)))
      .slice(0, 3)
  }, [raw, parsed])

  async function pickFile(f: File | null | undefined) {
    if (!f) return
    setRaw(await f.text())
    setResult(null)
  }

  async function submit() {
    if (!parsed.items.length) return
    setBusy(true)
    setResult(null)
    try {
      const acc: IngestResult = { applied: 0, unmatched: 0, invalid: parsed.invalid }
      for (let i = 0; i < parsed.items.length; i += OUTREACH_INGEST_MAX) {
        const items: OutreachItem[] = parsed.items.slice(i, i + OUTREACH_INGEST_MAX)
        const r = await api.post('/api/admin/ads/outreach/status', { items })
        const d = r.data as { success?: boolean; applied?: number; unmatched?: number; error?: string }
        if (!d?.success) { acc.error = d?.error || '반영 실패'; break }
        acc.applied += Number(d.applied) || 0
        acc.unmatched += Number(d.unmatched) || 0
      }
      setResult(acc)
      if (acc.error) toast.error(acc.error)
      else if (acc.applied) toast.success(`📬 ${formatNumber(acc.applied)}행 반영 완료`)
      else toast.info('반영된 행이 없습니다 — 풀에 없는 주소일 수 있습니다')
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '반영 실패'
      setResult({ applied: 0, unmatched: 0, invalid: parsed.invalid, error: msg })
      toast.error(msg)
    } finally { setBusy(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium"
        title="메일 도구의 결과(회신·반송·수신거부)를 붙여넣으면 풀에 반영 — 반송 주소는 다음 발송에서 자동 제외됩니다">
        📬 발송 결과 반영
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">📬 발송 결과 반영 (회신 · 반송 · 수신거부)</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm" aria-label="닫기">✕</button>
            </div>

            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 leading-relaxed">
              메일 도구에서 받은 결과를 <b>이메일 · 상태</b> 두 칸이 들어가게 붙여넣으세요. <b>열 순서는 달라도 됩니다</b> —
              행 안에서 이메일과 상태를 찾아냅니다(구분자는 쉼표·세미콜론·탭).
              <div className="mt-1 text-[11px] text-amber-800">
                상태값: {OUTREACH_STATUSES.map(s => `${s}(${STATUS_LABEL[s]})`).join(' · ')}
              </div>
              <div className="mt-1 text-[11px] text-amber-800">
                반송·스팸신고는 다음 발송에서 자동 제외되고, 회신은 리마인더에서 빠집니다. 같은 파일을 두 번 넣어도 안전합니다(최초 시각 보존).
              </div>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
                onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs">
                📎 CSV 파일 열기
              </button>
              {raw ? <button onClick={() => { setRaw(''); setResult(null) }} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 text-xs">지우기</button> : null}
            </div>

            <textarea value={raw} onChange={e => { setRaw(e.target.value); setResult(null) }} rows={8}
              placeholder={'email,status\nsomeone@example.com,replied\nbounce@example.com,bounced'}
              className="w-full mb-2 px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 font-mono" />

            <div className="mb-3 text-[12px] text-gray-600">
              인식: <b className="text-gray-900">{formatNumber(parsed.items.length)}</b>행
              {parsed.invalid ? <span className="ml-2 text-amber-700">무시 {formatNumber(parsed.invalid)}행</span> : null}
              {byStatus.size ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {OUTREACH_STATUSES.filter(s => byStatus.get(s)).map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                      {STATUS_LABEL[s]} {formatNumber(byStatus.get(s) || 0)}
                    </span>
                  ))}
                </div>
              ) : null}
              {badLines.length ? (
                <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5">
                  <div className="text-[11px] text-gray-500 mb-0.5">무시된 줄(형식 확인용, 최대 3줄):</div>
                  {badLines.map((l, i) => <div key={i} className="text-[11px] text-gray-700 font-mono truncate">{l}</div>)}
                </div>
              ) : null}
            </div>

            <button onClick={submit} disabled={busy || !parsed.items.length}
              className="w-full py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40">
              {busy ? '반영 중…' : `${formatNumber(parsed.items.length)}행 반영`}
            </button>

            {/* 📊 결과는 토스트로 흘리지 않는다 — 미매칭은 조용한 0건과 구분이 안 되므로 화면에 남긴다. */}
            {result ? (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${result.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {result.error ? <div className="font-semibold mb-1">⚠ {result.error}</div> : <div className="font-semibold mb-1">✅ 반영 완료</div>}
                <div>적용 <b>{formatNumber(result.applied)}</b>행
                  {' · '}미매칭 <b>{formatNumber(result.unmatched)}</b>건
                  {result.invalid ? <> {' · '}무시 <b>{formatNumber(result.invalid)}</b>행</> : null}
                </div>
                {result.unmatched ? (
                  <div className="mt-1 text-[11px] opacity-90">미매칭 = 풀에 없는 주소입니다(수집 전이거나 오타). 반영은 나머지에 정상 적용됐습니다.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
