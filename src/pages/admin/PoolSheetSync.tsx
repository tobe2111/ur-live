import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'

/**
 * 📊 **구글 시트 연동** — 파트너 풀·매장후보 풀 공용 패널(2026-11-04).
 *
 * 풀마다 시트 파일이 따로다. 대표가 빈 구글 시트를 만들고, 서비스계정 이메일에 편집자로 공유한 뒤,
 * 주소를 여기 붙여넣으면 매시간 자동으로 채워진다. 설계: `src/features/marketing/api/pool-sheets-sync.ts`.
 */
interface Status {
  sheetId: string | null; sheetUrl: string | null; saEmail: string | null; gate: boolean
  last: { at?: string; ok?: boolean; rows?: number | null; partial?: boolean; total?: number | null; error?: string | null } | null
  cursor: { off: number; total: number }
}

export default function PoolSheetSync({ pool }: { pool: 'company' | 'store' }) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<Status | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    try {
      const r = await api.get(`/api/admin/ads/pool-sheets?pool=${pool}`)
      setSt(r.data as Status)
    } catch { toast.error('시트 연동 상태 조회 실패 — 재로그인 후 시도') }
  }
  useEffect(() => { if (open && !st) void load() }, [open])

  async function save(value: string) {
    setBusy('save')
    try {
      await api.put('/api/admin/ads/pool-sheets', { pool, url: value })
      toast.success(value ? '시트 주소를 저장했습니다 — 첫 동기화를 시작합니다' : '연동을 해제했습니다')
      setUrl('')
      await load()
      if (value) await runNow()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      toast.error(msg || '저장 실패')
    } finally { setBusy('') }
  }

  async function runNow() {
    setBusy('sync')
    try {
      const r = await api.post('/api/admin/ads/pool-sheets/sync', { pool }, { timeout: 120000 })
      const d = r.data as { rows?: number; partial?: boolean; total?: number | null }
      toast.success(d.partial
        ? `${(d.rows || 0).toLocaleString()}줄을 썼습니다 — 나머지는 매시간 자동으로 이어 씁니다`
        : `시트를 끝까지 채웠습니다 (${(d.rows || 0).toLocaleString()}줄)`)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      toast.error(msg || '동기화 실패')
    } finally { setBusy(''); await load() }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg border border-rule bg-white text-gray-600 text-sm"
        title="구글 시트에 이 풀을 매시간 자동으로 옮겨 적습니다">
        구글 시트 연동
      </button>
    )
  }

  const last = st?.last
  const pct = st && st.cursor.total > 0 ? Math.min(100, Math.round((st.cursor.off / st.cursor.total) * 100)) : null

  return (
    <div className="w-full mt-3 rounded-xl bg-white shadow-lift p-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-gray-900">구글 시트 연동</p>
        <button onClick={() => setOpen(false)} className="text-[13px] text-gray-500">닫기</button>
      </div>

      {!st ? <p className="mt-3 text-[13px] text-gray-500">불러오는 중…</p> : (
        <>
          {st.sheetUrl ? (
            <div className="mt-2 text-[13px] text-gray-600 space-y-1">
              <p>
                연결된 시트: <a href={st.sheetUrl} target="_blank" rel="noreferrer" className="text-brand-text font-medium underline">시트 열기</a>
                {!st.gate && <span className="text-tone-warn"> · 자동 동기화가 꺼져 있습니다(ADS_SHEETS_SYNC_ENABLED)</span>}
              </p>
              {last?.at && (
                <p>
                  마지막 동기화 {formatKST(last.at)} ·{' '}
                  {last.ok ? <span className="text-tone-ok">성공</span> : <span className="text-tone-warn">실패 — {last.error}</span>}
                </p>
              )}
              {pct !== null && <p>이번 바퀴 진행 {st.cursor.off.toLocaleString()} / {st.cursor.total.toLocaleString()}줄 ({pct}%) · 매시간 이어서 씁니다</p>}
              <p>
                보낸 곳 표시: 시트 맨 오른쪽 <b>'이메일 보냄'</b> 칸에 아무 글자나(o) 적거나, <b>'발송기록'</b> 탭 A열에 보낸 이메일 주소를 붙여넣으세요.
                매시간 반영되어 날짜로 바뀌고 이 화면의 상태도 '연락함'이 됩니다. 시트에서 지워도 기록은 남습니다(되돌리기는 이 화면에서).
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={runNow} disabled={!!busy} className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">
                  {busy === 'sync' ? '동기화 중…' : '지금 동기화'}
                </button>
                <button onClick={() => save('')} disabled={!!busy} className="px-3 py-2 rounded-lg border border-rule bg-white text-gray-600 text-sm disabled:opacity-50">
                  연동 해제
                </button>
              </div>
            </div>
          ) : (
            <ol className="mt-2 text-[13px] text-gray-600 list-decimal pl-5 space-y-1">
              <li>구글 드라이브에서 <b>빈 스프레드시트</b>를 새로 만듭니다.</li>
              <li>
                오른쪽 위 <b>공유</b> → 아래 이메일을 <b>편집자</b>로 추가합니다.
                <div className="mt-1 flex items-center gap-2">
                  <code className="px-2 py-1 rounded bg-gray-100 text-gray-900 text-[12px] break-all">{st.saEmail || '(서비스계정 미설정)'}</code>
                  {st.saEmail && (
                    <button onClick={() => { void navigator.clipboard?.writeText(st.saEmail!); toast.success('복사했습니다') }}
                      className="text-[13px] text-brand-text">복사</button>
                  )}
                </div>
              </li>
              <li>그 시트의 주소(주소창 그대로)를 아래에 붙여넣고 저장합니다.</li>
            </ol>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…"
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm grow min-w-[260px]" />
            <button onClick={() => save(url)} disabled={!url.trim() || !!busy} className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">
              {busy === 'save' ? '저장 중…' : st.sheetUrl ? '다른 시트로 바꾸기' : '저장'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
