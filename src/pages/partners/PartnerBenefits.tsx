/**
 * 🏪 장점 셋 — 대표 확정 골격 (2026-09-16 *"장점 3가지"*)
 *
 * ■ 레이아웃 계열을 일부러 갈랐다
 *   1차 판은 **3열 균등**이었는데, 아래 '손님은 이렇게 옵니다'(4열)와 '세 가지 길'(3열)이 이어져
 *   PC 에서 같은 그림이 세 번 반복됐다(anti-slop §레이아웃 반복 금지, 그리고 대표의
 *   *"PC 버전 같지 않다"* 가 실제로 이 단조로움이다). ⇒ 여기는 **왼쪽 제목 고정 + 오른쪽 큰 항목 스택**.
 *   PC 에서 제목이 스크롤을 따라 붙어 있어 세 항목이 하나의 주장으로 읽힌다.
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
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32 grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 xl:gap-28">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-[25px] lg:text-[42px] xl:text-[48px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
            유어딜이 사장님께<br className="hidden lg:block" /> 드리는 것은 셋입니다
          </h2>
          <p className="mt-4 lg:mt-6 text-[14px] lg:text-[17px] leading-[1.75] text-gray-500 dark:text-gray-400 max-w-[24em]">
            셋 다 지금 라이브에서 동작하는 것입니다. 앞으로 하겠다는 약속이 아닙니다.
          </p>
        </div>

        <ol className="divide-y divide-rule">
          {ITEMS.map(({ k, d }, i) => (
            <li key={k} className="py-7 first:pt-0 lg:py-11 lg:first:pt-0 grid gap-2.5 lg:grid-cols-[auto_1fr] lg:gap-8">
              <span className="text-[13px] lg:text-[15px] font-extrabold text-brand-text tabular-nums lg:pt-2">0{i + 1}</span>
              <div>
                <p className="text-[20px] lg:text-[30px] xl:text-[34px] font-extrabold text-ink leading-[1.3] tracking-[-0.02em]">{k}</p>
                <p className="mt-3 lg:mt-4 text-[13.5px] lg:text-[16.5px] leading-[1.8] text-gray-500 dark:text-gray-400 max-w-[36em]">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
