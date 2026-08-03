/**
 * 🎯 **오늘 쓸 수 있는 명단** — 파트너 풀의 두 사업 (2026-08-03 대표 확정).
 *
 * ## 왜 이게 맨 위인가
 * 총계는 **17만**이고 그중 지금 제안을 보낼 수 있는 건 얼마 안 된다. 총계는 판단에 도움이 안 되고
 * *"지금은 복잡함"* 이라는 인상만 만든다. 이 DB 의 성공 지표는 **"제안 보낼 수 있는 리드 수"** 다.
 *
 * ## 두 사업 (대표 확정)
 * ```
 *   💸 페이백    ← category='온라인판매' + 이메일    실측 18,155 중 18,088(99.6%)  ← 준비 완료
 *   🤝 제휴 대행  ← category='대행사'   + 연락처      실측  1,989 중    111(5.6%)  ← 새 수집 루트 필요
 * ```
 * 클릭하면 목록이 그 명단으로 좁혀지고, **그 상태로 CSV 를 내보내면 그대로 발송 명단**이 된다
 * (내보내기가 화면 필터를 따르도록 같은 날 수리했다 — 그 전엔 무필터 5,000행이 나갔다).
 *
 * ## ⚠️ 이 카드가 하지 않는 것
 * - 발송하지 않는다. 명단을 **좁혀 주기만** 한다(발송은 대표가 한다).
 * - 숫자가 0 이어도 고장이 아니다 — 그 사업의 리드가 아직 없다는 사실 그대로다.
 */
import { formatNumber } from '@/utils/format'

export default function BusinessSegments({ segments, onPick }: {
  segments: { payback_ready: number; agency_ready: number } | null
  onPick: (category: string, quick: 'email' | 'contact') => void
}) {
  const card = (
    tone: 'indigo' | 'emerald', emoji: string, title: string, n: number, hint: string,
    cat: string, quick: 'email' | 'contact',
  ) => (
    <button onClick={() => onPick(cat, quick)}
      className={`text-left rounded-xl border-2 p-4 ${tone === 'indigo'
        ? 'border-indigo-200 bg-indigo-50 hover:border-indigo-400'
        : 'border-emerald-200 bg-emerald-50 hover:border-emerald-400'}`}>
      <div className={`text-xs font-semibold ${tone === 'indigo' ? 'text-indigo-700' : 'text-emerald-700'}`}>{emoji} {title}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${tone === 'indigo' ? 'text-indigo-700' : 'text-emerald-700'}`}>{formatNumber(n)}</div>
      <div className={`mt-1 text-[11px] ${tone === 'indigo' ? 'text-indigo-600/80' : 'text-emerald-600/80'}`}>{hint}</div>
    </button>
  )
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      {card('indigo', '💸', '페이백 — 지금 보낼 수 있는 명단', segments?.payback_ready || 0,
        '온라인판매 · 이메일 보유 — 클릭하면 이 명단만 봅니다', '온라인판매', 'email')}
      {card('emerald', '🤝', '제휴 대행 — 연락 가능한 대행사', segments?.agency_ready || 0,
        '대행사 · 전화 또는 이메일 — 지금은 얇습니다(새 수집 루트 필요)', '대행사', 'contact')}
    </div>
  )
}
