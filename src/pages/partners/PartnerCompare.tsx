/**
 * 🏪 기존 방식과의 비교 — 대표 승인 덱 02장("이 문서의 심장", 덱 주석 원문)
 *
 * 비교하는 축은 둘뿐이다: **돈이 나가는 시점**과 **효과를 확인할 수 있는가**.
 * ⚠️ 성과 수치("매출 N% 증가")는 넣지 않는다 — 라이브 실측 전이라 근거가 없다(기획 §2-6).
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

const HEAD = ['', '돈이 나가는 시점', '오는 사람', '효과 확인']

const ROWS: { k: string; cells: string[]; ours?: boolean }[] = [
  { k: '체험단, 블로그 마케팅', cells: ['대행비 선지불 + 무료 식사', '공짜로 먹으러 온 체험단', '후기 몇 개. 손님이 됐는지는 모름'] },
  { k: '배달앱, 검색 광고', cells: ['매달 광고비 선지불', '클릭한 사람 (방문 보장 없음)', '클릭 수. 매출 연결은 모름'] },
  { k: '전단, 현수막', cells: ['제작비 선지불', '알 수 없음', '알 수 없음'] },
  { k: '유어딜', cells: ['팔린 뒤에만 수수료', '결제까지 마친 손님', '몇 장 팔리고 몇 명 왔는지 숫자로'], ours: true },
]

export default function PartnerCompare() {
  return (
    <section className="bg-warm">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
        <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28]">
          광고비 쓰고, 효과 봤는지는 아셨어요?
        </h2>
        <p className="mt-3 text-[14px] lg:text-[17px] text-gray-500 dark:text-gray-400">
          돈이 먼저 나가고, 손님은 나중에 옵니다. 온다는 보장도 없이.
        </p>

        {/* PC: 표. 모바일: 카드 스택 (좁은 화면에서 4열 표는 읽히지 않는다) */}
        <div className="hidden lg:block mt-12">
          <div className="grid grid-cols-[1.15fr_1.3fr_1.15fr_1.4fr] gap-x-6 pb-3 border-b border-rule">
            {HEAD.map((h, i) => (
              <p key={i} className="text-[12px] font-bold text-gray-400 dark:text-gray-500">{h}</p>
            ))}
          </div>
          {ROWS.map(({ k, cells, ours }) => (
            <div key={k}
              className={`grid grid-cols-[1.15fr_1.3fr_1.15fr_1.4fr] gap-x-6 items-center ${ours ? 'mt-2 rounded-2xl bg-surface shadow-lift px-5 py-5 -mx-5' : 'px-0 py-5 border-b border-rule'}`}>
              <p className={`text-[15px] font-bold ${ours ? 'text-brand-text' : 'text-ink'}`}>{k}</p>
              {cells.map((c, i) => (
                <p key={i} className={`text-[13.5px] leading-relaxed ${ours ? 'font-semibold text-ink' : 'text-gray-500 dark:text-gray-400'}`}>{c}</p>
              ))}
            </div>
          ))}
        </div>

        <div className="lg:hidden mt-8 space-y-2.5">
          {ROWS.map(({ k, cells, ours }) => (
            <div key={k} className={`rounded-2xl p-4 ${ours ? 'bg-surface shadow-lift' : 'bg-black/[0.03] dark:bg-white/[0.04]'}`}>
              <p className={`text-[14.5px] font-extrabold ${ours ? 'text-brand-text' : 'text-ink'}`}>{k}</p>
              <dl className="mt-2.5 space-y-1.5">
                {cells.map((c, i) => (
                  <div key={i} className="flex gap-3 text-[12.5px]">
                    <dt className="w-[6.5rem] shrink-0 text-gray-400 dark:text-gray-500">{HEAD[i + 1]}</dt>
                    <dd className={ours ? 'font-semibold text-ink' : 'text-gray-600 dark:text-gray-300'}>{c}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-9 lg:mt-12 text-[14px] lg:text-[18px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[46em]">
          체험단은 밥을 공짜로 드리고 후기를 받습니다.{' '}
          <b className="font-extrabold text-ink">유어딜은 손님이 돈을 내고 옵니다. 후기는 그 다음에 따라옵니다.</b>
        </p>
        <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">
          {F.pgNote}
        </p>
      </div>
    </section>
  )
}
