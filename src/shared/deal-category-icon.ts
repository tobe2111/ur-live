/**
 * 🏷️ 딜 카테고리 → 선 아이콘 · 라벨 (2026-08-31 SSOT 추출)
 *
 * ■ 왜 뺐나
 *   상세 페이지는 사진이 없을 때 **큰 이모지**(`🍽️ 💇 🏨 …`)를 히어로에 그리고 있었다.
 *   ⓐ 이모지는 기기마다 다른 그림으로 렌더돼 **우리가 그 화면을 통제하지 못한다**
 *   ⓑ 검정 배경 위 큰 이모지는 "아직 안 만든 자리" 로 읽힌다(대표: "AI가 만든 티")
 *   ⓒ 같은 상황에서 홈 카드는 **선 아이콘**을 쓰고 있었다 — 한 상품이 화면마다 다른 그림으로 나왔다.
 *
 *   고치려고 보니 그 아이콘 표가 `GroupBuyFeedCard` **안에** 있었다. 상세로 복사하면
 *   이 레포가 반복해 겪은 대로 두 벌이 갈린다(홈 섹션↔피드 카드가 정확히 그랬다).
 *   ⇒ 표를 여기로 옮기고 **둘 다 여기서 읽는다.**
 */
import { Utensils, Scissors, BedDouble, Ticket, Dumbbell, PawPrint, PartyPopper, Gift, type LucideIcon } from 'lucide-react'

export const CATEGORY_META: Record<string, { Icon: LucideIcon; label: string }> = {
  meal_voucher:     { Icon: Utensils,     label: '식사' },
  beauty_voucher:   { Icon: Scissors,     label: '뷰티' },
  stay_voucher:     { Icon: BedDouble,    label: '숙소' },
  etc_voucher:      { Icon: Ticket,       label: '기타' },
  health_voucher:   { Icon: Dumbbell,     label: '건강' },
  pet_voucher:      { Icon: PawPrint,     label: '반려' },
  activity_voucher: { Icon: PartyPopper,  label: '액티비티' },
}

/** 표에 없는 카테고리는 선물 아이콘 + 원래 문자열(라벨을 지어내지 않는다). */
export function dealCategoryMeta(cat: string | undefined | null) {
  return CATEGORY_META[cat || ''] || { Icon: Gift, label: cat || '' }
}
