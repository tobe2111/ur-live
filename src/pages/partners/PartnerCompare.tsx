/**
 * 🏪 기존 방식과의 비교 — 대표 승인 덱 02장("이 문서의 심장", 덱 주석 원문)
 *
 * ■ 2026-09-16 2차 (대표 *"우리 유어딜 서비스의 차별점, 장점 그리고 기존 체험단 서비스와
 *   비교하는 것 그런게 필요해"*)
 *   표만 있었는데, 표는 **훑는 사람에게 결론을 안 준다**. 대표가 확정한 "차별점 3가지" 를
 *   표 위에 **문장으로 먼저** 놓고, 근거를 표가 받는 구조로 바꿨다. 셋의 상대는 대표가 지정한
 *   체험단 · 배달앱 · 예약솔루션 그대로다.
 *
 * ■ 비교하는 축은 셋뿐이다: **돈이 나가는 시점 · 오는 사람 · 효과 확인.**
 * ⚠️ 성과 수치("매출 N% 증가")는 넣지 않는다 — 라이브 실측 전이라 근거가 없다(기획 §2-6).
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

/** 대표 확정 "차별점 3가지"(2026-09-16). 상대의 이름을 피하지 않는다 — 사장님이 지금 쓰는 것들이다. */
const DIFFS = [
  {
    vs: '체험단, 블로그 마케팅과 다른 점',
    t: '공짜밥과 후기 개수가 아니라, 실제 방문과 결제로 증명합니다',
    d: '체험단은 무료 식사를 드리고 후기를 받습니다. 그 사람이 손님이 됐는지는 아무도 모릅니다. 유어딜은 결제를 마친 손님이 QR을 찍고 들어옵니다.',
  },
  {
    vs: '배달앱, 검색 광고와 다른 점',
    t: '상위 노출을 사는 광고비가 없고, 나가는 돈이 전부 보입니다',
    d: `수수료는 ${F.feeDirect}, 중개로 들어오시면 ${F.feeBrokered}입니다. 소개해 준 사람에게 얼마를 드릴지는 사장님이 정하고, 그 내역이 매장 화면에 그대로 남습니다.`,
  },
  {
    vs: '예약, 포스 솔루션과 다른 점',
    t: '온 손님을 관리하는 도구가 아니라, 새 손님을 데려오는 채널입니다',
    d: '예약과 포스는 이미 오기로 한 손님을 정리합니다. 유어딜은 아직 가게를 모르는 사람에게 이용권을 팔아 가게로 보냅니다.',
  },
]

const HEAD = ['', '돈이 나가는 시점', '오는 사람', '효과 확인']

const ROWS: { k: string; cells: string[]; ours?: boolean }[] = [
  { k: '체험단, 블로그 마케팅', cells: ['대행비 선지불 + 무료 식사', '공짜로 먹으러 온 체험단', '후기 몇 개. 손님이 됐는지는 모름'] },
  { k: '배달앱, 검색 광고', cells: ['매달 광고비 선지불', '클릭한 사람 (방문 보장 없음)', '클릭 수. 매출 연결은 모름'] },
  { k: '예약, 포스 솔루션', cells: ['매달 구독료 선지불', '이미 오기로 한 손님', '온 손님 관리. 새 손님은 각자 알아서'] },
  { k: '유어딜', cells: ['팔린 뒤에만 수수료', '결제까지 마친 새 손님', '몇 장 팔리고 몇 명 왔는지 숫자로'], ours: true },
]

const GRID = 'grid-cols-[1.05fr_1.15fr_1.05fr_1.25fr]'

export default function PartnerCompare() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
        <h2 className="text-[25px] lg:text-[42px] xl:text-[48px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2] max-w-[16em]">
          광고비 쓰고, 효과 봤는지는 아셨어요?
        </h2>
        <p className="mt-4 text-[14px] lg:text-[18px] text-gray-500 dark:text-gray-400">
          돈이 먼저 나가고, 손님은 나중에 옵니다. 온다는 보장도 없이.
        </p>

        {/* 차별점 셋 — 결론을 먼저 문장으로 */}
        <div className="mt-10 lg:mt-20 grid gap-8 lg:grid-cols-3 lg:gap-0">
          {DIFFS.map(({ vs, t, d }, i) => (
            <div key={vs} className={`lg:px-10 ${i === 0 ? 'lg:pl-0' : 'lg:border-l lg:border-rule'} ${i === DIFFS.length - 1 ? 'lg:pr-0' : ''}`}>
              <p className="text-[12px] lg:text-[13px] font-bold text-brand-text">{vs}</p>
              <p className="mt-3 lg:mt-4 text-[18px] lg:text-[23px] xl:text-[25px] font-extrabold text-ink leading-[1.35] tracking-[-0.02em]">{t}</p>
              <p className="mt-3 text-[13.5px] lg:text-[15px] leading-[1.8] text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>

        {/* 근거 — 표. PC 는 넓은 표, 모바일은 카드 스택(좁은 화면에서 4열 표는 읽히지 않는다) */}
        <div className="hidden lg:block mt-24">
          <div className={`grid ${GRID} gap-x-8 pb-4 border-b border-rule`}>
            {HEAD.map((h, i) => (
              <p key={i} className="text-[13px] font-bold text-gray-400 dark:text-gray-500">{h}</p>
            ))}
          </div>
          {ROWS.map(({ k, cells, ours }) => (
            <div key={k}
              className={`grid ${GRID} gap-x-8 items-center ${ours ? 'mt-3 rounded-2xl bg-brand-tint px-7 py-7 -mx-7' : 'px-0 py-7 border-b border-rule'}`}>
              <p className={`text-[18px] xl:text-[20px] font-extrabold tracking-[-0.01em] ${ours ? 'text-brand-text' : 'text-ink'}`}>{k}</p>
              {cells.map((c, i) => (
                <p key={i} className={`text-[15px] xl:text-[16px] leading-relaxed ${ours ? 'font-bold text-ink' : 'text-gray-500 dark:text-gray-400'}`}>{c}</p>
              ))}
            </div>
          ))}
        </div>

        <div className="lg:hidden mt-10 space-y-2.5">
          {ROWS.map(({ k, cells, ours }) => (
            <div key={k} className={`rounded-2xl p-4 ${ours ? 'bg-brand-tint' : 'bg-black/[0.03] dark:bg-white/[0.04]'}`}>
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

        <p className="mt-12 lg:mt-20 text-[16px] lg:text-[26px] xl:text-[30px] leading-[1.55] tracking-[-0.02em] text-gray-500 dark:text-gray-400 max-w-[22em]">
          체험단은 밥을 공짜로 드리고 후기를 받습니다.{' '}
          <b className="font-extrabold text-ink">유어딜은 손님이 돈을 내고 옵니다. 후기는 그 다음에 따라옵니다.</b>
        </p>
        <p className="mt-6 lg:mt-8 text-[12.5px] lg:text-[14px] text-gray-400 dark:text-gray-500 max-w-[44em]">
          {F.pgNote}
        </p>
      </div>
    </section>
  )
}
