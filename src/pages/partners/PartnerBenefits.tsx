/**
 * 🏪 장점 셋 — 대표 확정 골격 (2026-09-16 *"장점 3가지"*)
 *
 * 카드 chrome 을 쓰지 않는 편집형 3열이다. 앞뒤 섹션(히어로 분할 · 비교표)과 **계열이 겹치지 않게**
 * 하려는 것이고(anti-slop §레이아웃 반복 금지), 이 셋은 장식 없이 문장만으로 서야 하는 내용이다.
 *
 * ⚠️ 셋 다 코드로 확인한 것만 적는다 — 성과 수치·수익 사례는 기획 §0-4 금지.
 */
const ITEMS = [
  {
    k: '선불 비용 0원',
    d: '가입비도 월 이용료도 광고비도 없습니다. 이용권이 팔리고 손님이 가게에 와서 쓴 뒤에야 수수료가 생깁니다. 안 팔리면 0원입니다.',
  },
  {
    k: '온라인 노출이 실제 방문까지 이어집니다',
    d: '손님이 QR을 찍는 순간이 곧 방문 기록입니다. 몇 장이 팔렸고 몇 명이 실제로 왔는지가 매장 화면에 남습니다. 클릭 수로 추측할 일이 없습니다.',
  },
  {
    k: '선결제라 매출이 먼저 확정됩니다',
    d: '손님은 가게에 오기 전에 값을 치릅니다. 예약만 잡고 안 오는 일이 구조적으로 없고, 정산은 실제로 사용된 이용권만 대상입니다.',
  },
]

export default function PartnerBenefits() {
  return (
    <section className="bg-warm">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
        <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28] max-w-[18em]">
          유어딜이 사장님께 드리는 것은 셋입니다
        </h2>
        <div className="mt-10 lg:mt-16 grid gap-9 lg:grid-cols-3 lg:gap-12">
          {ITEMS.map(({ k, d }, i) => (
            <div key={k} className="lg:pt-8 relative">
              <span aria-hidden className="hidden lg:block absolute left-0 right-6 top-0 h-px bg-rule-strong opacity-40" />
              <p className="text-[12px] font-extrabold text-brand-text tabular-nums">0{i + 1}</p>
              <p className="mt-2.5 text-[19px] lg:text-[24px] font-extrabold text-ink leading-[1.35] tracking-[-0.01em]">{k}</p>
              <p className="mt-3 text-[13.5px] lg:text-[15px] leading-[1.75] text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
