/**
 * 🏪 자주 묻는 질문 + 정직 고지 — 대표 승인 덱 11·12장.
 *
 * 질문 순서는 기획 §2-2 가 정한 "사장님이 실제로 묻는 순서" 그대로다.
 * 정직 고지 문장은 `deck-common.mjs` 의 공통 문구와 같은 내용을 쓴다 —
 * 세 소개서와 랜딩이 **같은 말**을 해야 한다(기획 §1 공통 블록 ③).
 */
import { ChevronDown } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
// ❓ 2026-10-31 — 질문은 `shared/landing-faq` SSOT 로 옮겼다. 워커가 같은 배열로 서버 본문과
//   `FAQPage` JSON-LD 를 만든다(종전엔 이 파일 안에만 있어 크롤러가 한 글자도 못 받았다).
import { PARTNER_FAQ } from '@/shared/landing-faq'

export default function PartnerFaq() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
          <div>
            <h2 className="text-[24px] lg:text-[40px] xl:text-[48px] font-bold tracking-[-0.03em] text-ink leading-[1.2]">
              자주 묻는 것
            </h2>
            <p className="mt-5 lg:mt-7 text-[13px] lg:text-[17px] leading-[1.8] text-gray-500 dark:text-gray-400">
              여기에 없는 것은 카카오톡 채널로 물어보세요. 사람이 답합니다.
            </p>
          </div>
          <div>
            {PARTNER_FAQ.map(f => <Item key={f.question} q={f.question} a={f.answer} />)}
          </div>
        </div>

        {/* 정직 고지 — 세 소개서와 같은 내용 */}
        <div className="mt-14 lg:mt-20 pt-10 lg:pt-14 border-t border-rule">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-4">숨기지 않고 말씀드립니다</p>
          <p className="text-[15px] lg:text-[24px] leading-[1.75] text-ink max-w-[40em] font-medium">
            유어딜은 초기 서비스입니다. {F.liveMeasuredAt} 기준 판매 중인 이용권 {F.activeVouchers}건 가운데
            실제 매장이 등록한 것은 {F.realStores}건이고, 나머지는 시범 운영을 위한 예시입니다.
            트래픽을 약속하는 대신 조건을 숫자로 먼저 공개합니다.
            지금 들어오시는 매장이 그 지역과 카테고리의 첫 자리를 가져갑니다.
          </p>
        </div>
      </div>
    </section>
  )
}

// 🔎 `<details>` 로 둔다 — 종전 `{open && <p>}` 는 접힌 답을 DOM 에서 지워, JS 를 돌리는 크롤러가
//   렌더해도 답이 없었다. `<details>` 는 접혀 있어도 답이 문서에 남는다(키보드·스크린리더도 기본 지원).
function Item({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-rule">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer w-full flex items-center justify-between gap-4 py-4 lg:py-6 text-left">
        <span className="text-[15px] lg:text-[17px] font-bold text-ink">{q}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" strokeWidth={2} />
      </summary>
      <p className="pb-5 pr-8 text-[13px] lg:text-[17px] leading-[1.8] text-gray-600 dark:text-gray-300 max-w-[44em]">{a}</p>
    </details>
  )
}
