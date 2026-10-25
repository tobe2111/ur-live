/**
 * 🧱 이용권 카드 자리 — **진짜 카드(`GroupBuyFeedCard`)와 같은 줄 구조**로 세운다 (2026-10-14).
 *
 * 🩸 왜 생겼나(실측 — 하네스 `--cls`): 홈 편성 섹션이 오기 전 자리표시가 [사진 + 13px 막대 둘]
 *   이었다. 진짜 카드는 [사진 + 가게 · 이름(두 줄) · 주소 · 평점 · 정가·할인 · 판매가] 라서 카드 한
 *   장이 ~90px 더 높고, 두 줄이면 ~180px 이 응답 순간 아래 피드를 밀었다(유어쇼츠 레일 누락까지
 *   합쳐 415px · CLS 0.16 — 실사용 홈 CLS p75 0.199 의 후보).
 *
 * ⇒ 숫자로 높이를 흉내 내지 않고 **같은 글자 크기·줄 높이·여백 클래스**로 줄을 세운다. 글자는
 *   `text-transparent` 로 감추고 회색 막대만 보인다. 진짜 카드의 클래스가 바뀌면 이 파일도 같이
 *   바꿔야 한다 — 시험(`home-sections-placeholder-2026-10-14`)이 두 파일의 클래스를 대조한다.
 *
 * ⚠️ 진짜 카드를 `invisible` 로 그려 높이를 빌리지 않는 이유: 그 카드는 화면에 들어오면 상세를
 *   미리 받는다(prefetch) — 가짜 id 로 없는 상품을 부르게 된다.
 */
const BAR = 'rounded bg-gray-100 dark:bg-white/[0.06] text-transparent select-none'

export default function DealCardPlaceholder() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="aspect-[4/3] rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
      <div className="pt-2">
        {/* 가게 */}
        <p className="flex text-[12px] leading-none mb-1"><span className={`${BAR} w-1/2`}>가</span></p>
        {/* 이름 — 두 줄(그리드는 두 장 중 긴 쪽에 맞춰지므로 두 줄이 흔한 높이다) */}
        <p className="text-[13px] font-medium leading-tight">
          <span className={`${BAR} block w-full`}>가</span>
          <span className={`${BAR} block w-2/3`}>가</span>
        </p>
        {/* 주소 */}
        <p className="flex mt-1 text-[12px]"><span className={`${BAR} w-3/4`}>가</span></p>
        {/* 평점 */}
        <p className="flex mt-1 text-[12px]"><span className={`${BAR} w-1/3`}>가</span></p>
        {/* 정가·할인 */}
        <div className="mt-1">
          <p className="flex leading-none"><span className={`${BAR} text-[12px] w-1/3`}>가</span></p>
        </div>
        {/* 판매가 */}
        <p className="flex mt-1 leading-none"><span className={`${BAR} text-[17px] font-bold w-1/2`}>가</span></p>
      </div>
    </div>
  )
}
