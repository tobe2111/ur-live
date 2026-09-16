/**
 * 🎨 시안 세트 — 셀러 매출 분석(`/seller/analytics`).
 *
 * 대표가 이 화면을 보내며 물었다: *"각 페이지마다 이렇게 지금 UI들이 공통적으로 잡혀있는데…"*
 * 실측해 보니 문제는 스킨이 아니라 **구조**였다 — 내용이 나오기 전에 질문을 셋 하고(탭 3 → 버튼 6 → 기간 3),
 * 그 답이 전부 0 으로 간다. 컨트롤 12개, 정보 0개. 다른 색을 입혀도 똑같이 비어 보인다.
 *
 * ⚠️ 여기 숫자는 전부 가짜다. 이 파일은 **모양을 고르기 위한 것**이고 API 를 부르지 않는다.
 */
import { BarChart2, Users, ChevronRight } from 'lucide-react'
import type { VariantSet, VariantCtx } from '../registry'

// ── 가짜 데이터 — 두 상태를 같은 모양으로 ────────────────────────────────────
const FULL = {
  revenue: 4_820_000, orders: 213, conversion: 3.4, repeat: 28,
  buyers: 186, repeatBuyers: 52,
  days: [31, 44, 28, 52, 61, 47, 38, 55, 72, 49, 63, 58, 41, 69],
}
const EMPTY = { revenue: 0, orders: 0, conversion: 0, repeat: 0, buyers: 0, repeatBuyers: 0, days: [] as number[] }
const pick = (c: VariantCtx) => (c.data === 'full' ? FULL : EMPTY)
const won = (n: number) => `₩${n.toLocaleString('ko-KR')}`

/** 라이브러리 없는 막대 그래프 — 시안 판단에 필요한 건 "차트가 여기 이 크기로 온다" 뿐이다. */
function Bars({ days }: { days: number[] }) {
  if (days.length === 0) return <div className="h-[120px] rounded-lg bg-gray-50" />
  const max = Math.max(...days)
  return (
    <div className="flex h-[120px] items-end gap-1">
      {days.map((v, i) => (
        <div key={i} className="flex-1 rounded-t bg-brand" style={{ height: `${(v / max) * 100}%`, opacity: 0.25 + (v / max) * 0.75 }} />
      ))}
    </div>
  )
}

