/**
 * 🛡️ 2026-05-21: 사용자/셀러/에이전시 공통 — 추천 commission 조회.
 *   - GET /api/referral-tree/my-commissions: 내 commission 리스트 + 요약
 *   - GET /api/referral-tree/withdrawals: 옛 출금 신청 이력(읽기 전용)
 *
 * 💸 2026-10-12 출금 신청을 걷었다(대표 *"응 모두 해주고"*). 확정된 커미션은 서버가 **이미 딜로 적립**
 *   하는데(`matureReferralCommissions`), 이 화면의 출금 신청이 같은 금액을 현금으로 또 내보내면서
 *   딜을 빼지 않았다 — 같은 돈이 두 번 나가는 문이었다. 서버 `POST /withdrawals` 는 410 이다.
 */
import { OkIcon, ClockIcon, BadIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import SEO from '@/components/SEO'
import { formatNumber, formatWon } from '@/utils/format'
import { useMyCommissions } from '@/hooks/queries/useMyCommissions'
import CollabPerformance from './my-commissions/CollabPerformance'
import { formatKST, formatKSTDate } from '@/utils/date'

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: typeof OkIcon }> = {
  pending: { label: '심사 대기', cls: 'bg-tone-warn-bg text-tone-warn', icon: ClockIcon },
  approved: { label: '송금 완료', cls: 'bg-tone-ok-bg text-tone-ok', icon: OkIcon },
  rejected: { label: '거절', cls: 'bg-tone-bad-bg text-tone-bad', icon: BadIcon },
}
// 🛡️ 2026-07-02: 정의 밖 status 방어 — meta undefined 렌더 크래시 방지.
const STATUS_FALLBACK = { label: '처리 중', cls: 'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300', icon: ClockIcon } as const

export default function MyCommissionsPage() {
  const navigate = useNavigate()
  // 🛡️ 2026-06-01 Tier2: 수동 Promise.all → useMyCommissions 단일 쿼리.
  // 🛡️ 2026-07-02: isError 분기 — 훅이 양 엔드포인트 전멸 시 throw 하게 바뀜("적립 0원" 위장 방지).
  const { data, isLoading: loading, isError, refetch } = useMyCommissions()
  const summary = data?.summary ?? { total_pending: 0, total_granted: 0, total_withdrawn: 0 }
  const commissions = data?.commissions ?? []
  const withdrawals = data?.withdrawals ?? []
  return (
    <div className="min-h-screen bg-white dark:bg-[#11141C]">
      <SEO title="추천 수익 - 유어딜" description="추천 수익 내역" url="/my-commissions" />

      <header className="sticky top-0 md:top-14 z-40 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center" aria-label="뒤로가기">
            <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">추천 수익</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 pb-20 pt-4">
        {/* 🛡️ 2026-07-02: 로드 전멸 시 잔액 0원 카드 대신 에러 + 재시도 (돈 표면 오표시 방지). */}
        {isError ? (
          <div className="text-center py-20">
            <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">수익 정보를 불러오지 못했어요</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">네트워크 상태를 확인한 뒤 다시 시도해주세요</p>
            <button onClick={() => refetch()} className="px-5 py-2 bg-brand text-white rounded-full text-[15px] font-bold">
              다시 시도
            </button>
          </div>
        ) : (
        <>
        {/* 🤝 2026-08-23: 협업 딜 성과 — 수락한 인플루언서만 렌더(없으면 null) */}
        <CollabPerformance />
        {/* 잔액 카드 — 확정된 수익은 이미 **딜**로 들어가 있다(현금 출금 아님, 2026-10-12). */}
        <div className="rounded-3xl p-6 bg-gray-900 dark:bg-[#1D1F29] text-white mb-4">
          <p className="text-[12px] opacity-80">딜로 적립된 추천 수익</p>
          <p className="text-[34px] font-extrabold leading-tight mt-1">{formatNumber(summary.total_granted)}<span className="ml-1 text-[17px] font-bold opacity-80">딜</span></p>
          <p className="mt-3 text-[12px] opacity-80">
            확정 대기 {formatNumber(summary.total_pending)}딜 — 확정되면 딜로 들어와요
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full py-3 bg-white dark:bg-white text-gray-900 dark:text-gray-900 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2"
          >
            딜로 이용권 보러 가기
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 출금 이력 */}
        {withdrawals.length > 0 && (
          <section className="mb-6">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2">출금 이력</h3>
            <div className="space-y-2">
              {withdrawals.map(w => {
                const meta = STATUS_BADGE[w.status] ?? STATUS_FALLBACK
                const Icon = meta.icon
                return (
                  <div key={w.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold text-gray-900 dark:text-white">{formatWon(w.total_amount)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium ${meta.cls}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                      {formatKST(w.requested_at)} · {w.bank_name} {w.account_number}
                    </p>
                    {w.rejection_reason && (
                      <p className="text-[12px] text-red-500 mt-1">거절 사유: {w.rejection_reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* commission 리스트 */}
        <section>
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2">최근 적립 내역</h3>
          {loading ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 py-8 text-center">불러오는 중...</p>
          ) : commissions.length === 0 ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 py-8 text-center">아직 적립된 수익이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#2C2F35] border border-gray-100 dark:border-[#2C2F35] rounded-xl overflow-hidden">
              {commissions.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 text-[12px]">
                  <div>
                    <p className="text-gray-900 dark:text-white">주문 #{c.order_id} · {c.tier}단계</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">{formatKSTDate(c.created_at)} · {c.status}</p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{formatWon(c.commission_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}
      </main>
    </div>
  )
}
