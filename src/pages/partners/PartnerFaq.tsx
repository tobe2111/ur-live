/**
 * 🏪 자주 묻는 질문 + 정직 고지 — 대표 승인 덱 11·12장.
 *
 * 질문 순서는 기획 §2-2 가 정한 "사장님이 실제로 묻는 순서" 그대로다.
 * 정직 고지 문장은 `deck-common.mjs` 의 공통 문구와 같은 내용을 쓴다 —
 * 세 소개서와 랜딩이 **같은 말**을 해야 한다(기획 §1 공통 블록 ③).
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import { Reveal } from '../landing/motion'
import FaqItem from '../landing/FaqItem'
// ❓ 2026-10-31 — 질문은 `shared/landing-faq` SSOT 로 옮겼다. 워커가 같은 배열로 서버 본문과
//   `FAQPage` JSON-LD 를 만든다(종전엔 이 파일 안에만 있어 크롤러가 한 글자도 못 받았다).
import { PARTNER_FAQ } from '@/shared/landing-faq'


export default function PartnerFaq() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
          <div>
            <Reveal><h2 className="text-[24px] lg:text-[40px] xl:text-[48px] font-bold tracking-[-0.03em] text-ink leading-[1.2]">
              자주 묻는 것
            </h2></Reveal>
            <p className="mt-5 lg:mt-7 text-[13px] lg:text-[17px] leading-[1.8] text-gray-500 dark:text-gray-400">
              여기에 없는 것은 카카오톡 채널로 물어보세요. 사람이 답합니다.
            </p>
          </div>
          <div>
            {PARTNER_FAQ.map(f => <FaqItem key={f.question} q={f.question} a={f.answer} />)}
          </div>
        </div>

        {/* 정직 고지 — 세 소개서와 같은 내용 */}
        <Reveal className="mt-14 lg:mt-20 pt-10 lg:pt-14 border-t border-rule">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-4">숨기지 않고 말씀드립니다</p>
          <p className="text-[15px] lg:text-[24px] leading-[1.75] text-ink max-w-[40em] font-medium">
            유어딜은 초기 서비스입니다. {F.catalogMeasuredAt} 기준 판매 중인 이용권 {F.activeVouchers}건 가운데
            실제 매장이 등록한 것은 {F.realStores}건이고, 나머지는 시범 운영을 위한 예시입니다.
            트래픽을 약속하는 대신 조건을 숫자로 먼저 공개합니다.
            지금 들어오시는 매장이 그 지역과 카테고리의 첫 자리를 가져갑니다.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
