/**
 * 🏪 사장님이 실제로 보는 화면 — 대표 확정 "안 B"(2026-09-16 *"안 B로 하는데"*) + "추가 장점"
 *
 * ■ 왜 화면을 보여 주나
 *   1차 판은 아이콘 + 문장 네 줄이었다. 사장님 입장에서 "그래서 내가 뭘 보게 되는데?" 에
 *   답이 없다. 여기는 **라이브 셀러 대시보드 캡처 네 장**을 그대로 건다(덱과 같은 소재).
 *
 * ■ 여기 적은 넷은 **라이브에서 동작하는 것만** 이다. 확인한 근거:
 *   ① QR 사용 처리 — `group-buy-voucher.routes.ts` `/:code/use`. 단말기·포스 연동 없음.
 *   ② 정산 — `payouts-generate.ts`(주 단위 집계, 최소 지급액 이월). ⚠️ **승인·송금은 사람이 누른다**
 *      (기획 §0-2 가 "자동 송금" 표기를 금지한다). 그래서 "자동 계산" 까지만 적는다.
 *      캡처 안의 숫자는 **예시 데이터**라 캡션에 그대로 밝힌다(덱도 같은 캡션을 쓴다).
 *   ③ 소개 파트너 — `marketing.routes.ts:137` 가 `influencer_attributions` 를 `seller_id` 로 좁혀
 *      `influencer_id` 단위로 묶는다. ⚠️ 그 테이블이 담는 건 **결제 건**이다(migration 0247) —
 *      클릭·유입 수가 아니다. "몇 명이 눌렀는지" 로 쓰면 거짓이 된다.
 *   ④ 운영자 위임 — `seller_operators`. 캡처가 화면에서 직접 말한다: *"사업자 정보와 정산 계좌는
 *      사장님께 그대로 남고, 권한은 언제든 회수할 수 있습니다."*
 *
 * ■ 2026-09-16 3차 (대표 *"AI 가 만든 디자인, 말투가 아니면"*)
 *   ① 제목 오른쪽 구석에 떠 있던 작은 설명 문단을 지웠다. 스킬이 "floating top-right sub-text
 *      in section headings" 로 이름 붙여 금지한 그림이고, 그 문단이 하던 말("전부 지금 라이브에서
 *      동작합니다")은 페이지가 이미 여러 번 한다.
 *   ② 아래 설명 넉 줄을 **4열 → 2열**로. 캡처가 이미 4열이라 그 밑에 또 4열이 오면 격자 두 겹이다.
 *   ③ 제목을 짧게: "사장님 화면은 이렇습니다" → "사장님 폰에 뜨는 화면".
 *
 * ■ 여기 **없는** 것: 공구 엔진(기간한정 공구 · 링크 전용가 · 인플루언서 딜 제안).
 *   `GB_ENGINE_ENABLED = false` 로 꺼져 있어 사장님이 오늘 쓸 수 없다(대표 2026-09-16 "공구 내용은 빼줘").
 * ■ "자동 승인" 도 없다 — `seller-registration.routes.ts:239` 주석이 *"자동승인 말고 수동 승인"* 이다.
 *   자동인 것은 국세청 **진위확인**뿐이다.
 */
import PartnerPhone, { SHOT } from './PartnerPhone'

const SCREENS = [
  { shot: 'seller-scan', cap: '손님 QR 한 번 찍으면 사용 처리' },
  { shot: 'seller-settlements', cap: '정산 화면 (예시 데이터)' },
  { shot: 'seller-influencers', cap: '내 이용권을 팔아 줄 사람 찾기' },
  { shot: 'seller-operators', cap: '운영을 맡기고 권한은 회수' },
]

const NOTES = [
  {
    t: '단말기도 포스 연동도 없습니다',
    d: '손님이 내미는 QR을 매장 폰으로 찍으면 끝입니다. 폰이 안 잡히면 확인코드 여섯 자리를 넣으셔도 됩니다.',
  },
  {
    t: '엑셀로 맞춰 볼 일이 없습니다',
    d: '얼마 팔렸고 누구에게 얼마가 가는지를 주 단위로 자동으로 계산합니다. 보내기 전에는 담당자가 내역을 눈으로 확인합니다.',
  },
  {
    t: '누가 손님을 데려왔는지 보입니다',
    d: '소개해 준 사람별로 몇 건이 팔렸고 소개비가 얼마 나갔는지가 쌓입니다. 그 손님이 실제로 와서 QR을 찍었는지까지 남으니, 성과가 나오는 사람에게만 다시 맡기시면 됩니다.',
  },
  {
    t: '운영은 맡기고 돈은 사장님께',
    d: '상품 등록과 주문 관리를 남에게 맡기실 수 있습니다. 정산 계좌는 사장님 것으로 남고, 권한은 언제든 회수합니다.',
  },
]

export default function PartnerTools() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
        <h2 className="text-[26px] lg:text-[40px] xl:text-[46px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
          사장님 폰에 뜨는 화면
        </h2>

        {/* 화면 넉 장 — 가로로 나란히. PC 에서 폰 한 대가 340px 쯤 되어 실제로 읽힌다 */}
        <div className="mt-10 lg:mt-16 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-8">
          {SCREENS.map(({ shot, cap }) => (
            <figure key={shot}>
              <PartnerPhone src={SHOT(shot)} alt={cap} />
              <figcaption className="mt-3 lg:mt-4 text-[12px] lg:text-[14px] font-semibold text-gray-500 dark:text-gray-400">{cap}</figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-12 lg:mt-20 grid gap-9 sm:grid-cols-2 lg:gap-x-20 lg:gap-y-14 max-w-[64rem]">
          {NOTES.map(({ t, d }) => (
            <div key={t}>
              <p className="text-[17px] lg:text-[22px] font-extrabold text-ink leading-snug tracking-[-0.02em]">{t}</p>
              <p className="mt-3 text-[13.5px] lg:text-[15.5px] leading-[1.8] text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
