/**
 * 🧾 유어샵 맨 아래 유입 링크 세 줄 (2026-09-28 대표 확정 **B안**).
 *
 * > 대표: *"유어샵 모바일 버전에는 맨 밑에나 사장님 입점 신청, 인플루언서 참여하기,
 * >  제휴 및 협업 문의 내용도 하단에 삽입하는 형태로나 해야함."* → 시안 3안 중 **"B가 낫겠는데?"**
 *
 * 노리는 사람은 **손님으로 들어온 사장님·소개자**다. 카톡 링크로 남의 유어샵을 보러 왔다가
 * "나도 올릴 수 있나?" 가 드는 그 순간이 이 세 줄이 있는 이유다.
 *
 * 🩸 **이 자리는 2026-06-19 에 한 번 치운 자리다** — 대표 *"나도 내 유어샵 만들기 버튼 별로"*
 *    (`CuratorPage.tsx` 하단에 그 주석이 아직 있다). 그때와 다른 점 둘을 지켜야 같은 평가를 안 받는다:
 *      ① 그때는 **화면에 붙어 따라다니는 고정 CTA** 였다. 이건 목록이 **끝난 뒤** 맨 아래다
 *         (바닥까지 스크롤한 사람만 본다 — 상품을 한 픽셀도 밀지 않는다).
 *      ② 그때는 **주인에게도 떴다.** 그래서 대표가 골라 준 대로 **주인에겐 안 그린다**(호출부 `!isOwner`).
 *
 * 🔇 **판도 배경도 색도 없다**(B안). 흰 판(A안)·파란 버튼(C안)은 둘 다 고르지 않았다 —
 *    C 는 이 화면의 유일한 강조색이 *상품이 아니라 문의* 로 가서 표면 규칙 ②를 어긴다.
 *
 * 🏷️ **문구는 대표 원문 그대로다**(2026-09-28 `AskUserQuestion` "대표님 원문 그대로" 선택).
 *    ⚠️ 그중 `인플루언서 참여하기` 는 CLAUDE.md 의 *"사람 지칭에 인플루언서/크리에이터/큐레이터 금지"*
 *    (2026-08-26 대표 확정 "행위 2개로 말한다 — 담기(소개)·운영(대행)")와 **충돌한다.**
 *    충돌을 대표에게 문구 표로 보고했고 대표가 원문을 골랐다 ⇒ **대표 결정이 규칙을 이긴다.**
 *    다음 세션이 "규칙 위반이다" 며 되돌리지 않도록 여기 적어 둔다. 바꾸려면 대표에게 다시 물을 것.
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/** 셋 다 **이미 있는 페이지**다 — 이 블록 때문에 새로 만든 라우트는 없다. */
const LINKS: Array<{ to: string; label: string }> = [
  { to: '/partners', label: '사장님 입점 신청' },
  { to: '/influencer', label: '인플루언서 참여하기' },
  { to: '/partnership', label: '제휴 및 협업 문의' },
]

export default function ShopInquiryLinks() {
  return (
    <nav aria-label="유어딜과 함께하기" className="max-w-3xl mx-auto px-4 pt-7 pb-2 flex flex-col gap-[11px]">
      {LINKS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-gray-500 dark:text-gray-400 active:opacity-70"
        >
          {label}
          <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  )
}
