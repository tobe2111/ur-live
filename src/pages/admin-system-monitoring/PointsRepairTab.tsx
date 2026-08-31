/**
 * 🩹 **딜 잔액 정비** — 원장 정합 검사가 잡아낸 것을 사람이 눌러서 고치는 화면 (2026-08-31).
 *
 * ## 왜 화면이 필요한가
 *
 * 정비 도구는 API 로 먼저 만들었는데 **누를 자리가 없었다.** 그러면 결과적으로 세션이 curl 로
 * 부르는 것이 유일한 경로가 되고, 그건 CLAUDE.md 가 정한 *"잔액 교정은 머니 경로라 사람이 판단"*
 * 이 아니다. 대표가 **무엇이 바뀔지 표로 보고, 직접 누른다.**
 *
 * ## 화면 규칙
 *
 * - **검사(dry-run)가 먼저다.** 실행 버튼은 검사 결과를 본 뒤에만 열린다.
 * - 실행은 `confirmDialog` 로 한 번 더 묻는다 — 되돌릴 수 없는 것은 특히.
 * - 결과는 서버가 준 값을 **그대로** 보여 준다(요약해서 숨기지 않는다).
 *
 * ⚠️ 대시보드는 라이트 고정이다 — `dark:` 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { DashboardCard } from '@/components/dashboard'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { Wrench, Unlock, Play, Search, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface UnlockResult {
  had_check: boolean
  applied: boolean
  rows_before: number
  rows_after: number | null
  types_before: Record<string, number>
  types_after: Record<string, number> | null
  verified: boolean | null
  error?: string
}
interface OrphanRow { orphan_id: string; target_id: string; balance: number; name: string | null }
interface MismatchRow { user_id: string; balance: number; computed: number; diff: number }
interface ReconcileResponse {
  orphan?: { found: OrphanRow[]; results: { orphan_id: string; target_id: string; amount: number; outcome: string }[] } | null
  reconcile?: { found: MismatchRow[]; results: { user_id: string; adjust: number; outcome: string }[] } | null
}

const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } })

/** 서버가 준 그대로를 접어서 보여 준다 — 요약하다 중요한 걸 숨기지 않기 위해. */
function Raw({ data }: { data: unknown }) {
  return (
    <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-[11px] leading-relaxed text-gray-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function PointsRepairTab() {
  const [busy, setBusy] = useState<string | null>(null)
  const [unlock, setUnlock] = useState<UnlockResult | null>(null)
  const [recon, setRecon] = useState<ReconcileResponse | null>(null)
  const [reconApplied, setReconApplied] = useState(false)

  const call = async <T,>(path: string, body: Record<string, unknown>, label: string): Promise<T | null> => {
    setBusy(label)
    try {
      const r = await api.post(path, body, authHeaders())
      const d = r.data as { success?: boolean; error?: string } & T
      if (!d?.success) { toast.error(d?.error ? `실패 — ${d.error}` : '실패'); return null }
      return d
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      toast.error(e?.response?.data?.error ? `실패 — ${e.response.data.error}`
        : e?.response?.status ? `실패 (HTTP ${e.response.status})` : '실패 — 서버에 닿지 못했습니다')
      return null
    } finally { setBusy(null) }
  }

  const runUnlock = async (apply: boolean) => {
    if (apply) {
      const ok = await confirmDialog({
        title: '원장 제약을 제거합니다',
        message: '되돌릴 수 없는 스키마 변경입니다. 행과 값은 그대로 옮기고 제약만 없앱니다. 끝난 뒤 전후 행수·종류를 대조해 결과에 표시합니다.',
        confirmText: '제거한다', danger: true,
      })
      if (!ok) return
    }
    const d = await call<UnlockResult>('/api/admin/tools/point-ledger-unlock', { apply }, apply ? 'unlock-apply' : 'unlock-dry')
    if (d) {
      setUnlock(d)
      if (apply) {
        if (d.verified) toast.success('제약 제거 완료 — 전후 대조 일치')
        else toast.error('⚠️ 전후 대조 불일치 — 결과를 확인하세요')
      }
    }
  }

  const runReconcile = async (apply: boolean) => {
    if (apply) {
      const ok = await confirmDialog({
        title: '잔액 정비를 실행합니다',
        message: '쪼개진 잔액 행을 합치고(총액 보존), 설명되지 않는 잔액에 출처 불명 기록을 남깁니다. 보정 기록은 잔액을 바꾸지 않습니다.',
        confirmText: '실행한다', danger: true,
      })
      if (!ok) return
    }
    const d = await call<ReconcileResponse>('/api/admin/tools/points-reconcile', { apply, mode: 'both' }, apply ? 'recon-apply' : 'recon-dry')
    if (d) { setRecon(d); setReconApplied(apply); if (apply) toast.success('정비 실행 완료') }
  }

  const B = ({ on, kind, children }: { on: () => void; kind: 'check' | 'run'; children: React.ReactNode }) => (
    <button onClick={on} disabled={!!busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
        kind === 'run' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : kind === 'run' ? <Play className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
      {children}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" /> 돈을 만지는 도구입니다
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          모든 작업은 <b>검사(변경 없음)</b> 를 먼저 돌려 무엇이 바뀔지 본 다음에 실행하세요.
          실행 결과는 서버가 준 값을 그대로 보여 줍니다.
        </p>
      </div>

      <DashboardCard title="① 원장 제약 해제">
        <p className="text-xs leading-relaxed text-gray-600">
          원장 테이블이 <code className="rounded bg-gray-100 px-1">charge · donate · refund</code> 세 종류만 받고 있으면,
          가입 보너스·추천 보너스·초대 보상 같은 기록이 <b>전부 거부</b>됩니다. 기록 실패는 결제를 막지 않도록
          설계돼 있어서 <b>잔액만 움직이고 기록은 사라집니다</b> — 에러도 알림도 없이.
          이 작업은 <b>제약만</b> 없앱니다. 행·값·잔액은 그대로입니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <B on={() => runUnlock(false)} kind="check">검사 (변경 없음)</B>
          {unlock?.had_check && !unlock.applied && <B on={() => runUnlock(true)} kind="run">제약 제거 실행</B>}
        </div>
        {unlock && (
          <>
            <p className="mt-3 text-xs text-gray-700">
              {unlock.had_check
                ? <>옛 제약 <b className="text-red-600">있음</b> · {unlock.rows_before}행 · 종류 {Object.keys(unlock.types_before).length}가지</>
                : <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> 제약 없음 — 할 일 없습니다</span>}
              {unlock.applied && unlock.verified === true && <b className="ml-2 text-green-700">· 전후 대조 일치 ✓</b>}
              {unlock.applied && unlock.verified === false && <b className="ml-2 text-red-600">· ⚠️ 전후 대조 불일치</b>}
            </p>
            <Raw data={unlock} />
          </>
        )}
      </DashboardCard>

      <DashboardCard title="② 잔액 정비 (고아 병합 + 정합 보정)">
        <p className="text-xs leading-relaxed text-gray-600">
          <b>고아 병합</b> — 같은 사람의 잔액 행이 둘로 쪼개진 것을 합칩니다(총액 보존, 원장에 기록).
          <br />
          <b>정합 보정</b> — 설명되지 않는 잔액에 <i>출처 불명</i> 기록을 남깁니다. <b>잔액은 바뀌지 않습니다.</b>
          <br />
          ⚠️ ①을 먼저 하세요 — 제약이 남아 있으면 기록이 거부돼 보정이 실패합니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <B on={() => runReconcile(false)} kind="check">검사 (변경 없음)</B>
          {recon && !reconApplied && <B on={() => runReconcile(true)} kind="run">정비 실행</B>}
        </div>
        {recon && (
          <>
            <p className="mt-3 text-xs text-gray-700">
              고아 {recon.orphan?.found?.length ?? 0}건 · 불일치 {recon.reconcile?.found?.length ?? 0}명
              {reconApplied && <b className="ml-2 text-green-700">· 실행됨</b>}
            </p>
            <Raw data={recon} />
          </>
        )}
      </DashboardCard>
    </div>
  )
}
