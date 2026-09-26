/**
 * 🧾 지난 정산 — 신청한 돈이 어디까지 왔나 (2026-09-26, 대표 *"나머지도 다 해줘"*)
 *
 * ## 왜 출금과 따로인가
 * `WithdrawSheet` 는 **보내는** 화면이고 여기는 **받은 기록**이다. 한 시트에 합치면 돈을 보내려고
 * 연 사람이 과거 목록을 스크롤해야 하고, 기록을 보려던 사람 앞에 금액 입력칸이 뜬다.
 * 출금 시트 바닥에서 이 시트를 연다(주문 → 환불과 같은 배치).
 *
 * ## 📏 오늘 라이브에는 0행이다 (2026-09-26 실측)
 * `settlements` 테이블이 **비어 있다** — 아무도 아직 출금을 신청하지 않았다는 뜻이지 기능이
 * 죽은 게 아니다. 그래서 숨기지 않고 **빈 상태를 정직하게 말한다**: 신청하면 여기 쌓인다고.
 * (쿠폰·숙소처럼 "쓴 적 없어서 내리는" 것과 다르다 — 저건 *입구*가 0이고 이건 *결과*가 0이다.)
 *
 * ## 🔴 화면이 금액을 만들지 않는다
 * 표시되는 숫자는 전부 서버가 계산해 준 값(`settlement_amount`·`total_sales`·`commission_amount`)을
 * 그대로 찍는다. 여기서 빼고 더하면 대시보드와 마이가 다른 금액을 말하는 날이 온다.
 *
 * ## 못 하는 것
 * - **취소·수정 불가**(조회 전용). 정산 행을 바꾸는 건 어드민 지급 센터의 일이다.
 * - 세금계산서·명세서 다운로드는 여기 없다 — 파일을 받는 일이라 전체화면으로 보낸다.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import { currentSeatId } from '@/lib/seller-seat'
import Sheet from './Sheet'

/** 서버가 내려 주는 정산 행. 필드 이름은 `GET /api/seller/settlements` 와 1:1 이다. */
interface Row {
  id: number
  settlement_amount?: number | null
  total_sales?: number | null
  commission_amount?: number | null
  status?: string | null
  period_start?: string | null
  period_end?: string | null
  requested_at?: string | null
}

/** 서버 status → 사람 말. 모르는 값은 그대로 보여 준다(조용히 '완료'로 바꾸지 않는다). */
const STATUS_LABEL: Record<string, string> = {
  pending: '확인 중',
  requested: '신청됨',
  approved: '지급 예정',
  processing: '지급 중',
  completed: '지급 완료',
  paid: '지급 완료',
  rejected: '반려',
  cancelled: '취소됨',
}

const PAGE = 20

export default function SettlementsSheet({ sellerId, onClose }: {
  sellerId: number
  onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // 🪑 §15-3 규칙 ①: 좌석이 맞을 때만 부른다 — 안 맞으면 남의 가게 정산이 뜬다.
  const load = useCallback((offset: number) => {
    if (currentSeatId() !== sellerId) { setFailed(true); setLoading(false); return }
    setLoading(true)
    api.get(`/api/seller/settlements?limit=${PAGE}&offset=${offset}`)
      .then((r) => {
        const d = r.data
        if (!d?.success) { setFailed(true); return }
        const list: Row[] = Array.isArray(d.data) ? d.data : []
        setRows((prev) => (offset === 0 ? list : [...prev, ...list]))
        setTotal(Number(d.total) || 0)
        setFailed(false)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [sellerId])

  useEffect(() => { load(0) }, [load])

  return (
    <Sheet title="지난 정산" onClose={onClose}>
      {loading && rows.length === 0 && (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}

      {/* 실패를 빈 목록으로 그리면 "정산 내역 없음" 이라는 거짓말이 된다(머니 표면 룰). */}
      {failed && (
        <p className="px-4 py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          정산 내역을 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      )}

      {!loading && !failed && rows.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-[14px] font-bold text-gray-900 dark:text-white">아직 정산 내역이 없어요</p>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            출금을 신청하면 여기에 쌓입니다.<br />신청 → 확인 → 지급 순서로 상태가 바뀌어요.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          {rows.map((r) => {
            const status = String(r.status ?? '')
            return (
              <div key={r.id} className="rounded-xl bg-wash px-3.5 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[17px] font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {formatNumber(r.settlement_amount)}
                    <span className="text-[12.5px] font-bold text-gray-500 dark:text-gray-400 ml-0.5">원</span>
                  </span>
                  <span className="flex-1" />
                  <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
                    {STATUS_LABEL[status] ?? status ?? '—'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                  신청 {r.requested_at ? formatKSTDate(r.requested_at) : '—'}
                  {r.period_start && r.period_end && (
                    <> · 기간 {formatKSTDate(r.period_start)}~{formatKSTDate(r.period_end)}</>
                  )}
                </p>
                {/* 매출·수수료는 **서버가 계산한 값** 그대로. 화면에서 다시 빼지 않는다. */}
                {(r.total_sales ?? 0) > 0 && (
                  <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                    매출 {formatNumber(r.total_sales)}원 · 수수료 {formatNumber(r.commission_amount)}원
                  </p>
                )}
              </div>
            )
          })}

          {rows.length < total && (
            <button
              type="button"
              disabled={loading}
              onClick={() => load(rows.length)}
              className="w-full h-11 rounded-xl bg-wash text-[13.5px] font-bold text-gray-900 dark:text-white active:opacity-70 disabled:opacity-50"
            >
              {loading ? '불러오는 중…' : `더 보기 (${formatNumber(total - rows.length)}건)`}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
