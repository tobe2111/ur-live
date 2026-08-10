/**
 * 💓 cron 하트비트 카드 3종 — `AdminSystemMonitoringPage` 에서 추출(2026-08-09, 600줄 래칫).
 *   ① 🔭 한 번도 안 돈 레인(게이트 ON·기록 0) ② 🪦 고아 기록(기록 있음·아무도 안 부름 — **삭제 도구**)
 *   ③ 💓 실행 기록(verdict 라벨 — main #1096 방식: 유령은 지우지 않고 회색 판정 표시).
 *   역할 분담: 목록 라벨링은 ③의 verdict, 행을 실제로 치우는 것은 ②의 ✕ (cron_hb + cron_cpu_death 짝 삭제).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { DashboardCard } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'

/** 💓 cron 실행 기록 — 서버 GET /api/admin/cron-heartbeats 응답 형태. */
export interface CronHeartbeat {
  name: string
  at: string | null
  ok: boolean | null
  ms: number | null
  age_minutes: number | null
  cron?: string | null
  /** 기대 주기 대비 '멈춤'으로 보이는가. 판단 불가면 null. */
  stale?: boolean | null
  /**
   * 🪦 그 '멈춤'을 **믿어도 되는가** — `judge` 만 진짜다.
   *   `superseded`=같은 일이 새 이름으로 돌고 있음 · `retired`=아무도 안 부르는 옛 이름.
   *   ⚠️ 이걸 안 쓰고 `stale` 만 빨갛게 칠하면 유령이 진짜를 덮는다 — 2026-08-08 에 화면이 12건을
   *   빨갛게 보여 줬지만 실제로 멈춘 건 하나였고, 그걸 읽은 두 세션이 나란히 오진했다.
   */
  verdict?: 'judge' | 'superseded' | 'retired' | null
  /** 마지막 실행이 무엇을 했는지 한 줄 요약. */
  result?: string | null
  /** 이 판정에 쓰인 기대 간격(분) — '왜 멈춤으로 봤나'의 근거. 안 보이면 또 오진한다. */
  max_gap_min?: number | null
}

interface Props {
  heartbeats: CronHeartbeat[]
  neverFired: string[]
  orphanLanes: string[]
  auth: { headers: { Authorization: string } }
  /** 삭제 후 목록 갱신(부모 쿼리 refetch). */
  onChanged: () => void
}

