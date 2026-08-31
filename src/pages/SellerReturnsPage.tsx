/**
 * ↩️ **운영자 환불 큐** — 세션 ⑤ (체크리스트 §5.4 🟡)
 *
 * `GET /api/returns/seller` 는 **있는데 소비 화면이 0건**이었다(returns.routes.ts:312).
 * 운영자가 **자기 상품의 환불 요청을 볼 데가 없었다** — 소비자가 신청해도 운영자는 모르고,
 * 어드민(`AdminReturnsPage`)만 본다. 파일럿에서 그 어드민은 **대표 한 명**이라
 * 환불이 늘면 그대로 대표 부담이 된다.
 *
 * ## 🔴 이 화면이 하는 일과 안 하는 일
 * - **한다**: 목록 조회 · 승인 · 거절 (이미 있는 `PUT /:id/approve` · `/:id/reject`)
 * - **안 한다**: **환불 실행**. 그건 `AdminReturnsPage` 의 `/:id/refund` 이고 **머니 경로**다.
 *   여기서 금액을 만지면 §C7(보관구분 부분환불) 정책이 정해지기 전에 돈이 움직인다.
 *
 * > 승인/거절은 **상태 전이**이고, 환불은 **돈**이다. 한 화면에 섞지 않는다.
 *
 * ---
 * ## 🎨 2026-08-02 시안 적용 〔`docs/design/operator-mall-pilot.md` 화면 D〕
 *
 * 의뢰서 §4 화면 D 는 *"재설계가 아니라 정돈"* 이다. 배선·API·상태 전이는 그대로고 표면만 바꿨다.
 * - 상태 배지를 재사용 요소 팔레트로: 대기 로즈 / 승인함 초록 / 거절함 회색
 * - **승인·거절 버튼을 면으로**〔시안 §3.2〕 — 거절이 흰 배경 + 회색 테두리였는데, 그 테두리 색이
 *   카드 테두리와 같아서 "눌리는 것"이 아니라 "또 하나의 박스"로 읽혔다
 * - 빈 상태와 오류 상태를 **각자 다른 화면**으로(의뢰서 §4: 지금 그렇게 나눠져 있다 — 유지)
 * - 승인 뒤엔 버튼 대신 *"환불은 관리자가 처리 중이에요"* — 운영자가 다음에 뭘 기다리는지 말해준다
 *
 * ⚠️ `text-gray-*` 대신 hex — `tailwind.config.js` 가 `gray-*` 를 INK(딥네이비)로 리맵한다.
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, PackageOpen, AlertCircle, Clock } from 'lucide-react'
import SellerLayout from '@/components/SellerLayout'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { formatWon } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'

interface ReturnRow {
  id: number
  order_id: number
  status: string
  reason?: string | null
  requested_at?: string | null
  order_total?: number | null
  shipping_name?: string | null
}

/** 재사용 요소 팔레트〔시안〕. 모르는 상태는 회색으로 떨군다(추측한 색을 칠하지 않는다). */
const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  requested: { label: '대기', cls: 'text-[#B0576A] bg-[#FBEDF0]' },
  approved: { label: '승인함', cls: 'text-[#2E7D5B] bg-[#E6F3EC]' },
  rejected: { label: '거절함', cls: 'text-[#8A8288] bg-[#F1EDEF]' },
  refunded: { label: '환불완료', cls: 'text-[#2E7D5B] bg-[#E6F3EC]' },
  completed: { label: '완료', cls: 'text-[#6B6469] bg-[#F1EDEF]' },
}

