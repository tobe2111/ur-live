/**
 * 🧭 서비스 소개 랜딩 — `/about` (2026-07-19 대표 "웹페이지 3종" ②, 소비자·제휴처 겸용 1페이지)
 *   한 줄 정의 → 소비자 혜택 → 3자 구조 → 사장님 진행 → 숫자 → 앱 진입 CTA.
 *   상세 소개서(구 AboutPage, 인쇄/PDF)는 `/about/print` 로 보존, 하단 링크.
 *
 * ■ 2026-09-01 재작성 — 대표 *"AI 스럽지 않은 디자인으로 마무리"*
 *   `.claude/skills/taste-skill` 기준으로 재 보니 **다섯 항목 전부 위반**이었다:
 *   ① `ABOUT URDEAL` eyebrow(스킬 §0.D 가 LLM 기본값으로 명시) ② `01 02 03 04` 섹션번호(금지)
 *   ③ em-dash 4개(허용 0) ④ 가운뎃점이 한 줄에 2개인 문구 ⑤ **다섯 섹션이 전부 같은 계열**
 *   (`rounded-2xl bg-white` 카드) — 스킬은 "같은 레이아웃 계열 반복 금지" 를 실패로 규정한다.
 *
 *   ⇒ 섹션마다 **다른 형태**를 쓴다: 히어로(타이포) · 혜택(헤어라인 목록) · 3자(레일 다이어그램) ·
 *      진행(세로 레일 스텝) · 숫자(비대칭 — 사실 하나를 크게, 나머지는 각주). 내용·링크는 불변.
 */
import { Link } from 'react-router-dom'
import { Store, Users, Megaphone, QrCode, BadgePercent, MapPin, ArrowRight, FileText } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'

const BENEFITS = [
  { icon: BadgePercent, t: '동네 할인', d: '내 주변 맛집과 뷰티, 숙소를 정가보다 싸게' },
  { icon: QrCode, t: 'QR 간편 사용', d: '결제는 미리, 매장에선 QR 한 번이면 끝' },
  { icon: MapPin, t: '지도로 발견', d: '지금 내 위치 주변의 딜을 지도에서 바로' },
]

/** 3자 구조 — 각자가 내는 것과 받는 것. 셋이 한 문장으로 이어지도록 순서 고정. */
const TRIANGLE = [
  { icon: Store, t: '매장', gives: '팔린 만큼만 내는 판매 수수료', gets: '선불 광고비 없이 새 손님' },
  { icon: Megaphone, t: '소개하는 사람', gives: '내 유어샵에 담아 링크 하나로 소개', gets: '팔릴 때마다 쌓이는 몫' },
  { icon: Users, t: '소비자', gives: '앱에서 미리 결제', gets: '검증된 동네 가게를 할인가로' },
]

const STEPS = [
  ['매장 등록', '카카오맵에서 내 가게를 검색해 등록하면 사업자번호 확인으로 바로 활성화됩니다.'],
  ['이용권 등록', '메뉴와 가격, 할인을 설정하면 판매 1건당 실수령가를 그 자리에서 확인할 수 있어요.'],
  ['소개 제안', '유어딜 소개 파트너 목록에서 골라 커미션 조건으로 협업을 제안합니다. 발송은 유어딜이 대신해요.'],
  ['판매와 정산', '고객이 앱에서 결제하고 매장에서 QR 로 사용합니다. 사용 확정분이 자동 정산돼요.'],
]