const fmtAge = (m: number) =>
  m < 60 ? `${m}분 전` : m < 60 * 24 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 60 / 24)}일 전`

export default function HeartbeatCards({ heartbeats, neverFired, orphanLanes, auth, onChanged }: Props) {
  const [deletingBeat, setDeletingBeat] = useState<string | null>(null)
  const orphanBeats = heartbeats.filter(h => new Set(orphanLanes).has(h.name))

  // 🪦 고아 하트비트 삭제 — 이름에 `?`/`:` 가 있어(maintenance?phase=…) path 가 아니라 body 로 보낸다.
  const deleteOrphanBeat = async (name: string) => {
    if (!window.confirm(`'${name}' 하트비트 기록을 지울까요?\n(레인이 실제로 살아 있으면 다음 실행이 행을 다시 만듭니다)`)) return
    setDeletingBeat(name)
    try {
      await api.post('/api/admin/cron-heartbeats/delete', { name }, auth)
      toast.success('기록 삭제됨 — 침묵 경보도 함께 멎습니다')
      onChanged()
    } catch { toast.error('실패') } finally { setDeletingBeat(null) }
  }

  return (
    <>
      {/* 🔭 '한 번도 안 돈 레인' — 하트비트 목록에는 **행 자체가 없어서** 위 목록으로는 절대 안 보인다.
          게이트는 켜져 있는데 기록이 없다는 뜻이라, '안 도는 건지 원래 없는 건지'를 여기서 가른다. */}
      {neverFired.length > 0 && (
        <DashboardCard className="!p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900">🔭 한 번도 안 돈 레인</h3>
            <span className="text-[11px] text-gray-500">게이트는 ON 인데 실행 기록이 없다</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {neverFired.map(n => (
              <span key={n} className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-semibold">{n}</span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            실행 기록이 아예 없으면 '멈춤 의심' 판정 대상조차 되지 않는다 — 그래서 따로 보여준다.
          </p>
        </DashboardCard>
      )}
      {/* 🪦 고아 기록 — 이름이 바뀌었거나 게이트가 꺼진 레인. 아무도 갱신 안 하니 **영원히 stale** 이다.
          실측(2026-07-29): `sweep-kakao-phone` 이 `sweep-kakao-chain` 으로 개명됐는데 옛 행이 계속 경보. */}
      {orphanLanes.length > 0 && (
        <DashboardCard className="!p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900">🪦 고아 기록</h3>
            <span className="text-[11px] text-gray-500">기록은 있는데 지금은 아무도 안 부른다</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {orphanLanes.map(n => {
              const age = orphanBeats.find(h => h.name === n)?.age_minutes
              return (
                <span key={n} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                  <span className="line-through">{n}</span>
                  {age != null && (
                    <span className="text-gray-400 no-underline">
                      {age < 60 * 24 ? `${Math.round(age / 60)}시간` : `${Math.round(age / 60 / 24)}일`}
                    </span>
                  )}
                  <button
                    onClick={() => deleteOrphanBeat(n)}
                    disabled={deletingBeat === n}
                    title="하트비트 기록 삭제 — 레인이 살아 있으면 다음 실행이 행을 다시 만든다"
                    className="ml-0.5 text-gray-400 hover:text-red-600 font-bold disabled:opacity-40"
                  >
                    {deletingBeat === n ? '…' : '✕'}
                  </button>
                </span>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            이름이 바뀌었거나 게이트가 꺼진 레인이다. 아무도 갱신하지 않으니 영원히 &lsquo;멈춤 의심&rsquo; 으로 남고
            침묵 경보도 은퇴 임계까지 계속 울린다 — ✕ 로 기록을 지우면 경보가 즉시 멎는다(개명 확인 후 지울 것).
          </p>
        </DashboardCard>
      )}
      {/* 💓 실행 하트비트 — '멈춤' 은 실패 목록에 안 나온다(예외가 없으니까). 여기서만 보인다. */}
      {heartbeats.length > 0 && (
        <DashboardCard className="!p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900">💓 cron 실행 기록</h3>
            <span className="text-[11px] text-gray-500">오래된 순 — 맨 위가 멈춤 의심 1순위</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
            {heartbeats.map(h => {
              // 🪦 유령(승계·은퇴)은 **빨갛게 칠하지 않는다** — 서버가 이미 판정을 실어 준다.
              //   지우지도 않는다(은퇴 시점을 봐야 하니까). 회색 라벨로 남겨 진짜 하나가 묻히지 않게.
              //   (의미 병합 2026-08-09: 행 제거 방식 대신 main #1096 의 verdict 라벨 채택 —
              //   삭제가 필요할 때만 위 '고아 기록' 카드의 ✕ 를 쓴다. 두 접근의 역할 분담.)
              const ghost = h.stale === true && (h.verdict === 'superseded' || h.verdict === 'retired')
              const realStale = h.stale === true && !ghost
              return (
                <div key={h.name} className="py-1.5 flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${realStale ? 'bg-red-500' : ghost ? 'bg-gray-300' : h.ok === false ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <span className={`font-medium truncate max-w-[190px] ${ghost ? 'text-gray-400' : 'text-gray-900'}`} title={h.name}>{h.name}</span>
                  <span className={`shrink-0 ${realStale ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    {h.age_minutes == null ? '기록 없음' : fmtAge(h.age_minutes)}
                  </span>
                  {realStale && <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold">멈춤 의심</span>}
                  {ghost && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
                      title={h.verdict === 'superseded' ? '같은 일이 새 이름으로 실행 중 — 이 이름은 아무도 갱신하지 않는다' : '아무도 안 부르는 옛 이름(개명·게이트 OFF)'}>
                      {h.verdict === 'superseded' ? '새 이름이 승계' : '은퇴한 이름'}
                    </span>
                  )}
                  {h.result && <span className="text-gray-400 truncate" title={h.result}>{h.result}</span>}
                  {h.max_gap_min != null && (
                    <span className="ml-auto shrink-0 text-gray-400" title="이 시간을 넘기면 '멈춤 의심'">
                      기준 {h.max_gap_min >= 60 ? `${Math.round(h.max_gap_min / 60)}시간` : `${h.max_gap_min}분`}
                    </span>
                  )}
                  {h.cron && <span className={`shrink-0 text-gray-300 font-mono ${h.max_gap_min == null ? 'ml-auto' : ''}`}>{h.cron}</span>}
                </div>
              )
            })}
          </div>
        </DashboardCard>
      )}
    </>
  )
}
