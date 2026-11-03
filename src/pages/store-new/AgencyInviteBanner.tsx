/**
 * 🔗 에이전시 초대 띠 — 2026-11-03 대표 *"에이전시 링크를 통해서 매장 등록 및 이용권 등록까지 할 때도 … ㅇㅇ사를 통한
 * 가입을 한다 이런 느낌"*. 어느 회사를 통한 가입인지 처음 화면부터 말한다. 맡기기 자체는 종전과 같은 API
 * (`/api/store-agency-invite/accept`)가 등록 직후에 한다 — 이 띠는 표시만 한다.
 */
export default function AgencyInviteBanner({ name }: { name: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-tint px-4 py-3" data-testid="store-claim-agency-invite">
      <span className="w-9 h-9 shrink-0 rounded-full bg-brand text-white flex items-center justify-center text-[15px] font-bold" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-gray-900 dark:text-white truncate">{name} 에이전시의 초대</span>
        <span className="block mt-1 text-[13px] text-ink-soft">등록을 마치면 이 에이전시에 가게 운영을 맡겨요</span>
      </span>
    </div>
  )
}
