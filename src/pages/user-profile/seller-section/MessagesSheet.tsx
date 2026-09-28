/**
 * 💬 브랜드메시지 — 손님에게 나가는 알림톡 (2026-09-26, 대표 *"나머지도 다 해줘"*)
 *
 * ## 🔴 여기서 **보내지 않는다**
 * 발송은 등급 C(승인 전 실행 금지)다. 그리고 실수의 대가가 비대칭이다 — 안 보낸 건 나중에
 * 보내면 되지만, 잘못 보낸 문자는 회수가 안 된다. 그래서 이 시트는 **잔액과 최근 발송을 읽고**,
 * 실제 발송·템플릿 편집·충전은 전체화면으로 보낸다.
 *
 * ## 📏 실측(2026-09-26 라이브): 계정 0 · 템플릿 0 · 발송 0 · 충전 0
 * 아무도 아직 연결하지 않았다. 그렇다고 쿠폰처럼 **메뉴째 내리지는 않았다** — 쿠폰은 수단이
 * 넷이나 겹쳐서 내린 것이고, 이건 *아직 시작 안 한 것*이다. 대신 **상태에 따라 스스로 접힌다**:
 * 잔액이 0이고 발송 기록이 없으면 "무엇인지 + 시작하기" 한 장만 보여 준다. 첫 사용자가
 * 생기는 순간 플래그를 고칠 필요 없이 저절로 목록 화면이 된다.
 *
 * ## 충전은 결제라 마이에서 안 받는다
 * 결제 위젯은 Toss 잠금 경로이고 전용 화면(`/seller/alimtalk`)이 이미 그 흐름을 갖고 있다.
 * 여기에 두 번째 결제 입구를 만들면 두 벌이 갈린다.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import { currentSeatId } from '@/lib/seller-seat'
import Sheet from './Sheet'

interface LogRow {
  id?: number
  template_name?: string | null
  status?: string | null
  recipient?: string | null
  sent_at?: string | null
  created_at?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  sent: '보냄',
  success: '보냄',
  delivered: '도착',
  failed: '실패',
  pending: '보내는 중',
}

export default function MessagesSheet({ sellerId, onClose, onOpenPath }: {
  sellerId: number
  onClose: () => void
  /** 전체화면으로 나가는 일(충전·발송·템플릿). 호출부가 좌석·귀환 표시를 붙인다. */
  onOpenPath: (path: string) => void
}) {
  const [balance, setBalance] = useState<number | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // 🪑 §15-3 규칙 ①: 좌석이 맞을 때만 부른다 — 잔액은 가게별로 다르다.
  const load = useCallback(() => {
    if (currentSeatId() !== sellerId) { setFailed(true); setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.get('/api/seller/alimtalk/credits').catch(() => null),
      api.get('/api/seller/alimtalk/logs').catch(() => null),
    ])
      .then(([c, l]) => {
        // 잔액을 못 읽으면 **0 으로 덮지 않는다** — 모르는 것과 0원은 다르다(2026-06-26 룰).
        if (c?.data?.success) setBalance(Number(c.data.data?.balance ?? 0))
        else setFailed(true)
        if (l?.data?.success) setLogs(Array.isArray(l.data.data) ? l.data.data : [])
      })
      .finally(() => setLoading(false))
  }, [sellerId])

  useEffect(() => { load() }, [load])

  /** 아직 한 번도 안 쓴 가게 — 목록·잔액 대신 "무엇인지"를 먼저 말한다. */
  const neverUsed = !loading && !failed && (balance ?? 0) === 0 && logs.length === 0

  return (
    <Sheet
      title="브랜드메시지"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => onOpenPath('/seller/alimtalk')}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-90"
        >
          {neverUsed ? '브랜드메시지 시작하기' : '충전 · 보내기'}
        </button>
      }
    >
      {loading && (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}

      {failed && (
        <p className="px-4 py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          잔액을 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      )}

      {neverUsed && (
        <div className="px-4 py-8">
          <p className="text-[14px] font-bold text-gray-900 dark:text-white">아직 보낸 메시지가 없어요</p>
          <p className="mt-1.5 text-[13px] leading-[1.65] text-gray-500 dark:text-gray-400">
            단골에게 카카오톡으로 새 이용권·재방문 안내를 보낼 수 있어요.
            건당 요금이라 미리 충전해 두고 씁니다.
          </p>
          <p className="mt-3 text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400">
            보내기와 문구 만들기는 확인할 게 많아서 전체 화면에서 해요.
          </p>
        </div>
      )}

      {!loading && !failed && !neverUsed && (
        <div className="px-4 py-3">
          <div className="rounded-xl bg-wash px-4 py-3.5">
            <p className="text-[12px] text-gray-500 dark:text-gray-400">남은 건수</p>
            <p className="mt-0.5 text-[24px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
              {formatNumber(balance)}
              <span className="text-[13px] font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
            </p>
          </div>

          {logs.length > 0 && (
            <>
              <h3 className="mt-4 mb-1.5 px-1 text-[12px] font-bold text-gray-400">최근 발송</h3>
              <div className="space-y-1.5">
                {logs.slice(0, 20).map((g, i) => (
                  <div key={g.id ?? i} className="rounded-xl bg-wash px-3.5 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 min-w-0 truncate text-[13.5px] font-semibold text-gray-900 dark:text-white">
                        {g.template_name || '메시지'}
                      </span>
                      <span className="shrink-0 text-[12px] font-bold text-gray-500 dark:text-gray-400">
                        {STATUS_LABEL[String(g.status ?? '')] ?? g.status ?? '—'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                      {(g.sent_at || g.created_at) ? formatKSTShort(g.sent_at || g.created_at || '') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
