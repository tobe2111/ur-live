/**
 * 🏢 에이전시 로그인 화면의 소개 판 (2026-10-26 대표 *"페이지를 좀 꾸며야 하지 않을까?"*)
 *
 * 처음 온 대행사가 "이 계정으로 무엇을 하나" 를 로그인 칸 옆에서 바로 읽게 한다.
 * 🔒 **지금 실제로 되는 것만 적는다** — 매장 초대 링크·매장 대신 등록(`AgencyInviteLinkCard`·`AgencyRegisterStoreCard`),
 * 직원 초대·매장 배정(`AgencyStaffPanel`), 이용권 단위 성과(`channel-sales.ts`).
 * 에이전시 몫은 사장님이 정하고 돈은 매장이 직접 보낸다(`agency-share.ts` — 유어딜 송금 아님) ⇒ "유어딜이 보내 드린다" 류 문장 금지.
 */
import { StoreIcon, PeopleIcon, ChartIcon, WonCoinIcon } from '@/components/icons/urdeal-icons'

const POINTS = [
  { Icon: StoreIcon, title: '여러 매장을 한 계정에서', body: '사장님께 초대 링크를 보내면 [맡기기] 한 번으로 운영이 시작돼요. 아직 유어딜에 없는 매장은 대신 등록할 수 있어요.' },
  { Icon: PeopleIcon, title: '직원과 함께', body: '직원을 이메일로 초대하고, 직원마다 맡을 매장을 나눠요.' },
  { Icon: ChartIcon, title: '우리 이용권 성과만 따로', body: '우리가 등록하고 맡은 이용권의 판매만 따로 모여요. 사장님 직접 판매와 섞이지 않아요.' },
  { Icon: WonCoinIcon, title: '가입비·월 이용료 0원', body: '에이전시가 유어딜에 내는 돈은 없어요.' },
] as const

const STEPS = ['이메일로 에이전시 만들기', '사장님께 매장 초대 링크 보내기', '이용권 등록하고 판매 확인'] as const

export function AgencyIntro() {
  return (
    <section aria-label="유어딜 에이전시 소개">
      <p className="text-[13px] font-medium text-brand-text">유어딜 에이전시</p>
      <h2 className="mt-2 text-[28px] lg:text-[34px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
        동네 매장의 이용권,<br />여러 곳을 한 번에 운영하세요
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
        매장을 대신해 유어딜 이용권을 등록하고 운영하는 대행사 전용 계정이에요.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {POINTS.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-text">
              <Icon size={20} />
            </span>
            <div>
              <p className="text-[15px] font-bold text-gray-900">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <ol className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lift">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[12px] font-bold text-white tabular-nums">{i + 1}</span>
            <span className="text-[13px] font-medium text-gray-800">{s}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