/** 빈 상태·오류 상태 공용 껍데기 — 둘이 **다른 화면**이라는 것이 이 화면의 규칙이다. */
function StateCard({ tone, icon, title, body, action }: {
  tone: 'neutral' | 'error'
  icon: React.ReactNode
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mt-4 bg-white border border-[#E2DDDF] rounded-[20px] px-8 py-12 flex flex-col items-center text-center">
      <div className={`w-[58px] h-[58px] rounded-[18px] flex items-center justify-center mb-4 ${
        tone === 'error' ? 'bg-[#FDEEEE]' : 'bg-[#F5F2F3]'
      }`}>
        {icon}
      </div>
      <p className="text-[14.5px] font-bold text-[#3F383C] tracking-[-0.03em]">{title}</p>
      {body && <p className="mt-[7px] text-[12.5px] leading-[1.6] text-[#8A8288] tracking-[-0.02em]">{body}</p>}
      {action}
    </div>
  )
}

export default function SellerReturnsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(false)
    api.get('/api/returns/seller')
      .then((r) => setRows(Array.isArray(r.data?.data) ? r.data.data : []))
      // 🔴 실패를 빈 목록으로 위장하지 않는다 — "반품 0건" 과 "조회 실패" 는 전혀 다른 상태다
      //    (이 레포의 `check-query-iserror` 가 지키는 클래스).
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function act(id: number, kind: 'approve' | 'reject') {
    setBusy(id)
    try {
      await api.put(`/api/returns/${id}/${kind}`)
      load()
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <SellerLayout title="환불 요청">
      <SEO title="환불 요청 - 유어딜" description="내 상품의 환불 요청" noindex />
      <div className="p-4 max-w-4xl mx-auto">
        {/* 🔴 이 화면의 권한 경계를 첫 줄에 말한다 — 승인은 하되 돈은 못 만진다. */}
        <div className="flex gap-2 rounded-[10px] bg-[#F5F2F3] px-3 py-[11px]">
          <AlertCircle className="w-[15px] h-[15px] text-[#8A8288] flex-none mt-px" strokeWidth={2} />
          <p className="text-[12px] leading-[1.6] text-[#6B6469] tracking-[-0.02em]">
            내 상품에 들어온 환불 요청이에요. 환불 실행은 관리자가 처리해요.
          </p>
        </div>

        {loading && (
          <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#A9A2A6]" /></div>
        )}

        {/* 🔴 조회 실패를 "0건" 으로 보여주지 않는다 — 운영자가 요청이 없다고 오해한다. */}
        {!loading && error && (
          <StateCard
            tone="error"
            icon={<AlertCircle className="w-6 h-6 text-[#D0685E]" strokeWidth={2} />}
            title="목록을 불러오지 못했어요"
            body="잠시 후 다시 시도해 주세요."
            action={
              <button onClick={load}
                className="mt-[18px] h-12 px-[26px] rounded-xl bg-[#F1EDEF] text-[#3F383C] text-[14.5px] font-bold tracking-[-0.02em] active:bg-[#E8E3E5]">
                다시 시도
              </button>
            }
          />
        )}

        {!loading && !error && rows.length === 0 && (
          <StateCard
            tone="neutral"
            icon={<PackageOpen className="w-6 h-6 text-[#B7B0B4]" strokeWidth={1.9} />}
            title="환불 요청이 없어요"
          />
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((r) => {
              const st = STATUS_STYLE[r.status] ?? { label: r.status, cls: 'text-[#8A8288] bg-[#F1EDEF]' }
              return (
                <li key={r.id} className="bg-white border border-[#EAE5E7] rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11.5px] font-bold text-[#8A8288] tracking-[0.01em]">#{r.order_id}</span>
                    <span className={`shrink-0 text-[10.5px] font-extrabold px-[7px] py-1 rounded-md tracking-[-0.02em] ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 mt-2.5">
                    <span className="text-base font-extrabold text-[#1A1719] tracking-[-0.03em] truncate">
                      {r.shipping_name || '-'}
                    </span>
                    <span className="text-base font-extrabold text-[#1A1719] tracking-[-0.03em] shrink-0">
                      {formatWon(r.order_total)}
                    </span>
                  </div>

                  {r.requested_at && (
                    <p className="mt-1 text-[12px] text-[#9A9298] tracking-[-0.02em]">
                      {formatKSTDate(r.requested_at)} 접수
                    </p>
                  )}

                  {/* 사유는 **손님이 직접 쓴 글**이다 — 서비스 말투를 입히지 않는다〔시안 §3.3〕. */}
                  {r.reason && (
                    <div className="mt-3 rounded-[10px] bg-[#F7F5F6] px-3 py-[11px]">
                      <p className="text-[10.5px] font-extrabold text-[#9A9298] tracking-[0.03em] mb-1">사유</p>
                      <p className="text-[12.5px] leading-[1.6] text-[#4A4448] tracking-[-0.02em] break-words">{r.reason}</p>
                    </div>
                  )}

                  {/* 승인·거절만. 환불(=돈)은 여기 없다 — 위 주석 참조. */}
                  {r.status === 'requested' && (
                    <div className="mt-3.5 grid grid-cols-2 gap-2">
                      <button disabled={busy === r.id} onClick={() => act(r.id, 'reject')}
                        className="h-[50px] rounded-xl bg-[#F1EDEF] text-[#3F383C] text-[14.5px] font-bold tracking-[-0.02em] active:bg-[#E8E3E5] disabled:opacity-50">
                        거절
                      </button>
                      <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')}
                        className="ur-btn ur-btn-md ur-btn-primary h-[50px] bg-[#1A1719] text-[14.5px] tracking-[-0.02em] disabled:opacity-50">
                        승인
                      </button>
                    </div>
                  )}

                  {/* 🔴 승인 뒤에 **다음이 무엇인지** 말한다 — 안 그러면 운영자가 환불을 찾아 헤맨다. */}
                  {r.status === 'approved' && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8A8288] tracking-[-0.02em]">
                      <Clock className="w-[13px] h-[13px]" strokeWidth={2.2} />
                      환불은 관리자가 처리 중이에요
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SellerLayout>
  )
}