// ── 안 A — 지금 (기준선) ─────────────────────────────────────────────────────
function VariantA(ctx: VariantCtx) {
  const d = pick(ctx)
  const stat = (label: string, value: string, hint?: string) => (
    <div className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4">
      <p className="text-[12px] font-semibold text-gray-500">{label}</p>
      <p className="dash-num mt-1 text-[22px] font-extrabold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[17px] font-bold text-gray-900">매출 분석</h1>
        <p className="text-[12px] text-gray-500">매출, 고객, 상품 퍼포먼스 분석</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('전환율', `${d.conversion}%`)}
        {stat('재구매율', `${d.repeat}%`, `${d.repeatBuyers}명 / ${d.buyers}명`)}
        {stat('전체 고객', `${d.buyers}명`)}
        {stat('재구매 고객', `${d.repeatBuyers}명`)}
      </div>
      <div className="flex flex-wrap gap-2">
        {['매출 차트', '고객 분석', '상품 성과', '추천 Commission', '월별 입점 추이', '트래킹 Funnel'].map((l, i) => (
          <button key={l} className={`rounded-xl px-4 py-2 text-[13px] font-semibold ${i === 0 ? 'bg-brand-tint text-brand-text' : 'border border-rule bg-white text-gray-700'}`}>{l}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {['7일', '30일', '90일'].map((l, i) => (
          <button key={l} className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${i === 1 ? 'bg-tone-info-bg text-tone-info' : 'bg-gray-100 text-gray-500'}`}>{l}</button>
        ))}
      </div>
      <div className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4"><Bars days={d.days} /></div>
    </div>
  )
}

// ── 안 B — 질문을 하나로, 숫자를 주인공으로 ──────────────────────────────────
function VariantB(ctx: VariantCtx) {
  const d = pick(ctx)
  return (
    <div className="space-y-4">
      {/* 질문은 하나만 — 기간. 나머지는 답이 나온 뒤에 묻는다. */}
      <div className="flex rounded-xl border border-rule bg-white p-1">
        {['7일', '30일', '90일'].map((l, i) => (
          <button key={l} className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-bold ${i === 1 ? 'bg-brand text-white' : 'text-gray-400'}`}>{l}</button>
        ))}
      </div>
      {/* 주인공은 숫자 하나. 보조 지표는 그 밑 한 줄로 내려간다(카드 넷이 아니라). */}
      <div>
        <p className="text-[12.5px] font-semibold text-gray-400">최근 30일 매출</p>
        <p className="dash-num text-[32px] font-extrabold leading-tight text-gray-900">{won(d.revenue)}</p>
        <p className="mt-1 text-[12.5px] text-gray-500">
          주문 {d.orders}건 · 고객 {d.buyers}명 · 재구매 {d.repeat}% · 전환 {d.conversion}%
        </p>
      </div>
      <div className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4"><Bars days={d.days} /></div>
      {/* 나머지 화면은 목록의 줄로 — 버튼 여섯 줄보다 스크롤 한 번이 싸다. */}
      <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
        {[
          { icon: Users, label: '고객 분석', hint: `${d.buyers}명` },
          { icon: BarChart2, label: '상품 성과', hint: `${d.orders}건` },
        ].map((r) => (
          <button key={r.label} className="flex w-full items-center gap-3 border-b border-rule px-4 py-3 text-left last:border-b-0">
            <r.icon className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-[13px] font-bold text-gray-900">{r.label}</span>
            <span className="text-[12px] text-gray-400">{r.hint}</span>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>
        ))}
        <button className="w-full px-4 py-2.5 text-[12px] font-bold text-gray-500">더 보기 (추천 수익 · 입점 추이 · 유입 경로)</button>
      </div>
    </div>
  )
}

// ── 안 C — 비어 있을 때를 먼저 설계한 안 ─────────────────────────────────────
function VariantC(ctx: VariantCtx) {
  const d = pick(ctx)
  if (ctx.data === 'empty') {
    // 🔑 이 안의 주장: 잴 것이 없으면 **재는 도구를 그리지 않는다.** 0 다섯 개와 컨트롤 12개 대신
    //    지금 할 수 있는 일 하나. (대표가 실제로 본 화면이 정확히 "0 이 다섯 개" 였다.)
    return (
      <div className="space-y-4">
        <h1 className="text-[17px] font-bold text-gray-900">매출 분석</h1>
        <div className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-6 text-center">
          <p className="text-[15px] font-bold text-gray-900">아직 판매가 없어요</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
            첫 이용권이 팔리면 여기에 매출·고객·재구매가 쌓입니다.<br />지금은 볼 숫자가 없어서 비워 뒀어요.
          </p>
          <button className="ur-btn ur-btn-md ur-btn-primary mt-4">이용권 등록하기</button>
        </div>
      </div>
    )
  }
  return VariantB(ctx)
}

const SET: VariantSet = {
  id: 'seller-analytics',
  label: '셀러 매출 분석',
  route: '/seller/analytics',
  problem: '내용이 나오기 전에 질문이 셋(탭 3 → 버튼 6 → 기간 3)이고, 그 답이 전부 0 으로 간다. 컨트롤 12개, 정보 0개.',
  themeClass: 'seller-light-theme',
  variants: [
    { id: 'a', label: '안 A · 지금', note: '기준선. 바꾸기 전 화면을 그대로 둔 것 — 비교 대상이 없으면 좋아졌는지 알 수 없다.', render: VariantA },
    { id: 'b', label: '안 B · 숫자가 주인공', note: '질문을 기간 하나로 줄이고, 카드 넷을 큰 숫자 하나 + 한 줄 요약으로. 나머지 화면은 버튼이 아니라 목록의 줄.', render: VariantB },
    { id: 'c', label: '안 C · 빈 화면을 먼저', note: '잴 것이 없으면 재는 도구를 안 그린다. 데이터가 생기면 안 B 로 자란다. (데이터 스위치를 "비어 있음" 으로 두고 볼 것)', render: VariantC },
  ],
}
export default SET
