/**
 * 🏪 장점 셋
 *
 * ■ 2026-09-16 3차 (대표 *"AI 가 만든 디자인, 말투가 아니면"*) — 이 섹션이 제일 티가 났다.
 *   파란 `01 · 02 · 03`, 항목마다 그은 가로줄, 길이가 똑같은 설명 세 덩어리.
 *   anti-slop 스킬이 **이름을 붙여 금지한 것들**이다("section-number eyebrow" · "3-column equal"
 *   · "border on every row" · "micro-meta-sentence under the heading").
 *
 *   ⇒ ① 번호를 지운다. 순서가 의미를 갖지 않는 셋이라 번호는 장식이었다.
 *      ② 가로줄 대신 여백으로 나눈다.
 *      ③ 길이를 일부러 다르게 쓴다 — 첫 줄은 한 문장, 가운데가 길고, 끝은 다시 짧게.
 *      ④ 제목 밑에 있던 *"셋 다 지금 라이브에서 동작하는 것입니다…"* 는 삭제.
 *         제목 아래 해명 한 줄은 그 자체가 AI 냄새이고, 같은 말을 FAQ 정직 고지가 이미 한다.
 *
 * ⚠️ 셋 다 코드로 확인한 것만 적는다. 성과 수치·수익 사례는 기획 §0-4 금지.
 */
const ITEMS = [
  {
    // ⚠️ 제목("먼저 나가는 돈, 없습니다")과 **같은 말을 두 번 하지 않는다.**
    //    첫 판은 이 항목도 '먼저 나가는 돈이 없습니다' 라 제목을 그대로 되풀이했다(1440 렌더에서 잡혔다).
    //    제목이 선언하고 여기서는 **금액을 센다** — 같은 뜻이라도 문장 모양이 달라야 사람이 쓴 것처럼 읽힌다.
    k: '가입비 0원, 월 이용료 0원, 광고비 0원',
    d: '이용권이 팔리고 손님이 와서 쓴 뒤에야 수수료가 생깁니다. 안 팔리면 0원입니다.',
  },
  {
    k: '온라인에 걸어 둔 게 진짜 방문으로 이어졌는지 보입니다',
    d: '손님이 QR을 찍는 순간이 곧 방문 기록입니다. 몇 장이 팔렸고 그중 몇 명이 실제로 가게에 왔는지가 매장 화면에 남습니다. 클릭 수를 보고 짐작할 일이 없습니다.',
  },
  {
    k: '매출이 먼저 들어옵니다',
    d: '손님은 오기 전에 값을 치릅니다. 예약만 잡고 안 오는 일이 없습니다.',
  },
]

export default function PartnerBenefits() {
  return (
    <section className="bg-warm">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">
        <h2 className="text-[26px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
          먼저 나가는 돈, 없습니다
        </h2>

        <div className="mt-12 lg:mt-20 space-y-12 lg:space-y-20 max-w-[52rem]">
          {ITEMS.map(({ k, d }) => (
            <div key={k}>
              <p className="text-[21px] lg:text-[32px] xl:text-[36px] font-extrabold text-ink leading-[1.3] tracking-[-0.025em]">{k}</p>
              <p className="mt-3.5 lg:mt-5 text-[14px] lg:text-[17px] leading-[1.8] text-gray-500 dark:text-gray-400 max-w-[34em]">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
