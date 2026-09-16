/**
 * 🏪 시작하는 세 가지 길 — 대표 승인 덱 14장.
 *
 * 🩸 이전 랜딩에는 길이 **하나뿐**이었다("셀러 가입하기"). 그런데 이 서비스의 대상은
 *   폰으로 가게를 등록해 본 적 없는 사장님도 포함한다. 길이 하나면 그분들은 그냥 닫는다.
 *   덱은 그래서 세 길을 나란히 둔다 — 직접 / 유어딜이 대신 / 대행사와 함께.
 *
 * ⚠️ 문구는 덱과 같은 문장을 쓴다. 수수료는 길마다 다르다(직접·대신 10%, 중개 5%).
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

/** 세 길의 CTA 는 내부 라우트(Link) 또는 외부 카카오 채널(a) 둘 중 하나다. 판별 union 으로 고정. */
type PathCta = { label: string; to: string } | { label: string; href: string }

const PATHS: { title: string; fee: string; hi?: boolean; steps: string[]; note: string; cta: PathCta }[] = [
  {
    title: '사장님이 직접',
    fee: `수수료 ${F.feeDirect}`,
    hi: true,
    steps: ['urdeal.kr 카카오 로그인', '카카오맵에서 내 가게 찾기', '사업자등록증 사진 한 장', '승인 확인하고 첫 이용권 올리기', '손님 오면 QR 한 번 찍기', '매주 정산 확인'],
    note: `${F.signupMinutes}이면 끝납니다. 막히면 카카오톡 채널로 "등록 도와주세요"`,
    cta: { label: '내 가게 등록하기', to: '/store/new' },
  },
  {
    title: '유어딜이 대신',
    fee: `수수료 ${F.feeDirect}`,
    steps: ['카카오톡 채널에 "등록 도와주세요"', '전화로 메뉴와 가격, 사진을 받습니다', '유어딜이 매장과 첫 이용권을 만듭니다', '사장님은 등록증 사진과 승인 확인만', '손님 오면 QR 한 번 찍기', '매주 정산 확인'],
    note: '폰이 익숙하지 않으셔도 됩니다. 사람이 합니다',
    cta: { label: '카카오톡으로 요청하기', href: F.kakaoChannel },
  },
  {
    title: '대행사와 함께',
    fee: `수수료 ${F.feeBrokered}`,
    steps: ['대행사가 매장을 중개로 등록', '대행사가 이용권과 소개를 운영', '사장님은 본인 카카오로 소유자 확인', '정산 계좌는 사장님만 등록', '손님 오면 QR 한 번 찍기', '대행사 보수는 매장과 대행사가 직접'],
    note: '대행사는 계좌를 못 건드립니다. 권한은 언제든 회수하실 수 있습니다',
    cta: { label: '어떤 방식인지 물어보기', href: F.kakaoChannel },
  },
]

export default function PartnerPaths() {
  return (
    <section className="bg-warm">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
        <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28]">
          시작하는 길은 세 가지입니다
        </h2>
        <p className="mt-3 text-[14px] lg:text-[17px] text-gray-500 dark:text-gray-400">
          직접 하셔도 되고, 저희가 대신 해도 되고, 쓰시던 대행사에 맡기셔도 됩니다.
        </p>

        <div className="mt-10 lg:mt-14 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {PATHS.map(({ title, fee, hi, steps, note, cta }) => (
            <article key={title}
              className={`rounded-2xl p-6 lg:p-7 flex flex-col ${hi ? 'bg-surface shadow-lift' : 'bg-black/[0.03] dark:bg-white/[0.04]'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[18px] lg:text-[21px] font-extrabold text-ink tracking-[-0.01em]">{title}</h3>
                <span className={`text-[12px] font-bold shrink-0 ${hi ? 'text-brand-text' : 'text-gray-500 dark:text-gray-400'}`}>{fee}</span>
              </div>
              <ol className="mt-5 space-y-2.5 flex-1">
                {steps.map(s => (
                  <li key={s} className="flex gap-2.5 text-[13px] lg:text-[13.5px] leading-snug text-gray-600 dark:text-gray-300">
                    <Check className="w-3.5 h-3.5 mt-[3px] shrink-0 text-brand-text" strokeWidth={2.4} />
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 pt-4 border-t border-rule text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">{note}</p>
              {'to' in cta ? (
                <Link to={cta.to}
                  className="mt-5 h-12 rounded-2xl bg-brand text-white flex items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
                  {cta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <a href={cta.href} target="_blank" rel="noopener noreferrer"
                  className="mt-5 h-12 rounded-2xl border border-rule-strong flex items-center justify-center gap-1.5 text-[14px] font-bold text-ink">
                  {cta.label} <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
