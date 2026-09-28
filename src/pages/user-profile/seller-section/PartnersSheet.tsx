/**
 * 🤝 소개 파트너 — 내 가게를 소개해 주는 사람들 (2026-09-26, 대표 *"나머지도 다 해줘"*)
 *
 * ## 무엇을 하나
 * 받은 **협업 제안**을 보고 수락/거절한다. 수락하면 그 사람이 내 이용권을 자기 유어샵에 담아
 * 팔고, 팔린 만큼 약속한 소개비(`commission_pct`)를 가져간다.
 *
 * ## 📏 실측(2026-09-26 라이브): 제안 1건(active) · 팔로워 3
 * 쿠폰·숙소와 달리 **실제로 쓰이고 있다** — 그래서 내리지 않고 마이 안으로 들였다.
 *
 * ## 🔴 수락은 되돌릴 수 없는 약속이라 화면이 조건을 지어내지 않는다
 * 서버는 셋이 전부 맞을 때만 응답을 받는다(`/deals/:id/respond`):
 *   ① `status === 'proposed'` ② `proposed_by === 'influencer'` ③ `requires_content_proof` 가 0.
 * 화면은 **그 셋을 그대로 읽어** 버튼을 낸다. 조건을 느슨하게 그리면 눌러도 404 가 나고
 * 사장님은 왜 안 되는지 모른다 — 안 되는 이유를 화면이 **문장으로** 말한다.
 *
 * ## 못 하는 것 (여기서 안 한다)
 * - **내가 먼저 제안하기**: 상대를 찾는 일(검색·필터·프로필)이라 전체화면이 맞다 → `파트너 찾기`.
 * - **요율 변경**: 이미 발효된 약속의 돈 조건을 바꾸는 일이라 마이의 시트에서 다루지 않는다.
 * - **콘텐츠 인증 심사**(`requires_content_proof=1`): 증빙 링크를 열어 봐야 하므로 전체화면.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { formatKSTDate } from '@/utils/date'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'

/** `GET /api/seller-marketing/deals` 의 행. 이름은 서버와 1:1. */
interface Deal {
  id: number
  influencer_id?: number | string | null
  commission_pct?: number | null
  status?: string | null
  proposed_by?: string | null
  message?: string | null
  created_at?: string | null
  requires_content_proof?: number | null
  proof_status?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  proposed: '답변 기다리는 중',
  active: '진행 중',
  rejected: '거절함',
  ended: '끝남',
  expired: '기간 지남',
}

/**
 * 이 제안에 **지금 답할 수 있는가**, 없으면 왜 없는가.
 * 서버 `/deals/:id/respond` 의 WHERE 와 같은 조건이다 — 한쪽만 바뀌면 눌러도 404 가 난다.
 */
export function respondability(d: Deal): { can: true } | { can: false; why: string | null } {
  if (String(d.status ?? '') !== 'proposed') return { can: false, why: null }   // 답할 단계가 아님(상태 배지로 충분)
  if (String(d.proposed_by ?? '') !== 'influencer') return { can: false, why: '내가 보낸 제안이라 상대의 답을 기다려요' }
  if (Number(d.requires_content_proof ?? 0) === 1) {
    return { can: false, why: '콘텐츠 인증이 걸린 제안이에요. 증빙을 확인해야 해서 파트너 화면에서 처리합니다' }
  }
  return { can: true }
}

export default function PartnersSheet({ sellerId, onClose, onOpenPath }: {
  sellerId: number
  onClose: () => void
  /** 전체화면으로 나가야 하는 일(파트너 찾기·증빙 심사). 호출부가 좌석·귀환 표시를 붙인다. */
  onOpenPath: (path: string) => void
}) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  // 🪑 §15-3 규칙 ①: 좌석이 맞을 때만 부른다.
  const load = useCallback(() => {
    if (currentSeatId() !== sellerId) { setFailed(true); setLoading(false); return }
    setLoading(true)
    api.get('/api/seller-marketing/deals')
      .then((r) => {
        if (!r.data?.success) { setFailed(true); return }
        setDeals(Array.isArray(r.data.data) ? r.data.data : [])
        setFailed(false)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [sellerId])

  useEffect(() => { load() }, [load])

  async function respond(id: number, action: 'accept' | 'reject') {
    if (busyId != null) return
    setBusyId(id)
    try {
      // 🪑 §15-3 규칙 ②: 보내기 직전에 좌석을 다시 확인한다(그 사이 가게를 바꿨을 수 있다).
      assertSeat(sellerId)
      const r = await api.post(`/api/seller-marketing/deals/${id}/respond`, { action })
      if (!r.data?.success) { toast.error(r.data?.error || '처리하지 못했습니다'); return }
      toast.success(action === 'accept' ? '제안을 수락했어요' : '제안을 거절했어요')
      load()
    } catch (e) {
      if (e instanceof SeatMismatchError) { toast.error('가게가 바뀌었어요. 다시 열어 주세요'); onClose(); return }
      toast.error('처리하지 못했습니다')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet
      title="소개 파트너"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => onOpenPath('/seller/influencers')}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-90"
        >
          파트너 찾기
        </button>
      }
    >
      <div className="px-4 pt-3">
        <p className="text-[12.5px] leading-[1.6] text-gray-500 dark:text-gray-400">
          내 이용권을 자기 유어샵에 담아 파는 사람들이에요. 수락하면 팔린 만큼 소개비가 나갑니다.
        </p>
      </div>

      {loading && (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}

      {failed && (
        <p className="px-4 py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          제안을 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      )}

      {!loading && !failed && deals.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-[14px] font-bold text-gray-900 dark:text-white">아직 받은 제안이 없어요</p>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            아래에서 직접 파트너를 찾아 제안할 수도 있어요.
          </p>
        </div>
      )}

      {deals.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          {deals.map((d) => {
            const r = respondability(d)
            const status = String(d.status ?? '')
            return (
              <div key={d.id} className="rounded-xl bg-wash px-3.5 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-bold text-gray-900 dark:text-white">
                    소개비 {Number(d.commission_pct ?? 0)}%
                  </span>
                  <span className="flex-1" />
                  <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    {STATUS_LABEL[status] ?? status ?? '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                  {d.proposed_by === 'influencer' ? '상대가 보낸 제안' : '내가 보낸 제안'}
                  {d.created_at && <> · {formatKSTDate(d.created_at)}</>}
                </p>
                {d.message && (
                  <p className="mt-1.5 text-[12.5px] leading-[1.55] text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                    {d.message}
                  </p>
                )}

                {r.can && (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId != null}
                      onClick={() => respond(d.id, 'accept')}
                      className="flex-1 h-10 rounded-lg bg-brand text-white text-[13.5px] font-bold active:opacity-90 disabled:opacity-50"
                    >
                      {busyId === d.id ? '처리 중…' : '수락'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId != null}
                      onClick={() => respond(d.id, 'reject')}
                      className="px-4 h-10 rounded-lg bg-surface text-[13.5px] font-bold text-gray-900 dark:text-white active:opacity-70 disabled:opacity-50"
                    >
                      거절
                    </button>
                  </div>
                )}
                {/* 왜 못 누르는지 화면이 말한다 — 안 그러면 버튼이 없는 이유를 아무도 모른다. */}
                {!r.can && r.why && (
                  <p className="mt-2 text-[12px] leading-[1.55] text-gray-500 dark:text-gray-400">{r.why}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