export default function AboutServicePage() {
  return (
    <div className="min-h-[100dvh] bg-[#F8F7FC] dark:bg-[#11141C]">
      <SEO title="서비스 소개 - 유어딜" description="유어딜은 동네 가게의 할인 이용권을 앱에서 사고 매장에서 QR 로 쓰는 로컬 딜 플랫폼입니다." url="/about" />
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-12 bg-[#F8F7FC]/90 dark:bg-[#11141C]/90 backdrop-blur-sm">
        <Link to="/" aria-label="유어딜 홈"><UrDealLogo size={18} /></Link>
        <div className="flex items-center gap-3">
          <Link to="/partners" className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">입점 안내</Link>
          <Link to="/creators" className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">소개하기</Link>
        </div>
      </header>

      <main className="px-5 pb-32 max-w-xl mx-auto">
        {/* ① 히어로 — 타이포만. eyebrow 없이 제목이 스스로 무엇인지 말한다.
            줄바꿈은 어절이 끊기지 않는 자리에만(예전엔 "…QR 로 / 쓰는" 으로 '쓰는' 이 홀로 남았다). */}
        <section className="pt-12 pb-11">
          <h1 className="text-[27px] leading-[1.42] font-extrabold tracking-[-0.02em] text-[#16181C] dark:text-[#F5F3F1]">
            동네 가게의 할인 이용권을<br />
            <span className="text-brand">앱에서 사고, 매장에서 QR 로</span><br />
            쓰는 로컬 딜 플랫폼
          </h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            서울 서초구 상권 활성화 사업을 수행하고 있어요.
          </p>
        </section>

        {/* ② 소비자 혜택 — 카드가 아니라 **헤어라인 목록**. 세 줄이 같은 무게로 읽히고 여백이 준다. */}
        <section className="pb-11">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#16181C] dark:text-[#F5F3F1] mb-1">소비자에게는</h2>
          <div className="border-t border-[#16181C]/10 dark:border-[#2C2F35] mt-4">
            {BENEFITS.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex items-baseline gap-3 py-3.5 border-b border-[#16181C]/10 dark:border-[#2C2F35]">
                <Icon className="w-4 h-4 shrink-0 translate-y-0.5 text-brand" strokeWidth={1.9} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[14.5px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">{t}</p>
                  <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ③ 3자 구조 — 3열 균등 카드(예전)는 10.5px 글씨가 다섯 줄로 눌려 읽히지 않았다.
            **내는 것 / 받는 것** 을 좌우로 나눈 레일로. 세로로 읽으면 "아무도 먼저 안 낸다" 가 보인다. */}
        <section className="pb-11">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#16181C] dark:text-[#F5F3F1] mb-1">셋이 함께 커지는 구조</h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400">누구도 먼저 돈을 내지 않습니다.</p>
          <ol className="mt-4 relative pl-5">
            <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-[#16181C]/20 dark:bg-[#3A3D44]" />
            {TRIANGLE.map(({ icon: Icon, t, gives, gets }) => (
              <li key={t} className="relative pb-5 last:pb-0">
                <span aria-hidden className="absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full bg-[#F8F7FC] dark:bg-[#11141C] ring-2 ring-brand" />
                <p className="flex items-center gap-1.5 text-[14.5px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">
                  <Icon className="w-[15px] h-[15px] text-brand" strokeWidth={1.9} aria-hidden />{t}
                </p>
                <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug mt-1">
                  <span className="text-gray-400 dark:text-gray-500">내는 것</span> {gives}
                </p>
                <p className="text-[12.5px] leading-snug mt-0.5 text-[#16181C] dark:text-[#F5F3F1]">
                  <span className="text-gray-400 dark:text-gray-500 font-normal">받는 것</span> <b className="font-semibold">{gets}</b>
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/partners" className="h-11 px-4 rounded-full border border-[#16181C]/15 dark:border-[#2C2F35] inline-flex items-center gap-1.5 text-[13px] font-bold text-[#16181C] dark:text-[#F5F3F1]">매장 입점 안내 <ArrowRight className="w-3.5 h-3.5" /></Link>
            <Link to="/creators" className="h-11 px-4 rounded-full border border-[#16181C]/15 dark:border-[#2C2F35] inline-flex items-center gap-1.5 text-[13px] font-bold text-[#16181C] dark:text-[#F5F3F1]">소개 파트너 모집 <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </section>

        {/* ④ 사장님 진행 — 숫자 배지(01/02/03/04) 제거. 순서는 세로 레일이 이미 말한다.
            (`taste-skill`: 섹션번호 eyebrow 금지) */}
        <section className="pb-11">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#16181C] dark:text-[#F5F3F1] mb-1">사장님은 이렇게 진행해요</h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400">가입부터 정산까지, 전부 셀러 대시보드 하나에서.</p>
          <ol className="mt-4 space-y-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="shrink-0 mt-[3px] w-5 text-[11px] font-extrabold tabular-nums text-gray-300 dark:text-gray-600">{i + 1}</span>
                <div className="min-w-0 border-b border-[#16181C]/8 dark:border-[#2C2F35] pb-4 flex-1 last:border-0">
                  <p className="text-[14.5px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">{t}</p>
                  <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ⑤ 숫자 — 3열 균등(예전)은 "준비 중" 을 확정 사실과 같은 크기로 세웠다.
            확정된 것 하나를 크게 두고 나머지는 각주로 내린다. */}
        <section className="pb-11">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#16181C] dark:text-[#F5F3F1] mb-4">숫자와 이야기</h2>
          <p className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-[#16181C] dark:text-[#F5F3F1]">19조 원</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">글로벌 동일 모델 시장 규모</p>
          <dl className="mt-5 text-[12.5px] leading-relaxed border-t border-[#16181C]/10 dark:border-[#2C2F35] pt-4">
            <div className="flex gap-3 py-1">
              <dt className="w-24 shrink-0 text-gray-400 dark:text-gray-500">수행 사업</dt>
              <dd className="text-[#16181C] dark:text-[#F5F3F1]">서초구 상권 활성화 사업</dd>
            </div>
            <div className="flex gap-3 py-1">
              <dt className="w-24 shrink-0 text-gray-400 dark:text-gray-500">방배 파일럿</dt>
              <dd className="text-gray-500 dark:text-gray-400">10월 실측 예정. 결과는 이 자리에 올립니다.</dd>
            </div>
          </dl>
          <Link to="/about/print" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#16181C] dark:text-[#F5F3F1] underline underline-offset-4 decoration-[#16181C]/25 dark:decoration-[#2C2F35]">
            <FileText className="w-4 h-4" /> 상세 소개서 보기 (PDF 저장 가능)
          </Link>
        </section>
      </main>

      {/* 하단 고정 CTA — 앱 진입 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur-md border-t border-gray-100 dark:border-[#2C2F35] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto">
          <Link to="/" className="flex h-12 rounded-2xl bg-brand text-white items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
            내 주변 딜 보러가기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
