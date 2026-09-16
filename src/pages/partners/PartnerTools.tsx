/**
 * 🏪 매장이 실제로 쓰는 도구 — 대표 확정 "추가 장점"(2026-09-16)
 *
 * ■ 여기 적은 넷은 **라이브에서 동작하는 것만** 이다. 확인한 근거:
 *   ① 인플루언서별 성과 — `marketing.routes.ts:137` 가 `influencer_attributions` 를
 *      `seller_id` 로 좁혀 `influencer_id` 단위로 묶어 준다(최근 30일 건수 + 소개비 합계).
 *      ⚠️ 그 테이블이 담는 건 **결제 건**이다(`order_id`/`voucher_id`/`commission_amount`,
 *      migration 0247). 클릭·유입 수는 담지 않는다 ⇒ "몇 명이 눌렀는지" 로 쓰면 거짓이 된다.
 *      실제로 말할 수 있는 건 **팔린 건수와 나간 소개비**, 그리고 QR 사용 여부다.
 *   ② 정산 자동 계산 — `payouts-generate.ts`. ⚠️ **승인·송금은 사람이 누른다**(기획 §0-2 가
 *      "자동 송금" 표기를 금지한다). 그래서 "자동 계산" 까지만 적는다.
 *   ③ 가입 — 🔴 **"자동 승인" 이라고 쓰면 안 된다.** `seller-registration.routes.ts:239` 주석이
 *      *"2026-06-12 사용자 결정 — 자동승인 말고 수동 승인 · 모든 사업자 가입은 어드민 수동 승인"* 이고,
 *      국세청 진위확인 결과는 승인 화면의 **참고 신호로만** 저장된다. 게다가 2026-09-16 에
 *      앞문에도 사업자등록증 사본이 필수가 됐다(사람이 확인). ⇒ 자동인 것은 **진위확인**뿐이다.
 *   ④ 단골 할인코드 — `SellerPromoCodesPage`(단골 전용 / 신규 전용 / 모두 + 카카오톡 공유).
 *
 * ■ 여기 **없는** 것: 공구 엔진(기간한정 공구 · 링크 전용가 · 인플루언서 딜 제안).
 *   `GB_ENGINE_ENABLED = false` 로 꺼져 있어 사장님이 오늘 쓸 수 없다(대표 2026-09-16 "공구 내용은 빼줘").
 */
import { BarChart3, Wallet, BadgeCheck, Ticket } from 'lucide-react'

const TOOLS = [
  {
    icon: BarChart3,
    t: '누가 손님을 데려왔는지 사람 단위로 보입니다',
    d: '소개해 준 사람별로 몇 건이 팔렸고 소개비가 얼마 나갔는지가 매장 화면에 쌓입니다. 그 손님이 실제로 가게에 와서 QR을 찍었는지까지 남으니, 성과가 나오는 사람에게만 다시 맡기시면 됩니다.',
  },
  {
    icon: Wallet,
    t: '판매와 소개비 분배가 자동으로 계산됩니다',
    d: '얼마 팔렸고 누구에게 얼마가 가는지를 매주 시스템이 계산합니다. 엑셀로 맞춰 볼 일이 없습니다. 보내기 전에는 유어딜 담당자가 내역을 눈으로 확인합니다.',
  },
  {
    icon: BadgeCheck,
    t: '사업자번호는 국세청에 자동으로 조회됩니다',
    d: '입력하신 번호와 대표자명, 개업일을 국세청에 바로 확인합니다. 등록증 사본은 사람이 한 번 보고 승인합니다. 가짜 매장이 섞이면 먼저 들어오신 사장님이 손해라서, 이 한 단계는 사람이 맡습니다.',
  },
  {
    icon: Ticket,
    t: '단골에게 보낼 할인코드를 직접 만드십니다',
    d: '단골 전용, 신규 전용, 또는 모두에게 쓸 코드를 만들어 카카오톡으로 보내실 수 있습니다. 새 손님을 부르는 채널이면서 이미 오신 분을 다시 부르는 도구이기도 합니다.',
  },
]

export default function PartnerTools() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
        <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28] max-w-[16em]">
          등록하고 나면 쓰시게 되는 것들
        </h2>

        <div className="mt-10 lg:mt-16 divide-y divide-rule">
          {TOOLS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="py-7 lg:py-9 grid gap-3 lg:grid-cols-[auto_0.9fr_1.1fr] lg:gap-10 lg:items-start">
              <span className="w-11 h-11 shrink-0 rounded-2xl bg-brand-tint flex items-center justify-center">
                <Icon className="w-[19px] h-[19px] text-brand-text" strokeWidth={1.8} />
              </span>
              <p className="text-[17px] lg:text-[21px] font-extrabold text-ink leading-snug tracking-[-0.01em]">{t}</p>
              <p className="text-[13.5px] lg:text-[15px] leading-[1.75] text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
